import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Appointment } from "./appointment.schema";

export type AppointmentReminderDocument = HydratedDocument<AppointmentReminder>;

@Schema()
export class AppointmentReminder {
    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: Appointment.name
    })
    appointment: Types.ObjectId;

    @Prop()
    reminderTime: Date; 
}
export const AppointmentReminderSchema = SchemaFactory.createForClass(AppointmentReminder);