import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MessageAttachment,
  MessageAttachmentSchema,
} from './schemas/message-attachment.schema';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { CoupleModule } from '../couples/couple.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../users/user.module';
import { NotificationModule } from '../notifications/notification.module';
import { DeviceModule } from '../device/device.module';
import { PresenceModule } from '../presence/presence.module';
import { E2eeModule } from '../e2ee/e2ee.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Conversation.name,
        schema: ConversationSchema,
      },
      {
        name: Message.name,
        schema: MessageSchema,
      },
      {
        name: MessageAttachment.name,
        schema: MessageAttachmentSchema,
      },
    ]),
    CoupleModule,
    AuthModule,
    UserModule,
    NotificationModule,
    DeviceModule,
    PresenceModule,
    E2eeModule,
  ],
  providers: [ChatGateway, ChatService],
  controllers: [ChatController],
  exports: [MongooseModule, ChatService],
})
export class ChatModule {}
