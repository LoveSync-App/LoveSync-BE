import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Couple } from '../../couples/schemas/couple.schema';
import { User } from '../../users/schemas/user.schema';
import { CallStatus } from '../enum/call-status.enum';
import { CallType } from '../enum/call-type.enum';

export type CallDocument = HydratedDocument<Call>;

@Schema({ timestamps: true, versionKey: false })
export class Call {
  @Prop({ required: true, type: Types.ObjectId, ref: Couple.name, index: true })
  couple: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: User.name, index: true })
  caller: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: User.name, index: true })
  callee: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true })
  roomName: string;

  @Prop({
    required: true,
    type: String,
    enum: CallType,
    default: CallType.AUDIO,
  })
  type: CallType;

  @Prop({
    required: true,
    type: String,
    enum: CallStatus,
    default: CallStatus.RINGING,
    index: true,
  })
  status: CallStatus;

  @Prop({ required: true, default: true })
  active: boolean;

  @Prop()
  answeredAt?: Date;

  @Prop()
  endedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: User.name })
  endedBy?: Types.ObjectId;

  @Prop({ min: 0, default: 0 })
  durationSeconds: number;

  @Prop()
  lastWebhookEventId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const CallSchema = SchemaFactory.createForClass(Call);

CallSchema.index({ caller: 1, createdAt: -1 });
CallSchema.index({ callee: 1, createdAt: -1 });
CallSchema.index({ couple: 1, status: 1 });
CallSchema.index(
  { couple: 1, active: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: 'one_active_call_per_couple',
  },
);
