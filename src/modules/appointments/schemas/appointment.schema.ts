import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Couple } from "../../couples/schemas/couple.schema";
import { AppointmentStatus } from "../enum/appointment-status.enum";

export type AppointmentDocument = HydratedDocument<Appointment>;


@Schema()
export class Appointment{
    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: Couple.name
    })
    couple: Types.ObjectId;

    @Prop({
        required: true,
    })
    title: string;

    @Prop({
        required: true,
    })
    description: string;

    @Prop({
        required: true,
    })
    location: string;

    @Prop({
        required: true,
    })
    date: Date;

    @Prop({
        type: String,
        enum: AppointmentStatus,
        default: AppointmentStatus.PENDING
    })
    status: AppointmentStatus;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);