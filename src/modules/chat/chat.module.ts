import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MessageAttachment, MessageAttachmentSchema } from "./schemas/message-attachment.schema";
import { Conversation, ConversationSchema } from "./schemas/conversation.schema";
import { Message, MessageSchema } from "./schemas/message.schema";

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: Conversation.name,
                schema: ConversationSchema
            },
            {
                name: Message.name,
                schema: MessageSchema
            },
            {
                name: MessageAttachment.name,
                schema: MessageAttachmentSchema
            }
        ])
    ],
    exports: [
        MongooseModule
    ]
})
export class ChatModule{}