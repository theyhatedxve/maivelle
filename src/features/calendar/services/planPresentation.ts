import { addDays, civilDate, civilMinutes } from './calendarDates.ts';
import type { CalendarEntry } from './calendarService.ts';

export function planDateLabel(
  day: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
) {
  return civilDate(day).toLocaleDateString('en-PH', { ...options, timeZone: 'UTC' });
}
export function planTime(local: string) {
  const hours = Number(local.slice(11, 13));
  return `${hours % 12 || 12}:${local.slice(14, 16)} ${hours < 12 ? 'AM' : 'PM'}`;
}
export function planEntryDescription(entry: CalendarEntry) {
  if (entry.type === 'task')
    return entry.allDay ? 'All-day task deadline' : `Due ${planTime(entry.startLocal)}`;
  const start = entry.startLocal.slice(0, 10);
  const end = entry.endLocal.slice(0, 10);
  const shortDate = (day: string) => planDateLabel(day, { month: 'short', day: 'numeric' });
  if (entry.allDay) {
    const lastDay = addDays(end, -1);
    return lastDay === start ? 'All day' : `All day · ${shortDate(start)} – ${shortDate(lastDay)}`;
  }
  return start === end
    ? `${planTime(entry.startLocal)} – ${planTime(entry.endLocal)}`
    : `${shortDate(start)} ${planTime(entry.startLocal)} – ${shortDate(end)} ${planTime(entry.endLocal)}`;
}
/** Planned wall-clock time, not tracked focus time. Merge overlaps and clip to the visible range. */
export function scheduledMinutes(entries: CalendarEntry[], from: string, to: string) {
  const start = civilMinutes(`${from}T00:00`);
  const end = civilMinutes(`${to}T00:00`);
  const intervals = entries
    .filter((item) => item.type === 'event' && !item.allDay)
    .map((item) => [
      Math.max(start, civilMinutes(item.startLocal)),
      Math.min(end, civilMinutes(item.endLocal)),
    ])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let previousEnd = start;
  for (const [a, b] of intervals) {
    total += Math.max(0, b - Math.max(a, previousEnd));
    previousEnd = Math.max(previousEnd, b);
  }
  return total;
}
