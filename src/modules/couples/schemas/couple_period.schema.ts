import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { CoupleStatus } from "../enum/couple-status.enum";

export type CouplePeriodDocument = HydratedDocument<CouplePeriod>;

@Schema()
export class CouplePeriod {
    
        @Prop({
            required: true,
            type: Date,
        })
        start_date: Date;

        
        @Prop({
            required: true,
            type: Date,
        })
        end_date: Date;

        @Prop(
            {
                required: true,
                type: Types.ObjectId,
                ref: "Couple",
            }
        )
        couple: Types.ObjectId;

        @Prop({
            required: true,
            type: String,
            enum: CoupleStatus,
            default: CoupleStatus.ACTIVE,
        })
        status: CoupleStatus;

}

export const CouplePeriodSchema = SchemaFactory.createForClass(CouplePeriod);