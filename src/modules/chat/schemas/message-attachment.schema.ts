import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Message } from "./message.schema";

export type MessageAttachmentDocument = HydratedDocument<MessageAttachment>;

@Schema()
export class MessageAttachment {
    @Prop(
        {
            type: Types.ObjectId,
            ref: Message.name
        }
    )
    message: Types.ObjectId;

    @Prop()
    file_url: string;
}

export const MessageAttachmentSchema = SchemaFactory.createForClass(MessageAttachment);