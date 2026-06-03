import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Couple } from "../../couples/schemas/couple.schema";

export type SpecialDateDocument = HydratedDocument<SpecialDate>;

@Schema()
export class SpecialDate {

    @Prop(
        {
            type: Types.ObjectId,
            ref : Couple.name,
            required: true
        }
    )
    couple: Types.ObjectId;

    @Prop()
    title: string;

    @Prop()
    description: string;

    @Prop()
    date: Date;

    @Prop()
    reminder_before: number;

}

export const SpecialDateSchema = SchemaFactory.createForClass(SpecialDate);