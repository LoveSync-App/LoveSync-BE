import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Couple } from "../../couples/schemas/couple.schema";
import { AppointmentStatus } from "../enum/appointment-status.enum";
import { Appointment } from "./appointment.schema";
import { User } from "../../users/schemas/user.schema";
import { AppointmentParticipantsStatus } from "../enum/appointment-participants-status.enum";

export type AppointmentParticipantDocument = HydratedDocument<AppointmentParticipant>;


@Schema()
export class AppointmentParticipant{
    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: Appointment.name
    })
    appointment: Types.ObjectId;

    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: User.name
    })
    user: Types.ObjectId;

    @Prop({
        type: String,
        enum: AppointmentParticipantsStatus,
        default: AppointmentParticipantsStatus.PENDING
    })
    status: AppointmentParticipantsStatus;
}

export const AppointmentParticipantSchema = SchemaFactory.createForClass(AppointmentParticipant);