import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { InvitationStatus } from "../enum/invitation-status.enum";

export type InvitationDocument = HydratedDocument<Invitation>;

@Schema()
export class Invitation {
    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: 'User'
    })
    sender: Types.ObjectId;

    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: 'User'
    })
    receiver: Types.ObjectId;

    @Prop({
        required: true,
        type: String,
        enum: InvitationStatus,
        default: InvitationStatus.PENDING
    })
    status: InvitationStatus;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);