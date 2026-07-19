import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CoupleModule } from '../couples/couple.module';
import { DeviceModule } from '../device/device.module';
import { NotificationModule } from '../notifications/notification.module';
import { CalendarEventController } from './calendar-event.controller';
import { CalendarEventService } from './calendar-event.service';
import { CalendarReminderService } from './calendar-reminder.service';
import {
  CalendarEvent,
  CalendarEventSchema,
} from './schemas/calendar-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: CalendarEvent.name,
        schema: CalendarEventSchema,
      },
    ]),
    AuthModule,
    CoupleModule,
    DeviceModule,
    NotificationModule,
  ],
  controllers: [CalendarEventController],
  providers: [CalendarEventService, CalendarReminderService],
  exports: [CalendarEventService],
})
export class CalendarModule {}
