import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserStatus } from '../enum/user-role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true, trim: true, lowercase: true })
    email: string;

    @Prop({ unique: true, sparse: true })
    phone: string;

    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ required: true })
    password: string;

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