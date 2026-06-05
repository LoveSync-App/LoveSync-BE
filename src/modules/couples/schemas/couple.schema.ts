import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { User } from "../../users/schemas/user.schema";
import { CoupleStatus } from "../enum/couple-status.enum";

export type CoupleDocument = HydratedDocument<Couple>;

@Schema({ timestamps: true })
export class Couple {

    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: User.name,
    })
    user_1: Types.ObjectId;

    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: User.name,
    })
    user_2: Types.ObjectId;

    @Prop({
        required: true,
        type: Date,
    })
    start_date: Date;

    @Prop({
        required: true,
        type: String,
        enum: CoupleStatus,
        default: CoupleStatus.ACTIVE,
    })
    status: CoupleStatus;

    createdAt: Date;
    updatedAt: Date;
}

export const CoupleSchema = SchemaFactory.createForClass(Couple);