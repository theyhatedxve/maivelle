import type { CalendarEntry } from '../../features/calendar/services/calendarService.ts';
import { validateLocal } from '../../features/calendar/services/calendarDates.ts';

export const CALENDAR_OWNER = 'maivelle.calendar.v1';
export const CALENDAR_WINDOW_DAYS = 30;
export const CALENDAR_REQUEST_LIMIT = 64;
export type CalendarReminder = { id: string; eventId: string; occurrenceStart: string; at: number };

/** Expand through CalendarService first, so edits, cancellations and recurrence
exceptions use the same effective occurrence as the agenda. Never notify overdue events. */
export function calendarReminderPlan(entries: CalendarEntry[], now: number) {
  const requests: CalendarReminder[] = [];
  for (const entry of entries) {
    if (entry.type !== 'event' || entry.reminderMinutes == null) continue;
    try {
      validateLocal(entry.startLocal);
    } catch {
      // A future recurring wall time may fall in a DST gap. Do not normalize it.
      continue;
    }
    const at = new Date(entry.startLocal).getTime() - entry.reminderMinutes * 60000;
    if (!Number.isFinite(at) || at <= now) continue;
    requests.push({
      id: `${CALENDAR_OWNER}:${entry.instanceId}`,
      eventId: entry.eventId,
      occurrenceStart: entry.occurrenceStart,
      at,
    });
  }
  requests.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return {
    requests: requests.slice(0, CALENDAR_REQUEST_LIMIT),
    limited: requests.length > CALENDAR_REQUEST_LIMIT,
  };
}
