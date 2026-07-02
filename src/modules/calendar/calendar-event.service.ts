import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CoupleStatus } from '../couples/enum/couple-status.enum';
import { Couple, CoupleDocument } from '../couples/schemas/couple.schema';
import {
  getNextReminderSchedule,
  getOccurrencesInRange,
} from './calendar-date.util';
import { CalendarRangeQueryDto } from './dto/calendar-range-query.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CalendarEventType } from './enum/calendar-event-type.enum';
import { CalendarRecurrence } from './enum/calendar-recurrence.enum';
import {
  CalendarEvent,
  CalendarEventDocument,
} from './schemas/calendar-event.schema';

@Injectable()
export class CalendarEventService {
  public constructor(
    @InjectModel(CalendarEvent.name)
    private readonly eventModel: Model<CalendarEventDocument>,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
  ) {}

  async create(userId: string, dto: CreateCalendarEventDto) {
    const userObjectId = this.toObjectId(userId);
    const couple = await this.getActiveCouple(userObjectId);
    this.validateRecurrence(dto.type, dto.recurrence);
    const startsAt = new Date(dto.startsAt);
    const schedule = dto.reminderEnabled
      ? getNextReminderSchedule(
          startsAt,
          dto.recurrence,
          dto.reminderMinutesBefore,
        )
      : null;

    const event = await this.eventModel.create({
      couple: couple._id,
      createdBy: userObjectId,
      type: dto.type,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? '',
      startsAt,
      location: dto.location?.trim() || undefined,
      recurrence: dto.recurrence,
      reminderEnabled: dto.reminderEnabled,
      reminderMinutesBefore: dto.reminderMinutesBefore,
      nextReminderAt: schedule?.reminderAt,
      nextOccurrenceAt: schedule?.occurrenceAt,
    });
    return this.serializeEvent(event);
  }

  async list(userId: string, query: CalendarRangeQueryDto) {
    const userObjectId = this.toObjectId(userId);
    const couple = await this.getActiveCouple(userObjectId);
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (from > to) {
      throw new BadRequestException('from must be before to');
    }
    const maxRangeMs = 5 * 366 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxRangeMs) {
      throw new BadRequestException('Calendar range cannot exceed five years');
    }

    const events = await this.eventModel.find({
      couple: couple._id,
      ...(query.type ? { type: query.type } : {}),
    });
    const items = events.flatMap((event) =>
      getOccurrencesInRange(event.startsAt, event.recurrence, from, to).map(
        (occurrenceAt) => this.serializeEvent(event, occurrenceAt),
      ),
    );
    return items.sort(
      (left, right) =>
        left.occurrenceAt.getTime() - right.occurrenceAt.getTime(),
    );
  }

  async getById(userId: string, eventId: string) {
    const event = await this.findAccessibleEvent(userId, eventId);
    return this.serializeEvent(event);
  }

  async update(userId: string, eventId: string, dto: UpdateCalendarEventDto) {
    const event = await this.findAccessibleEvent(userId, eventId);
    const type = dto.type ?? event.type;
    const recurrence = dto.recurrence ?? event.recurrence;
    this.validateRecurrence(type, recurrence);

    if (dto.type !== undefined) {
      event.type = dto.type;
    }
    if (dto.title !== undefined) {
      event.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      event.description = dto.description.trim();
    }
    if (dto.startsAt !== undefined) {
      event.startsAt = new Date(dto.startsAt);
    }
    if (dto.location !== undefined) {
      event.location = dto.location.trim() || undefined;
    }
    if (dto.recurrence !== undefined) {
      event.recurrence = dto.recurrence;
    }
    if (dto.reminderEnabled !== undefined) {
      event.reminderEnabled = dto.reminderEnabled;
    }
    if (dto.reminderMinutesBefore !== undefined) {
      event.reminderMinutesBefore = dto.reminderMinutesBefore;
    }

    const scheduleIdentityChanged =
      dto.startsAt !== undefined || dto.recurrence !== undefined;
    if (scheduleIdentityChanged) {
      event.lastReminderOccurrenceAt = undefined;
    }
    const schedule = event.reminderEnabled
      ? getNextReminderSchedule(
          event.startsAt,
          event.recurrence,
          event.reminderMinutesBefore,
          new Date(),
          event.lastReminderOccurrenceAt,
        )
      : null;
    event.nextReminderAt = schedule?.reminderAt;
    event.nextOccurrenceAt = schedule?.occurrenceAt;
    event.reminderClaimedAt = undefined;
    await event.save();
    return this.serializeEvent(event);
  }

  async remove(userId: string, eventId: string) {
    const event = await this.findAccessibleEvent(userId, eventId);
    await event.deleteOne();
    return { deleted: true, eventId: event._id.toString() };
  }

  private async findAccessibleEvent(userId: string, eventId: string) {
    const userObjectId = this.toObjectId(userId);
    const id = this.toObjectId(eventId, 'Invalid calendar event id');
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }
    const couple = await this.getActiveCouple(userObjectId);
    if (!event.couple.equals(couple._id)) {
      throw new ForbiddenException(
        'Calendar event does not belong to your couple',
      );
    }
    return event;
  }

  private validateRecurrence(
    type: CalendarEventType,
    recurrence: CalendarRecurrence,
  ) {
    if (
      type === CalendarEventType.APPOINTMENT &&
      recurrence !== CalendarRecurrence.NONE
    ) {
      throw new BadRequestException('Appointments cannot repeat yearly');
    }
  }

  private serializeEvent(
    event: CalendarEventDocument,
    occurrenceAt = event.startsAt,
  ) {
    return {
      _id: event._id,
      couple: event.couple,
      createdBy: event.createdBy,
      type: event.type,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      occurrenceAt,
      occurrenceKey: `${event._id.toString()}:${occurrenceAt.toISOString()}`,
      location: event.location ?? null,
      recurrence: event.recurrence,
      reminderEnabled: event.reminderEnabled,
      reminderMinutesBefore: event.reminderMinutesBefore,
      nextReminderAt: event.nextReminderAt ?? null,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  private async getActiveCouple(userId: Types.ObjectId) {
    const couple = await this.coupleModel.findOne({
      $or: [{ user_1: userId }, { user_2: userId }],
      status: CoupleStatus.ACTIVE,
    });
    if (!couple) {
      throw new NotFoundException('Active couple not found');
    }
    return couple;
  }

  private toObjectId(value: string, message = 'Invalid user id') {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(message);
    }
    return new Types.ObjectId(value);
  }
}
