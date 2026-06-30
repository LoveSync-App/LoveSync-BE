import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  TrackType,
  WebhookEvent,
  WebhookReceiver,
} from 'livekit-server-sdk';
import { Model, Types } from 'mongoose';
import { Couple, CoupleDocument } from '../couples/schemas/couple.schema';
import { CoupleStatus } from '../couples/enum/couple-status.enum';
import { Device, DeviceDocument } from '../device/schema/device.schema';
import { NotificationService } from '../notifications/notification_service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CallGateway } from './call.gateway';
import {
  getAllowedPublishSources,
  getMediaCapabilities,
} from './call-media.util';
import { CallHistoryQueryDto } from './dto/call-history-query.dto';
import { CreateCallDto } from './dto/create-call.dto';
import { ACTIVE_CALL_STATUSES, CallStatus } from './enum/call-status.enum';
import { CallType } from './enum/call-type.enum';
import { Call, CallDocument } from './schemas/call.schema';

type LiveKitClients = {
  url: string;
  apiKey: string;
  apiSecret: string;
  roomService: RoomServiceClient;
  webhookReceiver: WebhookReceiver;
};

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);
  private liveKitClients?: LiveKitClients;

  public constructor(
    private readonly configService: ConfigService,
    @InjectModel(Call.name)
    private readonly callModel: Model<CallDocument>,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    private readonly notificationService: NotificationService,
    private readonly callGateway: CallGateway,
  ) {}

  async create(userId: string, dto: CreateCallDto) {
    const callerId = this.toObjectId(userId);
    await this.expireStaleRingingCalls();

    const couple = await this.coupleModel.findOne({
      $or: [{ user_1: callerId }, { user_2: callerId }],
      status: CoupleStatus.ACTIVE,
    });
    if (!couple) {
      throw new NotFoundException('Active couple not found');
    }

    const existingCall = await this.callModel.findOne({
      couple: couple._id,
      status: { $in: ACTIVE_CALL_STATUSES },
    });
    if (existingCall) {
      throw new ConflictException({
        message: 'This couple already has an active call',
        callId: existingCall._id,
      });
    }

    const calleeId = couple.user_1.equals(callerId)
      ? couple.user_2
      : couple.user_1;
    const [caller, callee] = await Promise.all([
      this.userModel.findById(callerId).select('name avatar').lean(),
      this.userModel.findById(calleeId).select('name avatar').lean(),
    ]);
    if (!caller || !callee) {
      throw new NotFoundException('Call participant not found');
    }

    const roomName = `call_${couple._id.toString()}_${new Types.ObjectId().toString()}`;
    const { roomService } = this.getLiveKitClients();

    try {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: this.ringTimeoutSeconds,
        departureTimeout: 10,
        maxParticipants: 2,
        metadata: JSON.stringify({
          coupleId: couple._id.toString(),
          type: dto.type,
        }),
      });
    } catch (error) {
      this.logger.error('Could not create LiveKit room', error);
      throw new ServiceUnavailableException('LiveKit service is unavailable');
    }

    let call: CallDocument;
    try {
      call = await this.callModel.create({
        couple: couple._id,
        caller: callerId,
        callee: calleeId,
        roomName,
        type: dto.type,
        status: CallStatus.RINGING,
        active: true,
      });
    } catch (error) {
      await roomService.deleteRoom(roomName).catch(() => undefined);
      if (this.isMongoDuplicateKeyError(error)) {
        throw new ConflictException('This couple already has an active call');
      }
      throw error;
    }

    const token = await this.createParticipantToken(call, caller);
    const callPayload = call.toObject();
    this.callGateway.emitToUser(
      calleeId.toString(),
      'call:incoming',
      callPayload,
    );
    this.callGateway.emitToUser(
      callerId.toString(),
      'call:ringing',
      callPayload,
    );
    void this.sendIncomingCallNotification(calleeId, caller.name, call);

    return this.withConnection(callPayload, token, call.type);
  }

  async accept(userId: string, callId: string) {
    const calleeId = this.toObjectId(userId);
    await this.expireStaleRingingCalls();

    const call = await this.callModel.findOneAndUpdate(
      {
        _id: this.toObjectId(callId, 'Invalid call id'),
        callee: calleeId,
        status: CallStatus.RINGING,
      },
      {
        $set: {
          status: CallStatus.ONGOING,
          answeredAt: new Date(),
        },
      },
      { new: true },
    );
    if (!call) {
      await this.throwCallTransitionError(calleeId, callId, 'accept');
    }

    const callee = await this.userModel
      .findById(calleeId)
      .select('name avatar')
      .lean();
    if (!callee) {
      throw new NotFoundException('User not found');
    }

    const token = await this.createParticipantToken(call, callee);
    const payload = call.toObject();
    this.emitToParticipants(call, 'call:accepted', payload);
    return this.withConnection(payload, token, call.type);
  }

  async reject(userId: string, callId: string) {
    return this.finishRingingCall(
      userId,
      callId,
      'callee',
      CallStatus.REJECTED,
      'call:rejected',
    );
  }

  async cancel(userId: string, callId: string) {
    return this.finishRingingCall(
      userId,
      callId,
      'caller',
      CallStatus.CANCELED,
      'call:canceled',
    );
  }

  async end(userId: string, callId: string) {
    const participantId = this.toObjectId(userId);
    const id = this.toObjectId(callId, 'Invalid call id');
    const existingCall = await this.findParticipantCall(participantId, id);
    if (existingCall.status !== CallStatus.ONGOING) {
      throw new ConflictException('Only an ongoing call can be ended');
    }

    const endedAt = new Date();
    const call = await this.callModel.findOneAndUpdate(
      { _id: id, status: CallStatus.ONGOING },
      {
        $set: {
          status: CallStatus.ENDED,
          active: false,
          endedAt,
          endedBy: participantId,
          durationSeconds: this.calculateDuration(
            existingCall.answeredAt,
            endedAt,
          ),
        },
      },
      { new: true },
    );
    if (!call) {
      throw new ConflictException('Call has already ended');
    }

    const payload = call.toObject();
    this.emitToParticipants(call, 'call:ended', payload);
    await this.deleteLiveKitRoom(call.roomName);
    return payload;
  }

  async getToken(userId: string, callId: string) {
    const participantId = this.toObjectId(userId);
    await this.expireStaleRingingCalls();
    const call = await this.findParticipantCall(
      participantId,
      this.toObjectId(callId, 'Invalid call id'),
    );

    const isCaller = call.caller.equals(participantId);
    const canJoin =
      call.status === CallStatus.ONGOING ||
      (call.status === CallStatus.RINGING && isCaller);
    if (!canJoin) {
      throw new ConflictException('Participant cannot join this call');
    }

    const participant = await this.userModel
      .findById(participantId)
      .select('name avatar')
      .lean();
    if (!participant) {
      throw new NotFoundException('User not found');
    }

    const token = await this.createParticipantToken(call, participant);
    return this.withConnection(call.toObject(), token, call.type);
  }

  async getActive(userId: string) {
    const participantId = this.toObjectId(userId);
    await this.expireStaleRingingCalls();
    return this.callModel
      .findOne({
        $or: [{ caller: participantId }, { callee: participantId }],
        status: { $in: ACTIVE_CALL_STATUSES },
      })
      .lean();
  }

  async getById(userId: string, callId: string) {
    return (
      await this.findParticipantCall(
        this.toObjectId(userId),
        this.toObjectId(callId, 'Invalid call id'),
      )
    ).toObject();
  }

  async getParticipants(userId: string, callId: string) {
    const participantId = this.toObjectId(userId);
    const call = await this.findParticipantCall(
      participantId,
      this.toObjectId(callId, 'Invalid call id'),
    );
    if (
      call.status !== CallStatus.RINGING &&
      call.status !== CallStatus.ONGOING
    ) {
      throw new ConflictException('Call is no longer active');
    }

    try {
      const participants =
        await this.getLiveKitClients().roomService.listParticipants(
          call.roomName,
        );
      return participants.map((participant) => ({
        sid: participant.sid,
        identity: participant.identity,
        name: participant.name,
        state: participant.state,
        joinedAt: participant.joinedAtMs
          ? new Date(Number(participant.joinedAtMs)).toISOString()
          : null,
        isPublisher: participant.isPublisher,
        tracks: participant.tracks.map((track) => this.serializeTrack(track)),
      }));
    } catch (error) {
      this.logger.warn(
        `Could not list participants in room ${call.roomName}: ${error}`,
      );
      throw new ServiceUnavailableException(
        'Could not retrieve LiveKit participants',
      );
    }
  }

  async getHistory(userId: string, query: CallHistoryQueryDto) {
    const participantId = this.toObjectId(userId);
    await this.expireStaleRingingCalls();
    const filter = {
      $or: [{ caller: participantId }, { callee: participantId }],
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.callModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      this.callModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async handleWebhook(rawBody?: string, authorization?: string) {
    if (!rawBody) {
      throw new BadRequestException('Raw webhook body is required');
    }

    let event: WebhookEvent;
    try {
      event = await this.getLiveKitClients().webhookReceiver.receive(
        rawBody,
        authorization,
      );
    } catch {
      throw new ForbiddenException('Invalid LiveKit webhook signature');
    }

    const roomName = event.room?.name;
    if (!roomName) {
      return { received: true };
    }

    if (
      (event.event === 'track_published' ||
        event.event === 'track_unpublished') &&
      event.participant?.identity &&
      event.track
    ) {
      const call = await this.callModel.findOne({
        roomName,
        status: { $in: ACTIVE_CALL_STATUSES },
      });
      if (call) {
        this.emitToParticipants(call, 'call:media-updated', {
          callId: call._id.toString(),
          participantId: event.participant.identity,
          action:
            event.event === 'track_published' ? 'published' : 'unpublished',
          track: this.serializeTrack(event.track),
        });
      }
    }

    if (
      event.event === 'participant_left' ||
      event.event === 'participant_connection_aborted' ||
      event.event === 'room_finished'
    ) {
      const call = await this.callModel.findOne({
        roomName,
        status: { $in: ACTIVE_CALL_STATUSES },
        lastWebhookEventId: { $ne: event.id },
      });

      if (call) {
        const endedAt = new Date(Number(event.createdAt) * 1000);
        const status =
          call.status === CallStatus.ONGOING
            ? CallStatus.ENDED
            : CallStatus.MISSED;
        call.status = status;
        call.active = false;
        call.endedAt = endedAt;
        call.durationSeconds = this.calculateDuration(call.answeredAt, endedAt);
        call.lastWebhookEventId = event.id;
        await call.save();
        this.emitToParticipants(
          call,
          status === CallStatus.ENDED ? 'call:ended' : 'call:missed',
          call.toObject(),
        );
      }
    }

    return { received: true };
  }

  private async finishRingingCall(
    userId: string,
    callId: string,
    role: 'caller' | 'callee',
    status: CallStatus,
    event: string,
  ) {
    const participantId = this.toObjectId(userId);
    const id = this.toObjectId(callId, 'Invalid call id');
    const roleFilter =
      role === 'caller' ? { caller: participantId } : { callee: participantId };
    const endedAt = new Date();
    const call = await this.callModel.findOneAndUpdate(
      {
        _id: id,
        ...roleFilter,
        status: CallStatus.RINGING,
      },
      {
        $set: {
          status,
          active: false,
          endedAt,
          endedBy: participantId,
        },
      },
      { new: true },
    );
    if (!call) {
      await this.throwCallTransitionError(participantId, callId, role);
    }

    const payload = call.toObject();
    this.emitToParticipants(call, event, payload);
    await this.deleteLiveKitRoom(call.roomName);
    return payload;
  }

  private async throwCallTransitionError(
    participantId: Types.ObjectId,
    callId: string,
    action: string,
  ): Promise<never> {
    const call = await this.callModel.findById(
      this.toObjectId(callId, 'Invalid call id'),
    );
    if (!call) {
      throw new NotFoundException('Call not found');
    }
    if (
      !call.caller.equals(participantId) &&
      !call.callee.equals(participantId)
    ) {
      throw new ForbiddenException('You are not a participant in this call');
    }
    throw new ConflictException(
      `Call cannot be ${action}ed in its current state`,
    );
  }

  private async findParticipantCall(
    participantId: Types.ObjectId,
    callId: Types.ObjectId,
  ) {
    const call = await this.callModel.findById(callId);
    if (!call) {
      throw new NotFoundException('Call not found');
    }
    if (
      !call.caller.equals(participantId) &&
      !call.callee.equals(participantId)
    ) {
      throw new ForbiddenException('You are not a participant in this call');
    }
    return call;
  }

  private async createParticipantToken(
    call: CallDocument,
    participant: { _id: Types.ObjectId; name: string; avatar?: string },
  ) {
    const { apiKey, apiSecret } = this.getLiveKitClients();
    const token = new AccessToken(apiKey, apiSecret, {
      identity: participant._id.toString(),
      name: participant.name,
      ttl: this.tokenTtlSeconds,
      metadata: JSON.stringify({
        callId: call._id.toString(),
        callType: call.type,
        avatar: participant.avatar ?? '',
      }),
    });
    token.addGrant({
      roomJoin: true,
      room: call.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: getAllowedPublishSources(call.type),
    });
    return token.toJwt();
  }

  private withConnection(
    call: object,
    participantToken: string,
    callType: CallType,
  ) {
    return {
      call,
      livekit: {
        serverUrl: this.getLiveKitClients().url,
        participantToken,
        media: getMediaCapabilities(callType),
      },
    };
  }

  private async expireStaleRingingCalls() {
    const expiredBefore = new Date(Date.now() - this.ringTimeoutSeconds * 1000);
    const staleCalls = await this.callModel.find({
      status: CallStatus.RINGING,
      createdAt: { $lte: expiredBefore },
    });
    if (staleCalls.length === 0) {
      return;
    }

    const endedAt = new Date();
    await this.callModel.updateMany(
      { _id: { $in: staleCalls.map((call) => call._id) } },
      {
        $set: {
          status: CallStatus.MISSED,
          active: false,
          endedAt,
        },
      },
    );
    for (const call of staleCalls) {
      call.status = CallStatus.MISSED;
      call.active = false;
      call.endedAt = endedAt;
      this.emitToParticipants(call, 'call:missed', call.toObject());
      void this.deleteLiveKitRoom(call.roomName);
    }
  }

  private emitToParticipants(
    call: Pick<Call, 'caller' | 'callee'>,
    event: string,
    payload: unknown,
  ) {
    this.callGateway.emitToUser(call.caller.toString(), event, payload);
    this.callGateway.emitToUser(call.callee.toString(), event, payload);
  }

  private async sendIncomingCallNotification(
    calleeId: Types.ObjectId,
    callerName: string,
    call: CallDocument,
  ) {
    try {
      const device = await this.deviceModel.findOne({ user: calleeId }).lean();
      if (!device?.token) {
        return;
      }
      await this.notificationService.sendNotification(
        device.token,
        call.type === CallType.VIDEO ? 'Cuộc gọi video đến' : 'Cuộc gọi đến',
        call.type === CallType.VIDEO
          ? `${callerName} đang gọi video cho bạn`
          : `${callerName} đang gọi cho bạn`,
        {
          type: 'incoming_call',
          callId: call._id.toString(),
          callType: call.type,
          callerId: call.caller.toString(),
        },
      );
    } catch (error) {
      this.logger.warn(`Could not send incoming call notification: ${error}`);
    }
  }

  private async deleteLiveKitRoom(roomName: string) {
    try {
      await this.getLiveKitClients().roomService.deleteRoom(roomName);
    } catch (error) {
      this.logger.warn(`Could not delete LiveKit room ${roomName}: ${error}`);
    }
  }

  private calculateDuration(answeredAt?: Date, endedAt = new Date()) {
    if (!answeredAt) {
      return 0;
    }
    return Math.max(
      0,
      Math.floor((endedAt.getTime() - answeredAt.getTime()) / 1000),
    );
  }

  private serializeTrack(track: {
    sid: string;
    name: string;
    type: TrackType;
    source: TrackSource;
    muted: boolean;
    width: number;
    height: number;
  }) {
    return {
      sid: track.sid,
      name: track.name,
      kind:
        track.type === TrackType.VIDEO
          ? 'video'
          : track.type === TrackType.AUDIO
            ? 'audio'
            : 'data',
      source: this.serializeTrackSource(track.source),
      muted: track.muted,
      width: track.width,
      height: track.height,
    };
  }

  private serializeTrackSource(source: TrackSource) {
    switch (source) {
      case TrackSource.CAMERA:
        return 'camera';
      case TrackSource.MICROPHONE:
        return 'microphone';
      case TrackSource.SCREEN_SHARE:
        return 'screen_share';
      case TrackSource.SCREEN_SHARE_AUDIO:
        return 'screen_share_audio';
      default:
        return 'unknown';
    }
  }

  private getLiveKitClients(): LiveKitClients {
    if (this.liveKitClients) {
      return this.liveKitClients;
    }
    const url = this.configService.get<string>('LIVEKIT_URL')?.trim();
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY')?.trim();
    const apiSecret = this.configService
      .get<string>('LIVEKIT_API_SECRET')
      ?.trim();
    if (!url || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'LiveKit is not configured on the server',
      );
    }

    this.liveKitClients = {
      url,
      apiKey,
      apiSecret,
      roomService: new RoomServiceClient(url, apiKey, apiSecret),
      webhookReceiver: new WebhookReceiver(apiKey, apiSecret),
    };
    return this.liveKitClients;
  }

  private toObjectId(value: string, message = 'Invalid user id') {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(message);
    }
    return new Types.ObjectId(value);
  }

  private get ringTimeoutSeconds() {
    return this.getPositiveConfigNumber('CALL_RING_TIMEOUT_SECONDS', 60);
  }

  private get tokenTtlSeconds() {
    return this.getPositiveConfigNumber('LIVEKIT_TOKEN_TTL_SECONDS', 900);
  }

  private getPositiveConfigNumber(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  private isMongoDuplicateKeyError(error: unknown): error is { code: number } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }
}
