import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { CoupleStatus } from '../couples/enum/couple-status.enum';
import { Couple, CoupleDocument } from '../couples/schemas/couple.schema';
import { Device, DeviceDocument } from '../device/schema/device.schema';
import { NotificationService } from '../notifications/notification_service';
import { getNextReminderSchedule } from './calendar-date.util';
import { CalendarEventType } from './enum/calendar-event-type.enum';
import {
  CalendarEvent,
  CalendarEventDocument,
} from './schemas/calendar-event.schema';

@Injectable()
export class CalendarReminderService {
  private readonly logger = new Logger(CalendarReminderService.name);

  public constructor(
    @InjectModel(CalendarEvent.name)
    private readonly eventModel: Model<CalendarEventDocument>,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('0 * * * * *', {
    name: 'calendar-reminders',
    waitForCompletion: true,
  })
  async processDueReminders() {
    const now = new Date();
    const staleClaimBefore = new Date(now.getTime() - 5 * 60 * 1000);
    const dueEvents = await this.eventModel
      .find({
        reminderEnabled: true,
        nextReminderAt: { $lte: now },
        $or: [
          { reminderClaimedAt: { $exists: false } },
          { reminderClaimedAt: { $lte: staleClaimBefore } },
        ],
      })
      .sort({ nextReminderAt: 1 })
      .limit(100);

    for (const event of dueEvents) {
      await this.processEvent(event).catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Calendar reminder ${event._id.toString()} failed: ${message}`,
        );
      });
    }
  }

  private async processEvent(dueEvent: CalendarEventDocument) {
    const claimedAt = new Date();
    const event = await this.eventModel.findOneAndUpdate(
      {
        _id: dueEvent._id,
        nextReminderAt: dueEvent.nextReminderAt,
        $or: [
          { reminderClaimedAt: { $exists: false } },
          {
            reminderClaimedAt: {
              $lte: new Date(claimedAt.getTime() - 5 * 60 * 1000),
            },
          },
        ],
      },
      { $set: { reminderClaimedAt: claimedAt } },
      { new: true },
    );
    if (!event) {
      return;
    }

    const occurrenceAt = event.nextOccurrenceAt ?? event.startsAt;
    try {
      const couple = await this.coupleModel.findOne({
        _id: event.couple,
        status: CoupleStatus.ACTIVE,
      });
      if (!couple) {
        await this.clearReminder(event);
        return;
      }

      const devices = await this.deviceModel.find({
        user: { $in: [couple.user_1, couple.user_2] },
        token: { $exists: true, $ne: '' },
      });
      const results = await Promise.allSettled(
        devices.map((device) =>
          this.notificationService.sendNotification(
            device.token,
            event.type === CalendarEventType.APPOINTMENT
              ? 'Nhắc lịch hẹn'
              : 'Nhắc ngày quan trọng',
            this.createNotificationBody(event, occurrenceAt),
            {
              type: 'calendar_reminder',
              eventId: event._id.toString(),
              eventType: event.type,
              occurrenceAt: occurrenceAt.toISOString(),
            },
          ),
        ),
      );
      if (
        results.length > 0 &&
        results.every((result) => result.status === 'rejected')
      ) {
        throw new Error('All calendar notifications failed');
      }
      await this.completeReminder(event, occurrenceAt);
    } catch (error) {
      await this.eventModel.updateOne(
        { _id: event._id, reminderClaimedAt: claimedAt },
        {
          $set: {
            nextReminderAt: new Date(Date.now() + 5 * 60 * 1000),
          },
          $unset: { reminderClaimedAt: 1 },
        },
      );
      throw error;
    }
  }

  private async completeReminder(
    event: CalendarEventDocument,
    occurrenceAt: Date,
  ) {
    const nextSchedule = getNextReminderSchedule(
      event.startsAt,
      event.recurrence,
      event.reminderMinutesBefore,
      new Date(),
      occurrenceAt,
    );
    const set: Record<string, unknown> = {
      lastReminderOccurrenceAt: occurrenceAt,
      lastReminderSentAt: new Date(),
    };
    if (nextSchedule) {
      set.nextReminderAt = nextSchedule.reminderAt;
      set.nextOccurrenceAt = nextSchedule.occurrenceAt;
    }
    await this.eventModel.updateOne(
      { _id: event._id },
      {
        $set: set,
        $unset: {
          reminderClaimedAt: 1,
          ...(!nextSchedule ? { nextReminderAt: 1, nextOccurrenceAt: 1 } : {}),
        },
      },
    );
  }

  private async clearReminder(event: CalendarEventDocument) {
    await this.eventModel.updateOne(
      { _id: event._id },
      {
        $set: { reminderEnabled: false },
        $unset: {
          nextReminderAt: 1,
          nextOccurrenceAt: 1,
          reminderClaimedAt: 1,
        },
      },
    );
  }

  private createNotificationBody(
    event: CalendarEventDocument,
    occurrenceAt: Date,
  ) {
    const formatted = new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(occurrenceAt);
    return `${event.title} sẽ diễn ra lúc ${formatted}`;
  }
}
