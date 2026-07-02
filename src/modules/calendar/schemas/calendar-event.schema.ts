import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Couple } from '../../couples/schemas/couple.schema';
import { User } from '../../users/schemas/user.schema';
import { CalendarEventType } from '../enum/calendar-event-type.enum';
import { CalendarRecurrence } from '../enum/calendar-recurrence.enum';

export type CalendarEventDocument = HydratedDocument<CalendarEvent>;

@Schema({
  collection: 'calendar_events',
  timestamps: true,
  versionKey: false,
})
export class CalendarEvent {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: Couple.name,
    index: true,
  })
  couple: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: User.name,
  })
  createdBy: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: CalendarEventType,
    index: true,
  })
  type: CalendarEventType;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ trim: true, default: '', maxlength: 2000 })
  description: string;

  @Prop({ required: true, type: Date, index: true })
  startsAt: Date;

  @Prop({ trim: true, maxlength: 500 })
  location?: string;

  @Prop({
    required: true,
    type: String,
    enum: CalendarRecurrence,
    default: CalendarRecurrence.NONE,
  })
  recurrence: CalendarRecurrence;

  @Prop({ required: true, default: true })
  reminderEnabled: boolean;

  @Prop({ required: true, min: 0, max: 525600, default: 1440 })
  reminderMinutesBefore: number;

  @Prop({ type: Date, index: true })
  nextReminderAt?: Date;

  @Prop({ type: Date })
  nextOccurrenceAt?: Date;

  @Prop({ type: Date })
  lastReminderOccurrenceAt?: Date;

  @Prop({ type: Date })
  reminderClaimedAt?: Date;

  @Prop({ type: Date })
  lastReminderSentAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const CalendarEventSchema = SchemaFactory.createForClass(CalendarEvent);

CalendarEventSchema.index({ couple: 1, startsAt: 1 });
CalendarEventSchema.index({
  reminderEnabled: 1,
  nextReminderAt: 1,
  reminderClaimedAt: 1,
});
