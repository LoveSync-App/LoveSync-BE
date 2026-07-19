import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Couple } from '../../couples/schemas/couple.schema';
import { User } from '../../users/schemas/user.schema';

export type LocationDocument = HydratedDocument<Location>;

@Schema({ timestamps: true, versionKey: false })
export class Location {
  @Prop({
    required: true,
    unique: true,
    type: Types.ObjectId,
    ref: User.name,
  })
  user: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: Couple.name,
    index: true,
  })
  couple: Types.ObjectId;

  @Prop({ required: true, default: false, index: true })
  isSharing: boolean;

  @Prop({ type: Number, min: -90, max: 90 })
  latitude?: number;

  @Prop({ type: Number, min: -180, max: 180 })
  longitude?: number;

  @Prop({ type: Number, min: 0 })
  accuracy?: number;

  @Prop({ type: Number, min: 0, max: 360 })
  heading?: number;

  @Prop({ type: Number, min: 0 })
  speed?: number;

  @Prop({ trim: true })
  address?: string;

  @Prop()
  capturedAt?: Date;

  @Prop()
  sharingStartedAt?: Date;

  @Prop({ required: true, default: false })
  untilStopped: boolean;

  @Prop({ index: true })
  sharingExpiresAt?: Date;

  @Prop()
  stoppedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const LocationSchema = SchemaFactory.createForClass(Location);

LocationSchema.index({ couple: 1, isSharing: 1 });
