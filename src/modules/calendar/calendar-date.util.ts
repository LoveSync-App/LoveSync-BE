import { CalendarRecurrence } from './enum/calendar-recurrence.enum';

export type ReminderSchedule = {
  occurrenceAt: Date;
  reminderAt: Date;
};

export function getOccurrencesInRange(
  startsAt: Date,
  recurrence: CalendarRecurrence,
  from: Date,
  to: Date,
): Date[] {
  if (recurrence === CalendarRecurrence.NONE) {
    return startsAt >= from && startsAt <= to ? [startsAt] : [];
  }

  const occurrences: Date[] = [];
  const firstYear = Math.max(
    startsAt.getUTCFullYear(),
    from.getUTCFullYear() - 1,
  );
  const lastYear = to.getUTCFullYear() + 1;
  for (let year = firstYear; year <= lastYear; year += 1) {
    const occurrence = createYearlyOccurrence(startsAt, year);
    if (occurrence >= from && occurrence <= to) {
      occurrences.push(occurrence);
    }
  }
  return occurrences;
}

export function getNextReminderSchedule(
  startsAt: Date,
  recurrence: CalendarRecurrence,
  reminderMinutesBefore: number,
  now = new Date(),
  lastReminderOccurrenceAt?: Date,
): ReminderSchedule | null {
  const offsetMs = reminderMinutesBefore * 60 * 1000;
  if (recurrence === CalendarRecurrence.NONE) {
    if (
      startsAt <= now ||
      (lastReminderOccurrenceAt && startsAt <= lastReminderOccurrenceAt)
    ) {
      return null;
    }
    const desiredReminderAt = new Date(startsAt.getTime() - offsetMs);
    return {
      occurrenceAt: startsAt,
      reminderAt: desiredReminderAt > now ? desiredReminderAt : now,
    };
  }

  const firstYear = Math.max(
    startsAt.getUTCFullYear(),
    now.getUTCFullYear() - 1,
  );
  for (let year = firstYear; year <= firstYear + 10; year += 1) {
    const occurrenceAt = createYearlyOccurrence(startsAt, year);
    if (
      occurrenceAt <= now ||
      (lastReminderOccurrenceAt && occurrenceAt <= lastReminderOccurrenceAt)
    ) {
      continue;
    }
    const desiredReminderAt = new Date(occurrenceAt.getTime() - offsetMs);
    return {
      occurrenceAt,
      reminderAt: desiredReminderAt > now ? desiredReminderAt : now,
    };
  }
  return null;
}

function createYearlyOccurrence(startsAt: Date, year: number) {
  const month = startsAt.getUTCMonth();
  const day = Math.min(startsAt.getUTCDate(), daysInUtcMonth(year, month));
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      startsAt.getUTCHours(),
      startsAt.getUTCMinutes(),
      startsAt.getUTCSeconds(),
      startsAt.getUTCMilliseconds(),
    ),
  );
}

function daysInUtcMonth(year: number, zeroBasedMonth: number) {
  return new Date(Date.UTC(year, zeroBasedMonth + 1, 0)).getUTCDate();
}
