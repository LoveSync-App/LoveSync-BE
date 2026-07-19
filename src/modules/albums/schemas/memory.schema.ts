import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Couple } from '../../couples/schemas/couple.schema';
import { User } from '../../users/schemas/user.schema';

export type MemoryDocument = HydratedDocument<Memory>;

@Schema({ timestamps: true, versionKey: false })
export class Memory {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: Couple.name,
    index: true,
  })
  couple: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: User.name,
  })
  uploader: Types.ObjectId;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, trim: true })
  file_url: string;

  @Prop({ required: true, type: Date, index: true })
  time: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const MemorySchema = SchemaFactory.createForClass(Memory);

MemorySchema.index({ couple: 1, time: -1 });
