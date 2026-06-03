import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Appointment, AppointmentSchema } from "./schemas/appointment.schema";
import { AppointmentParticipant, AppointmentParticipantSchema } from "./schemas/appointment-participant.schema";
import { AppointmentReminder, AppointmentReminderSchema } from "./schemas/appointment-reminder.schema";

@Module({
    imports: [
        MongooseModule.forFeature(
            [
                {
                    name: Appointment.name,
                    schema: AppointmentSchema
                },
                {
                    name: AppointmentParticipant.name,
                    schema: AppointmentParticipantSchema
                },
                {
                    name: AppointmentReminder.name,
                    schema: AppointmentReminderSchema
                }
            ]
        )
    ],
    exports: [
        MongooseModule
    ]
})
export class AppointmentModule{}