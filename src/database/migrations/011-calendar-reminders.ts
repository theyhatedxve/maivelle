export const calendarReminders: import('../types.ts').Migration = {
  version: 11,
  name: 'calendar-reminder-lead-times',
  sql: `
    ALTER TABLE calendar_events ADD COLUMN reminder_minutes INTEGER
      CHECK(reminder_minutes IS NULL OR reminder_minutes IN (0,5,10,15,30,60,1440));
    ALTER TABLE calendar_event_exceptions ADD COLUMN reminder_minutes INTEGER
      CHECK(reminder_minutes IS NULL OR reminder_minutes IN (0,5,10,15,30,60,1440));
  `,
};
