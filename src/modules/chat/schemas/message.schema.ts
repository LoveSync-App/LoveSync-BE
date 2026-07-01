import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Conversation } from './conversation.schema';
import { User } from '../../users/schemas/user.schema';
import { MessageType } from '../enum/message-type.enum';

export type MessageDocument = HydratedDocument<Message>;

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
