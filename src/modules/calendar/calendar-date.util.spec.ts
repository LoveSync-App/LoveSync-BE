import {
  getNextReminderSchedule,
  getOccurrencesInRange,
} from './calendar-date.util';
import { CalendarRecurrence } from './enum/calendar-recurrence.enum';

describe('calendar date utilities', () => {
  it('expands an important date yearly inside a calendar range', () => {
    const occurrences = getOccurrencesInRange(
      new Date('2024-07-10T08:00:00.000Z'),
      CalendarRecurrence.YEARLY,
      new Date('2026-07-01T00:00:00.000Z'),
      new Date('2026-07-31T23:59:59.999Z'),
    );

    expect(occurrences).toEqual([new Date('2026-07-10T08:00:00.000Z')]);
  });

  it('defaults a reminder to exactly 24 hours before', () => {
    const schedule = getNextReminderSchedule(
      new Date('2026-07-10T08:00:00.000Z'),
      CalendarRecurrence.NONE,
      1440,
      new Date('2026-07-01T00:00:00.000Z'),
    );

    expect(schedule?.reminderAt).toEqual(new Date('2026-07-09T08:00:00.000Z'));
  });

  it('schedules the next year after a recurring reminder is sent', () => {
    const schedule = getNextReminderSchedule(
      new Date('2024-07-10T08:00:00.000Z'),
      CalendarRecurrence.YEARLY,
      1440,
      new Date('2026-07-09T08:01:00.000Z'),
      new Date('2026-07-10T08:00:00.000Z'),
    );

    expect(schedule?.occurrenceAt).toEqual(
      new Date('2027-07-10T08:00:00.000Z'),
    );
  });
});
