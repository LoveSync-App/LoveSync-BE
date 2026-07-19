import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCalendarEventDto } from './create-calendar-event.dto';
import { CalendarEventType } from '../enum/calendar-event-type.enum';
import { CalendarRecurrence } from '../enum/calendar-recurrence.enum';

describe('CreateCalendarEventDto', () => {
  it('defaults reminders to 24 hours before and no recurrence', async () => {
    const dto = plainToInstance(CreateCalendarEventDto, {
      type: CalendarEventType.APPOINTMENT,
      title: 'Ăn tối',
      startsAt: '2026-07-10T12:00:00.000Z',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.recurrence).toBe(CalendarRecurrence.NONE);
    expect(dto.reminderEnabled).toBe(true);
    expect(dto.reminderMinutesBefore).toBe(1440);
  });

  it('accepts an important date with yearly recurrence', async () => {
    const dto = plainToInstance(CreateCalendarEventDto, {
      type: CalendarEventType.IMPORTANT_DATE,
      title: 'Ngày kỷ niệm',
      startsAt: '2026-07-10T00:00:00.000Z',
      recurrence: CalendarRecurrence.YEARLY,
      reminderMinutesBefore: 10080,
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
