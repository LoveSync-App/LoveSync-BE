import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Conversation } from "./conversation.schema";
import { User } from "../../users/schemas/user.schema";
import { MessageType } from "../enum/message-type.enum";

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true })
export class Message {
    @Prop(
        {
            type: Types.ObjectId,
            ref: Conversation.name
        }
    )
    conversation: Types.ObjectId;

    @Prop(
        {
            type: Types.ObjectId,
            ref: User.name
        }
    )
    sender: Types.ObjectId;

    @Prop()
    content: string;

    @Prop(
        {
            type: String,
            enum: MessageType,
            default: MessageType.TEXT
        }
    )
    type: MessageType;

    @Prop({ default: false })
    isRead: boolean;

    @Prop({ default: Date.now })
    createdAt: Date;

    @Prop({ default: Date.now })
    updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);