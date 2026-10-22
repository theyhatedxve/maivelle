import { DatabaseError } from '../../../database/errors.ts';
import { validateRule } from '../validation/eventInput.ts';
import {
  DAY,
  addDays,
  addMinutes,
  civilDate,
  civilMinutes,
  dateKey,
  monthLength,
  validateLocal,
  validateRange,
} from './calendarDates.ts';
export type CalendarEvent =
  import('../../../database/repositories/calendarRepository.ts').CalendarEvent;
export type Occurrence = {
  eventId: string;
  occurrenceStart: string;
  instanceId: string;
  overridden: boolean;
} & CalendarEvent;

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

function monthlyCounter(start: string, step: number) {
  const base = civilDate(start);
  const day = base.getUTCDate();
  if (day <= 28) return (index: number) => index + 1;
  const cycle = 4800 / gcd(4800, step);
  const prefix = [0];
  for (let index = 0; index < cycle; index++) {
    const month = base.getUTCFullYear() * 12 + base.getUTCMonth() + index * step;
    prefix.push(prefix[index] + Number(day <= monthLength(Math.floor(month / 12), month % 12)));
  }
  return (index: number) => Math.floor(index / cycle) * prefix[cycle] + prefix[(index % cycle) + 1];
}
/** Pure, bounded civil-time expansion. Invalid month dates are skipped, not clamped. */
export function expandEvent(event: CalendarEvent, from: string, to: string): Occurrence[] {
  validateRange(from, to);
  validateLocal(event.startLocal, false);
  validateLocal(event.endLocal, false, true);
  const duration = civilMinutes(event.endLocal) - civilMinutes(event.startLocal);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 366 * 1440)
    throw new DatabaseError(
      'RANGE',
      'Event duration exceeds the bounded Calendar limit. Investigate this record without resetting data.',
    );
  // Revalidate persisted rules as well as writes: malformed stored intervals
  // must fail before candidate indexing, never turn into an unbounded loop.
  const rule = validateRule(event.recurrence, event.startLocal);
  const candidates = [] as {
    start: string;
    ordinal: number;
  }[];
  const startDate = event.startLocal.slice(0, 10);
  const time = event.startLocal.slice(10);
  const lower = addDays(from, -Math.ceil(duration / 1440));
  if (!rule) candidates.push({ start: event.startLocal, ordinal: 1 });
  else if (rule.frequency === 'monthly' || rule.frequency === 'yearly') {
    const base = civilDate(startDate);
    const first = civilDate(lower);
    const last = civilDate(to);
    const baseMonth = base.getUTCFullYear() * 12 + base.getUTCMonth();
    const step = rule.interval * (rule.frequency === 'yearly' ? 12 : 1);
    const firstIndex = Math.max(
      0,
      Math.floor((first.getUTCFullYear() * 12 + first.getUTCMonth() - baseMonth) / step) - 1,
    );
    const lastIndex = Math.floor(
      (last.getUTCFullYear() * 12 + last.getUTCMonth() - baseMonth) / step,
    );
    const ordinal = monthlyCounter(startDate, step);
    for (let index = firstIndex; index <= lastIndex; index++) {
      const month = baseMonth + index * step;
      const year = Math.floor(month / 12);
      const monthOfYear = month % 12;
      if (base.getUTCDate() > monthLength(year, monthOfYear)) continue;
      candidates.push({
        start: `${dateKey(new Date(Date.UTC(year, monthOfYear, base.getUTCDate())))}${time}`,
        ordinal: ordinal(index),
      });
    }
  } else {
    const anchor = civilDate(startDate);
    const baseWeek = addDays(startDate, -anchor.getUTCDay());
    const ignored = rule.weekdays.filter((day) => day < anchor.getUTCDay()).length;
    // At most 460 civil dates: 93 query days + 366-day maximum event duration.
    for (let day = lower < startDate ? startDate : lower; day < to; day = addDays(day, 1)) {
      const difference = Math.round((civilDate(day).getTime() - anchor.getTime()) / DAY);
      if (rule.frequency === 'daily') {
        if (difference % rule.interval === 0)
          candidates.push({ start: `${day}${time}`, ordinal: difference / rule.interval + 1 });
      } else {
        const week = Math.floor(
          (civilDate(day).getTime() - civilDate(baseWeek).getTime()) / (7 * DAY),
        );
        const weekday = civilDate(day).getUTCDay();
        const position = rule.weekdays.indexOf(weekday);
        if (week % rule.interval === 0 && position !== -1)
          candidates.push({
            start: `${day}${time}`,
            ordinal: (week / rule.interval) * rule.weekdays.length + position - ignored + 1,
          });
      }
    }
  }
  const result = [];
  for (const candidate of candidates) {
    if (
      candidate.start < event.startLocal ||
      (rule?.until && candidate.start.slice(0, 10) > rule.until) ||
      (rule?.count && candidate.ordinal > rule.count)
    )
      continue;
    const end = addMinutes(candidate.start, duration);
    // Floating timed slots with nonexistent DST boundaries are skipped. The
    // slot still consumes COUNT; all-day dates never depend on local midnight.
    if (!event.allDay) {
      try {
        validateLocal(candidate.start);
        validateLocal(end, true, true);
      } catch (error) {
        if (error instanceof DatabaseError && error.code === 'VALIDATION') continue;
        throw error;
      }
    }
    if (candidate.start < `${to}T00:00` && end > `${from}T00:00`)
      result.push({
        ...event,
        startLocal: candidate.start,
        endLocal: end,
        eventId: event.id,
        occurrenceStart: candidate.start,
        instanceId: `${event.id}@${candidate.start}`,
        overridden: false,
      });
    if (result.length > 5000)
      throw new DatabaseError('RANGE', 'Too many calendar occurrences. Narrow the range.');
  }
  return result;
}
