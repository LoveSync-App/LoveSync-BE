import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { User } from "../../users/schemas/user.schema";

export type NotificationDocument = HydratedDocument<Notification>;


@Schema()
export class Notification {
    
    @Prop(
        {
            type: Types.ObjectId,
            ref: User.name,
            required: true
        }
    )
    user: Types.ObjectId;

    @Prop()
    title: string;

    @Prop()
    description: string;

    @Prop({
        type: Boolean,
        default: false
    })
    isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);