import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Conversation } from './conversation.schema';
import { User } from '../../users/schemas/user.schema';
import { MessageType } from '../enum/message-type.enum';
import { MessageEncryptionAlgorithm } from '../../e2ee/enum/e2ee-algorithm.enum';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ _id: false })
export class MessageEncryption {
  @Prop({ required: true, type: String, enum: MessageEncryptionAlgorithm })
  algorithm: MessageEncryptionAlgorithm.RSA_OAEP_256_A256GCM;

  @Prop({ required: true })
  ciphertext: string;

  @Prop({ required: true })
  iv: string;

  @Prop({ required: true })
  authTag: string;

  @Prop({ required: true })
  senderEncryptedKey: string;

  @Prop({ required: true })
  recipientEncryptedKey: string;

  @Prop({ required: true, min: 1 })
  senderKeyVersion: number;

  @Prop({ required: true, min: 1 })
  recipientKeyVersion: number;
}

const MessageEncryptionSchema = SchemaFactory.createForClass(MessageEncryption);

@Schema({ timestamps: true, versionKey: false })
export class Message {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: Conversation.name,
    index: true,
  })
  conversation: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: User.name,
  })
  sender: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  content: string;

  @Prop({ type: MessageEncryptionSchema })
  encryption?: MessageEncryption;

  @Prop({
    required: true,
    type: String,
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  // ID của dữ liệu nguồn, ví dụ callId; dùng để cập nhật cùng một timeline item.
  @Prop({ type: String })
  entityId?: string;

  // Payload riêng theo type, giúp thêm LOCATION hoặc loại timeline mới sau này.
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  payload: Record<string, unknown>;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Date })
  readAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversation: 1, _id: -1 });
MessageSchema.index(
  { type: 1, entityId: 1 },
  {
    unique: true,
    partialFilterExpression: { entityId: { $exists: true } },
  },
);
