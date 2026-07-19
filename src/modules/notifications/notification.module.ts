import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  NotificationSchema,
  Notification,
} from './schemas/notification.schema';
import { Device, DeviceSchema } from '../device/schema/device.schema';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification_service';
import { DeviceModule } from '../device/device.module';
import { FirebaseConfigModule } from '../../config/firebase.config';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Notification.name,
        schema: NotificationSchema,
      },
    ]),
    DeviceModule,
    FirebaseConfigModule,
  ],
  exports: [
    // MongooseModule
    NotificationService,
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
