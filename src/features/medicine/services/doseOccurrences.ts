import { DatabaseError } from '../../../database/errors.ts';
import {
  addDays,
  civilDate,
  localToday,
  validateRange,
  validateLocal,
} from '../../calendar/services/calendarDates.ts';
import { validateSchedule } from '../validation/medicineInput.ts';
export type Schedule = {
  id: string;
  medicineId: string;
  weekdays: number[];
  times: string[];
  startDate: string | null;
  endDate: string | null;
  effectiveFrom: string;
  retiredAt: string | null;
  enabled: boolean;
  current: boolean;
  name: string;
  instructions: string;
};
export type Dose = {
  id: string;
  scheduleId: string;
  medicineId: string;
  local: string;
  scheduledAt: string;
  timezone: string;
  name: string;
  instructions: string;
  status: string;
  actionAt: string | null;
};
export const MISSED_GRACE_MINUTES = 60;
export const MAX_DOSES = 5000;
/** Seconds distinguish a same-minute edit from its already-scheduled dose. */
export function localStamp(now: Date) {
  return `${localToday(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
}

/** Floating device-local times: skip spring gaps, choose the first fall-back instant. */
export function generateDoses(schedules: Schedule[], from: string, to: string, now: Date): Dose[] {
  validateRange(from, to);
  if (schedules.length > 1000)
    throw new DatabaseError(
      'RANGE',
      'Too many schedule revisions for this range. Narrow the date range.',
    );
  const result: Dose[] = [];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'device-local';
  for (const schedule of schedules) {
    validateSchedule(schedule);
    if (!schedule.enabled) continue;
    for (let date = from; date < to; date = addDays(date, 1)) {
      if (
        (schedule.startDate && date < schedule.startDate) ||
        (schedule.endDate && date > schedule.endDate) ||
        !schedule.weekdays.includes(civilDate(date).getUTCDay())
      )
        continue;
      for (const time of schedule.times) {
        const local = `${date}T${time}`;
        const boundary = `${local}:00.000`;
        if (
          boundary < schedule.effectiveFrom ||
          (schedule.retiredAt && boundary >= schedule.retiredAt)
        )
          continue;
        try {
          validateLocal(local);
        } catch {
          continue;
        }
        const instant = new Date(local);
        const scheduledAt = instant.toISOString();
        result.push({
          id: `${schedule.id}/${local}`,
          scheduleId: schedule.id,
          medicineId: schedule.medicineId,
          local,
          scheduledAt,
          timezone,
          name: schedule.name,
          instructions: schedule.instructions,
          status:
            now.getTime() >= instant.getTime() + MISSED_GRACE_MINUTES * 60000
              ? 'missed'
              : now >= instant
                ? 'due'
                : 'pending',
          actionAt: null,
        });
        if (result.length > MAX_DOSES)
          throw new DatabaseError('RANGE', 'Too many doses. Choose a smaller date range.');
      }
    }
  }
  return result.sort((a, b) => a.local.localeCompare(b.local) || a.id.localeCompare(b.id));
}
