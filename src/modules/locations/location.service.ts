import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CoupleStatus } from '../couples/enum/couple-status.enum';
import { Couple, CoupleDocument } from '../couples/schemas/couple.schema';
import { LocationCoordinatesDto } from './dto/location-coordinates.dto';
import { StartLiveLocationDto } from './dto/start-live-location.dto';
import { UpdateLiveLocationDto } from './dto/update-live-location.dto';
import { LocationRealtimeService } from './location-realtime.service';
import { Location, LocationDocument } from './schemas/location.schema';

@Injectable()
export class LocationService {
  public constructor(
    @InjectModel(Location.name)
    private readonly locationModel: Model<LocationDocument>,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
    private readonly locationRealtime: LocationRealtimeService,
  ) {}

  async startSharing(userId: string, dto: StartLiveLocationDto) {
    const userObjectId = this.toObjectId(userId);
    const couple = await this.getActiveCouple(userObjectId);
    const now = new Date();
    const expiresAt = dto.untilStopped
      ? undefined
      : new Date(now.getTime() + dto.durationMinutes * 60 * 1000);
    const unsetFields = {
      stoppedAt: 1,
      ...this.getMissingOptionalCoordinateFields(dto),
      ...(dto.untilStopped ? { sharingExpiresAt: 1 } : {}),
    };
    const location = await this.locationModel.findOneAndUpdate(
      { user: userObjectId },
      {
        $set: {
          user: userObjectId,
          couple: couple._id,
          isSharing: true,
          ...this.coordinateUpdate(dto),
          sharingStartedAt: now,
          untilStopped: dto.untilStopped,
          ...(expiresAt ? { sharingExpiresAt: expiresAt } : {}),
        },
        $unset: unsetFields,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const payload = this.serializeLocation(location);
    this.emitToCouple(couple, 'location:sharing-started', payload);
    return payload;
  }

  async updateSharing(userId: string, dto: UpdateLiveLocationDto) {
    const userObjectId = this.toObjectId(userId);
    const couple = await this.getActiveCouple(userObjectId);
    const coordinateUpdate = this.coordinateUpdate(dto);
    const location = await this.locationModel.findOneAndUpdate(
      {
        user: userObjectId,
        couple: couple._id,
        isSharing: true,
        $and: [
          this.activeSharingFilter(),
          {
            $or: [
              { capturedAt: { $exists: false } },
              {
                capturedAt: {
                  $lte: coordinateUpdate.capturedAt as Date,
                },
              },
            ],
          },
        ],
      },
      {
        $set: coordinateUpdate,
      },
      { new: true },
    );
    if (!location) {
      const activeSession = await this.locationModel.exists({
        user: userObjectId,
        couple: couple._id,
        isSharing: true,
        ...this.activeSharingFilter(),
      });
      if (activeSession) {
        throw new BadRequestException(
          'Location update is older than the latest stored location',
        );
      }
      await this.expireIfNeeded(userObjectId, couple);
      throw new ConflictException('Live location sharing is not active');
    }

    const payload = this.serializeLocation(location);
    this.emitToCouple(couple, 'location:updated', payload);
    return payload;
  }

  async stopSharing(userId: string) {
    const userObjectId = this.toObjectId(userId);
    const couple = await this.getActiveCouple(userObjectId);
    const stoppedAt = new Date();
    const location = await this.locationModel.findOneAndUpdate(
      {
        user: userObjectId,
        couple: couple._id,
        isSharing: true,
      },
      {
        $set: { isSharing: false, untilStopped: false, stoppedAt },
        $unset: {
          latitude: 1,
          longitude: 1,
          accuracy: 1,
          heading: 1,
          speed: 1,
          address: 1,
          capturedAt: 1,
          sharingExpiresAt: 1,
        },
      },
      { new: true },
    );

    const payload = {
      userId,
      isSharing: false,
      stoppedAt,
    };
    if (location) {
      this.emitToCouple(couple, 'location:sharing-stopped', payload);
    }
    return payload;
  }

  async getMySharing(userId: string) {
    const userObjectId = this.toObjectId(userId);
    const couple = await this.getActiveCouple(userObjectId);
    await this.expireIfNeeded(userObjectId, couple);
    const location = await this.locationModel.findOne({
      user: userObjectId,
      couple: couple._id,
      isSharing: true,
      ...this.activeSharingFilter(),
    });
    return location
      ? this.serializeLocation(location)
      : { userId, isSharing: false };
  }

  async getPartnerSharing(userId: string) {
    const userObjectId = this.toObjectId(userId);
    const couple = await this.getActiveCouple(userObjectId);
    const partnerId = this.getPartnerId(couple, userObjectId);
    await this.expireIfNeeded(partnerId, couple);
    const location = await this.locationModel.findOne({
      user: partnerId,
      couple: couple._id,
      isSharing: true,
      ...this.activeSharingFilter(),
    });
    return location
      ? this.serializeLocation(location)
      : { userId: partnerId.toString(), isSharing: false };
  }

  private async expireIfNeeded(userId: Types.ObjectId, couple: CoupleDocument) {
    const expiredAt = new Date();
    const expired = await this.locationModel.findOneAndUpdate(
      {
        user: userId,
        couple: couple._id,
        isSharing: true,
        untilStopped: { $ne: true },
        sharingExpiresAt: { $lte: expiredAt },
      },
      {
        $set: {
          isSharing: false,
          untilStopped: false,
          stoppedAt: expiredAt,
        },
        $unset: {
          latitude: 1,
          longitude: 1,
          accuracy: 1,
          heading: 1,
          speed: 1,
          address: 1,
          capturedAt: 1,
          sharingExpiresAt: 1,
        },
      },
      { new: true },
    );
    if (expired) {
      this.emitToCouple(couple, 'location:sharing-expired', {
        userId: userId.toString(),
        isSharing: false,
        stoppedAt: expiredAt,
      });
    }
  }

  private coordinateUpdate(dto: LocationCoordinatesDto) {
    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
    const now = Date.now();
    if (
      capturedAt.getTime() > now + 60_000 ||
      capturedAt.getTime() < now - 10 * 60_000
    ) {
      throw new BadRequestException(
        'capturedAt must be within the accepted time window',
      );
    }
    const update: Record<string, unknown> = {
      latitude: dto.latitude,
      longitude: dto.longitude,
      capturedAt,
    };
    if (dto.accuracy !== undefined) {
      update.accuracy = dto.accuracy;
    }
    if (dto.heading !== undefined) {
      update.heading = dto.heading;
    }
    if (dto.speed !== undefined) {
      update.speed = dto.speed;
    }
    if (dto.address !== undefined) {
      update.address = dto.address.trim();
    }
    return update;
  }

  private getMissingOptionalCoordinateFields(dto: LocationCoordinatesDto) {
    const unset: Record<string, 1> = {};
    if (dto.accuracy === undefined) {
      unset.accuracy = 1;
    }
    if (dto.heading === undefined) {
      unset.heading = 1;
    }
    if (dto.speed === undefined) {
      unset.speed = 1;
    }
    if (dto.address === undefined) {
      unset.address = 1;
    }
    return unset;
  }

  private serializeLocation(location: LocationDocument) {
    return {
      userId: location.user.toString(),
      isSharing: location.isSharing,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy ?? null,
      heading: location.heading ?? null,
      speed: location.speed ?? null,
      address: location.address ?? null,
      capturedAt: location.capturedAt,
      sharingStartedAt: location.sharingStartedAt,
      untilStopped: Boolean(location.untilStopped),
      sharingExpiresAt: location.sharingExpiresAt ?? null,
      updatedAt: location.updatedAt,
    };
  }

  private async getActiveCouple(userId: Types.ObjectId) {
    const couple = await this.coupleModel.findOne({
      $or: [{ user_1: userId }, { user_2: userId }],
      status: CoupleStatus.ACTIVE,
    });
    if (!couple) {
      throw new NotFoundException('Active couple not found');
    }
    return couple;
  }

  private activeSharingFilter() {
    return {
      $or: [{ untilStopped: true }, { sharingExpiresAt: { $gt: new Date() } }],
    };
  }

  private getPartnerId(
    couple: CoupleDocument,
    userId: Types.ObjectId,
  ): Types.ObjectId {
    return couple.user_1.equals(userId) ? couple.user_2 : couple.user_1;
  }

  private emitToCouple(
    couple: CoupleDocument,
    event: string,
    payload: unknown,
  ) {
    this.locationRealtime.emitToUser(couple.user_1.toString(), event, payload);
    this.locationRealtime.emitToUser(couple.user_2.toString(), event, payload);
  }

  private toObjectId(value: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid user id');
    }
    return new Types.ObjectId(value);
  }
}
