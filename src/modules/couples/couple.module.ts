import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Couple, CoupleSchema } from './schemas/couple.schema';
import { CoupleController } from './couple.controller';
import { CoupleService } from './couple.service';
import { UserModule } from '../users/user.module';
import {
  CouplePeriod,
  CouplePeriodSchema,
} from './schemas/couple_period.schema';
import { Invitation, InvitationSchema } from './schemas/invitation.schema';
import { DeviceModule } from '../device/device.module';
import { NotificationModule } from '../notifications/notification.module';
import {
  CalendarEvent,
  CalendarEventSchema,
} from '../calendar/schemas/calendar-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Couple.name,
        schema: CoupleSchema,
      },
      {
        name: CouplePeriod.name,
        schema: CouplePeriodSchema,
      },
      {
        name: Invitation.name,
        schema: InvitationSchema,
      },
      {
        name: CalendarEvent.name,
        schema: CalendarEventSchema,
      },
    ]),
    UserModule,
    DeviceModule,
    NotificationModule,
  ],
  exports: [MongooseModule],
  controllers: [CoupleController],
  providers: [CoupleService],
})
export class CoupleModule {}
