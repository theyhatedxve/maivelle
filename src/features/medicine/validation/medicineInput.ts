import { DatabaseError } from '../../../database/errors.ts';
import { validateDate } from '../../calendar/services/calendarDates.ts';
export type ScheduleInput = {
  weekdays: number[];
  times: string[];
  startDate: string | null;
  endDate: string | null;
};
export type MedicineInput = {
  name: string;
  form: string;
  instructions: string;
  notes: string;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  schedules: ScheduleInput[];
};

const fail = (message: string) => {
  throw new DatabaseError('VALIDATION', message);
};

function text(value: unknown, label: string, max: number) {
  if (typeof value !== 'string' || value.length > max)
    return fail(`${label} must be text of at most ${max} characters.`);
  return value.trim();
}

function optionalDate(value: unknown) {
  return value === null || value === '' || value === undefined
    ? null
    : validateDate(value as string);
}

export function validateSchedule(value: unknown): ScheduleInput {
  if (!value || typeof value !== 'object') return fail('Invalid schedule.');
  const item = value as ScheduleInput;
  if (
    !Array.isArray(item.weekdays) ||
    !item.weekdays.length ||
    item.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    return fail('Select at least one weekday.');
  if (
    !Array.isArray(item.times) ||
    !item.times.length ||
    item.times.length > 12 ||
    item.times.some((time) => typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
  )
    return fail('Enter 1–12 unique times in 24-hour HH:mm format.');
  if (new Set(item.times).size !== item.times.length)
    return fail('Remove duplicate times from the schedule.');
  const startDate = optionalDate(item.startDate);
  const endDate = optionalDate(item.endDate);
  if (startDate && endDate && endDate < startDate)
    return fail('Schedule end date must be on or after its start.');
  return {
    weekdays: [...new Set(item.weekdays)].sort(),
    times: [...item.times].sort(),
    startDate,
    endDate,
  };
}

export function validateMedicine(value: unknown): MedicineInput {
  if (!value || typeof value !== 'object') return fail('Invalid medicine form.');
  const item = value as MedicineInput;
  const name = text(item.name, 'Medicine name', 240);
  if (!name) return fail('Enter a medicine name.');
  if (
    typeof item.active !== 'boolean' ||
    !Array.isArray(item.schedules) ||
    item.schedules.length > 8
  )
    return fail('Use at most eight schedules.');
  const startDate = optionalDate(item.startDate);
  const endDate = optionalDate(item.endDate);
  if (startDate && endDate && endDate < startDate)
    return fail('Medicine end date must be on or after its start.');
  const schedules = item.schedules.map(validateSchedule);
  for (const schedule of schedules) {
    const first = [startDate, schedule.startDate].filter(Boolean).sort().at(-1);
    const last = [endDate, schedule.endDate].filter(Boolean).sort()[0];
    if (first && last && first > last)
      return fail('Schedule dates must overlap the medicine dates.');
  }
  const slots = new Set();
  for (const schedule of schedules)
    for (const day of schedule.weekdays)
      for (const time of schedule.times) {
        const key = `${day}/${time}`;
        if (slots.has(key))
          return fail(
            'Schedules overlap on a weekday and time. Combine them or choose distinct times.',
          );
        slots.add(key);
      }
  return {
    name,
    form: text(item.form, 'Medication form', 120),
    instructions: text(item.instructions, 'Dosage instructions', 2000),
    notes: text(item.notes, 'Notes', 10000),
    active: item.active,
    startDate,
    endDate,
    schedules,
  };
}
