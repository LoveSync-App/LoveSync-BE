import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Message, MessageDocument } from './schemas/message.schema';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Couple, CoupleDocument } from '../couples/schemas/couple.schema';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { ChatGateway } from './chat.gateway';
import { CoupleStatus } from '../couples/enum/couple-status.enum';
import { UserDocument } from '../users/schemas/user.schema';
import { SendMessageDto } from './dto/send-message.dto';
import {
  MessageAttachment,
  MessageAttachmentDocument,
} from './schemas/message-attachment.schema';
import { MessageType } from './enum/message-type.enum';
import { Device, DeviceDocument } from '../device/schema/device.schema';
import { NotificationService } from '../notifications/notification_service';
import { GetTimelineQueryDto } from './dto/get-timeline-query.dto';
import type { CallTimelineEvent } from './interfaces/call-timeline-event.interface';
import { SendLocationMessageDto } from './dto/send-location-message.dto';
import { E2eeService } from '../e2ee/e2ee.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  public constructor(
    private readonly jwtService: JwtService,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(MessageAttachment.name)
    private readonly messageAttachmentModel: Model<MessageAttachmentDocument>,
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    private readonly notificationService: NotificationService,
    private readonly chatGateway: ChatGateway,
    private readonly e2eeService: E2eeService,
  ) { }

  public async sendMessage(senderId: string, sendMessageDto: SendMessageDto) {
    const senderObjectId = new Types.ObjectId(senderId);
    const content = sendMessageDto.message?.trim() ?? '';
    const encryption = sendMessageDto.encryption;
    const attachmentUrls = this.normalizeAttachmentUrls(sendMessageDto);

    if (content && encryption) {
      throw new BadRequestException(
        'Do not send plaintext together with encrypted content',
      );
    }
    if (!content && !encryption && attachmentUrls.length === 0) {
      throw new BadRequestException('Message or attachments is required');
    }

    this.logger.log(`Sending message from senderId: ${senderId}`);
    const couple = await this.coupleModel.findOne({
      $or: [{ user_1: senderObjectId }, { user_2: senderObjectId }],
      status: CoupleStatus.ACTIVE,
    });

    if (!couple) {
      throw new Error('Couple not found');
    }
    const partnerId = couple.user_1.equals(senderObjectId)
      ? couple.user_2
      : couple.user_1;
    const keyVersions = await this.e2eeService.getPairKeyVersions(
      senderId,
      partnerId,
    );
    const bothUsersHaveKeys =
      keyVersions.senderKeyVersion !== undefined &&
      keyVersions.recipientKeyVersion !== undefined;
    if (content && bothUsersHaveKeys) {
      throw new BadRequestException(
        'Encrypted content is required when both users have E2EE keys',
      );
    }
    if (encryption) {
      this.validateEncryptedMessageShape(encryption);
      if (!bothUsersHaveKeys) {
        throw new ConflictException(
          'Both users must configure E2EE keys before encrypted messaging',
        );
      }
      if (
        encryption.senderKeyVersion !== keyVersions.senderKeyVersion ||
        encryption.recipientKeyVersion !== keyVersions.recipientKeyVersion
      ) {
        throw new ConflictException(
          'E2EE key version changed; refresh public keys and encrypt again',
        );
      }
    }
    let conversation = await this.conversationModel.findOne({
      couple: couple._id,
    });

    if (!conversation) {
      conversation = await this.conversationModel.create({
        couple: couple._id,
      });
    }

    const message = new this.messageModel({
      conversation: conversation._id,
      sender: senderObjectId,
      content: encryption ? '' : content,
      encryption,
      type: attachmentUrls.length > 0 ? MessageType.IMAGE : MessageType.TEXT,
    });
    await message.save();

    const attachments =
      attachmentUrls.length > 0
        ? await this.messageAttachmentModel.insertMany(
          attachmentUrls.map((fileUrl) => ({
            message: message._id,
            file_url: fileUrl,
          })),
        )
        : [];

    const response = {
      ...message.toObject(),
      attachments,
    };

    this.chatGateway.sendMessageToConversation(
      conversation._id.toString(),
      response,
    );

    const fcmTokenPartner = await this.deviceModel.findOne({
      user: partnerId,
    });
    const fcmToken = fcmTokenPartner?.token;
    this.logger.log(
      `Sending notification to partner with FCM token: ${fcmToken}`,
    );
    if (fcmToken) {
      const partner = await this.userModel.findById(partnerId);
      if (partner) {
        await this.notificationService.sendNotification(
          fcmToken,
          'LoveSync',
          `${partner.name} vừa gửi tin nhắn cho bạn`,
        );
      }
    }
    return response;
  }

  private validateEncryptedMessageShape(
    encryption: NonNullable<SendMessageDto['encryption']>,
  ) {
    if (Buffer.from(encryption.iv, 'base64').length !== 12) {
      throw new BadRequestException('AES-GCM IV must be exactly 12 bytes');
    }
    if (Buffer.from(encryption.authTag, 'base64').length !== 16) {
      throw new BadRequestException(
        'AES-GCM authentication tag must be exactly 16 bytes',
      );
    }
    if (
      Buffer.from(encryption.senderEncryptedKey, 'base64').length < 256 ||
      Buffer.from(encryption.recipientEncryptedKey, 'base64').length < 256
    ) {
      throw new BadRequestException(
        'RSA encrypted message keys must use keys of at least 2048 bits',
      );
    }
  }

  async sendLocationMessage(senderId: string, dto: SendLocationMessageDto) {
    const senderObjectId = new Types.ObjectId(senderId);
    const couple = await this.coupleModel.findOne({
      $or: [{ user_1: senderObjectId }, { user_2: senderObjectId }],
      status: CoupleStatus.ACTIVE,
    });
    if (!couple) {
      throw new NotFoundException('Active couple not found');
    }

    let conversation = await this.conversationModel.findOne({
      couple: couple._id,
    });
    if (!conversation) {
      conversation = await this.conversationModel.create({
        couple: couple._id,
      });
    }

    const message = await this.messageModel.create({
      conversation: conversation._id,
      sender: senderObjectId,
      content: dto.label?.trim() || dto.address?.trim() || '',
      type: MessageType.LOCATION,
      payload: {
        mode: 'snapshot',
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
        heading: dto.heading ?? null,
        speed: dto.speed ?? null,
        address: dto.address?.trim() || null,
        label: dto.label?.trim() || null,
        capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(),
      },
    });
    const response = {
      ...message.toObject(),
      attachments: [],
    };
    this.chatGateway.sendMessageToConversation(
      conversation._id.toString(),
      response,
    );
    const partnerId = couple.user_1.equals(senderObjectId)
      ? couple.user_2
      : couple.user_1;
    const [partnerDevice, sender] = await Promise.all([
      this.deviceModel.findOne({ user: partnerId }).lean(),
      this.userModel.findById(senderObjectId).select('name').lean(),
    ]);
    if (partnerDevice?.token && sender) {
      void this.notificationService
        .sendNotification(
          partnerDevice.token,
          'LoveSync',
          `${sender.name} đã gửi một vị trí cho bạn`,
          {
            type: 'location_message',
            messageId: message._id.toString(),
            senderId,
          },
        )
        .catch((error: unknown) => {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'string'
                ? error
                : 'Unknown error';
          this.logger.warn(
            `Could not send location message notification: ${message}`,
          );
        });
    }
    return response;
  }

  async getMessagesForUser(userId: string, query: GetTimelineQueryDto) {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const couple = await this.coupleModel.findOne({
      $or: [{ user_1: userObjectId }, { user_2: userObjectId }],
      status: CoupleStatus.ACTIVE,
    });
    if (!couple) {
      throw new NotFoundException('Active couple not found');
    }

    const conversation = await this.conversationModel.findOne({
      couple: couple._id,
    });
    if (!conversation) {
      return {
        items: [],
        pageInfo: {
          hasMore: false,
          nextCursor: null,
        },
      };
    }

    const filter: {
      conversation: Types.ObjectId;
      _id?: { $lt: Types.ObjectId };
    } = {
      conversation: conversation._id,
    };
    if (query.cursor) {
      filter._id = {
        $lt: new Types.ObjectId(query.cursor),
      };
    }
    const documents = await this.messageModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + 1);
    const hasMore = documents.length > query.limit;
    const messages = hasMore ? documents.slice(0, query.limit) : documents;

    const attachments = await this.messageAttachmentModel.find({
      message: { $in: messages.map((message) => message._id) },
    });

    const items = messages.map((message) => ({
      ...message.toObject(),
      attachments: attachments.filter(
        (attachment) =>
          attachment.message.toString() === message._id.toString(),
      ),
    }));

    return {
      items,
      pageInfo: {
        hasMore,
        nextCursor:
          hasMore && items.length > 0
            ? items[items.length - 1]._id.toString()
            : null,
      },
    };
  }

  async syncCallTimelineItem(event: CallTimelineEvent) {
    const coupleId = new Types.ObjectId(event.coupleId);
    let conversation = await this.conversationModel.findOne({
      couple: coupleId,
    });
    if (!conversation) {
      conversation = await this.conversationModel.create({
        couple: coupleId,
      });
    }

    const payload = {
      callId: event.callId,
      callType: event.callType,
      status: event.status,
      result: this.getCallResult(event.status),
      callerId: event.callerId,
      calleeId: event.calleeId,
      durationSeconds: event.durationSeconds,
      answeredAt: event.answeredAt ?? null,
      endedAt: event.endedAt ?? null,
    };
    const existing = await this.messageModel.exists({
      type: MessageType.CALL,
      entityId: event.callId,
    });
    const socketEvent = existing ? 'message:updated' : 'message:new';
    const message = await this.messageModel.findOneAndUpdate(
      {
        type: MessageType.CALL,
        entityId: event.callId,
      },
      {
        $set: { payload },
        $setOnInsert: {
          conversation: conversation._id,
          sender: new Types.ObjectId(event.callerId),
          content: '',
          type: MessageType.CALL,
          entityId: event.callId,
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    const response = {
      ...message.toObject(),
      attachments: [],
    };
    this.chatGateway.sendTimelineEvent(
      conversation._id.toString(),
      socketEvent,
      response,
    );
    return response;
  }

  private normalizeAttachmentUrls(sendMessageDto: SendMessageDto): string[] {
    const attachmentUrls = [
      ...(sendMessageDto.attachments ?? []),
      ...(sendMessageDto.attachmentUrls ?? []),
    ];

    return [
      ...new Set(attachmentUrls.map((url) => url.trim()).filter(Boolean)),
    ];
  }

  private getCallResult(status: string): string {
    switch (status) {
      case 'ended':
        return 'completed';
      case 'missed':
        return 'missed';
      case 'rejected':
        return 'rejected';
      case 'canceled':
        return 'canceled';
      default:
        return status;
    }
  }
}
