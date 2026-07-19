import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Couple } from "../../couples/schemas/couple.schema";

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema()
export class Conversation {
    @Prop(
        {
            type: Types.ObjectId,
            ref: Couple.name
        }
    )
    couple: Types.ObjectId;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
