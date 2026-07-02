import { CalendarEventSchema } from './calendar-event.schema';

describe('CalendarEventSchema', () => {
  it('uses one event model without confirmation participants', () => {
    expect(CalendarEventSchema.path('type')).toBeDefined();
    expect(CalendarEventSchema.path('recurrence')).toBeDefined();
    expect(CalendarEventSchema.path('location')).toBeDefined();
    expect(CalendarEventSchema.path('reminderMinutesBefore')).toBeDefined();
    expect(CalendarEventSchema.path('status')).toBeUndefined();
    expect(CalendarEventSchema.path('participants')).toBeUndefined();
  });
});
