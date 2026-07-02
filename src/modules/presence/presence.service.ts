import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CoupleStatus } from '../couples/enum/couple-status.enum';
import { Couple, CoupleDocument } from '../couples/schemas/couple.schema';

export type PresencePayload = {
  userId: string;
  isOnline: boolean;
  connectedAt: Date | null;
  lastSeenAt: Date | null;
};

type PresenceRecord = {
  socketIds: Set<string>;
  isOnline: boolean;
  connectedAt: Date | null;
  lastSeenAt: Date | null;
  offlineTimer?: NodeJS.Timeout;
};

type PresenceListener = (
  userId: string,
  payload: PresencePayload,
) => void | Promise<void>;

@Injectable()
export class PresenceService {
  private readonly records = new Map<string, PresenceRecord>();
  private readonly listeners = new Set<PresenceListener>();
  private readonly gracePeriodMs = 20_000;

  public constructor(
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
  ) {}

  registerConnection(userId: string, socketId: string) {
    const record = this.getOrCreateRecord(userId);
    if (record.offlineTimer) {
      clearTimeout(record.offlineTimer);
      record.offlineTimer = undefined;
    }
    record.socketIds.add(socketId);

    if (!record.isOnline) {
      record.isOnline = true;
      record.connectedAt = new Date();
      void this.notifyListeners(userId);
    }
    return this.toPayload(userId, record);
  }

  unregisterConnection(userId: string, socketId: string) {
    const record = this.records.get(userId);
    if (!record) {
      return;
    }
    record.socketIds.delete(socketId);
    if (record.socketIds.size > 0 || record.offlineTimer) {
      return;
    }

    record.offlineTimer = setTimeout(() => {
      record.offlineTimer = undefined;
      if (record.socketIds.size > 0) {
        return;
      }
      record.isOnline = false;
      record.connectedAt = null;
      record.lastSeenAt = new Date();
      void this.notifyListeners(userId);
    }, this.gracePeriodMs);
    record.offlineTimer.unref();
  }

  getPresence(userId: string): PresencePayload {
    const record = this.records.get(userId);
    return record
      ? this.toPayload(userId, record)
      : {
          userId,
          isOnline: false,
          connectedAt: null,
          lastSeenAt: null,
        };
  }

  async getPartnerPresence(userId: string) {
    const userObjectId = this.toObjectId(userId);
    const couple = await this.getActiveCouple(userObjectId);
    const partnerId = couple.user_1.equals(userObjectId)
      ? couple.user_2
      : couple.user_1;
    return this.getPresence(partnerId.toString());
  }

  subscribe(listener: PresenceListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async notifyListeners(userId: string) {
    const payload = this.getPresence(userId);
    await Promise.allSettled(
      [...this.listeners].map(async (listener) => {
        await listener(userId, payload);
      }),
    );
  }

  private getOrCreateRecord(userId: string) {
    let record = this.records.get(userId);
    if (!record) {
      record = {
        socketIds: new Set(),
        isOnline: false,
        connectedAt: null,
        lastSeenAt: null,
      };
      this.records.set(userId, record);
    }
    return record;
  }

  private toPayload(userId: string, record: PresenceRecord): PresencePayload {
    return {
      userId,
      isOnline: record.isOnline,
      connectedAt: record.isOnline ? record.connectedAt : null,
      lastSeenAt: record.isOnline ? null : record.lastSeenAt,
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

  private toObjectId(value: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid user id');
    }
    return new Types.ObjectId(value);
  }
}
