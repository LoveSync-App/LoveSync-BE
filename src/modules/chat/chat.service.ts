import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Message, MessageDocument } from "./schemas/message.schema";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Couple, CoupleDocument } from "../couples/schemas/couple.schema";
import { Model, Types } from "mongoose";
import { Conversation, ConversationDocument } from "./schemas/conversation.schema";
import { ChatGateway } from "./chat.gateway";
import { CoupleStatus } from "../couples/enum/couple-status.enum";
import { UserDocument } from "../users/schemas/user.schema";
import { SendMessageDto } from "./dto/send-message.dto";
import { MessageAttachment, MessageAttachmentDocument } from "./schemas/message-attachment.schema";
import { MessageType } from "./enum/message-type.enum";
import { Device, DeviceDocument } from "../device/schema/device.schema";
import { NotificationService } from "../notifications/notification_service";

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
        @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
        private readonly notificationService: NotificationService,
        private readonly chatGateway: ChatGateway
    ) { }

    public async sendMessage(senderId: string, sendMessageDto: SendMessageDto) {
        const senderObjectId = new Types.ObjectId(senderId);
        const content = sendMessageDto.message?.trim() ?? '';
        const attachmentUrls = this.normalizeAttachmentUrls(sendMessageDto);

        if (!content && attachmentUrls.length === 0) {
            throw new BadRequestException('Message or attachments is required');
        }

        this.logger.log(`Sending message from senderId: ${senderId} with content: ${content}`);
        const couple = await this.coupleModel.findOne({
            $or: [{ user_1: senderObjectId }, { user_2: senderObjectId }],
            status: CoupleStatus.ACTIVE
        });

        if (!couple) {
            throw new Error('Couple not found');
        }
        let conversation = await this.conversationModel.findOne({
            couple: couple._id
        });

        if (!conversation) {
            conversation = await this.conversationModel.create({
                couple: couple._id
            });
        }

        const message = new this.messageModel({
            conversation: conversation._id,
            sender: senderObjectId,
            content: content,
            type: attachmentUrls.length > 0 ? MessageType.IMAGE : MessageType.TEXT
        });
        await message.save();

        const attachments = attachmentUrls.length > 0
            ? await this.messageAttachmentModel.insertMany(
                attachmentUrls.map(fileUrl => ({
                    message: message._id,
                    file_url: fileUrl
                }))
            )
            : [];

        const response = {
            ...message.toObject(),
            attachments
        };

        this.chatGateway.sendMassageToConversation(conversation._id.toString(), response as Message);

        const partnerId = couple.user_1.toString() === senderId ? couple.user_2.toString() : couple.user_1.toString();
        const fcmTokenPartner = await this.deviceModel.findOne({ user: new Types.ObjectId(partnerId) });
        const fcmToken = fcmTokenPartner?.token;
        this.logger.log(`Sending notification to partner with FCM token: ${fcmToken}`);
        if (fcmToken) {
            const partnerId = couple.user_1.toString() === senderId ? couple.user_2.toString() : couple.user_1.toString();
            const partner = await this.userModel.findById(partnerId);
            if (partner) {
                await this.notificationService.sendNotification(
                    fcmToken,
                    "LoveSync",
                    `${partner.name} vừa gửi tin nhắn cho bạn`
                );
            }
        }
    }

    async getMessagesForUser(userId: string) {
        const userObjectId = new Types.ObjectId(userId);
        const user = await this.userModel.findById(userObjectId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const couples = await this.coupleModel.find({
            $or: [{ user_1: userObjectId }, { user_2: userObjectId }],
            status: CoupleStatus.ACTIVE
        });

        const conversation = await this.conversationModel.find({
            couple: { $in: couples.map(couple => couple._id) }
        });

        const messages = await this.messageModel
            .find({
                conversation: { $in: conversation.map(conv => conv._id) }
            })
            .sort({ createdAt: -1 })
            .limit(10);

        const attachments = await this.messageAttachmentModel.find({
            message: { $in: messages.map(message => message._id) }
        });

        return messages.map(message => ({
            ...message.toObject(),
            attachments: attachments.filter(
                attachment => attachment.message.toString() === message._id.toString()
            )
        }));

    }

    private normalizeAttachmentUrls(sendMessageDto: SendMessageDto): string[] {
        const attachmentUrls = [
            ...(sendMessageDto.attachments ?? []),
            ...(sendMessageDto.attachmentUrls ?? [])
        ];

        return [...new Set(attachmentUrls.map(url => url.trim()).filter(Boolean))];
    }
}
