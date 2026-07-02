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
    unique: true,
    sparse: true,
    trim: true,
    default: undefined,
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

  @Prop()
  lastLoginAt?: Date;

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
