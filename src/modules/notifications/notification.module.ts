import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NotificationSchema , Notification } from "./schemas/notification.schema";

@Module({
    imports : [
        MongooseModule.forFeature([
            {
                name: Notification.name,
                schema: NotificationSchema
            }
        ])
    ],
    exports: [
        MongooseModule
    ]
})
export class NotificationModule{}