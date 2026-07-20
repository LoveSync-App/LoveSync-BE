import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserStatus } from '../enum/user-role.enum';
import { AuthProvider } from '../../auth/enum/auth-provider.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({
    sparse: true,
    trim: true,
    default: " ",
  })
  phone?: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ select: false })
  password?: string;

  @Prop({
    type: [String],
    enum: AuthProvider,
    default: [],
  })
  authProviders: AuthProvider[];

  @Prop({
    unique: true,
    sparse: true,
    select: false,
  })
  firebaseUid?: string;

  @Prop({ select: false })
  activeSessionId?: string;

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ default: false })
  hasE2eeKeys: boolean;

  @Prop({
    type: String,
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Prop()
  avatar: string;

  @Prop()
  code: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
