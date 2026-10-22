import { DatabaseError } from '../../../database/errors.ts';
import { civilMinutes, validateDate, validateLocal } from '../services/calendarDates.ts';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecurrenceRule = {
  frequency: Frequency;
  interval: number;
  weekdays: number[];
  until: string | null;
  count: number | null;
};
export type EventInput = {
  title: string;
  description: string;
  location: string;
  startLocal: string;
  endLocal: string;
  allDay: boolean;
  categoryId: string | null;
  reminderMinutes?: number | null;
};

export const frequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export function calendarId(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value))
    throw new DatabaseError('VALIDATION', 'Invalid calendar identifier.');
  return value;
}

export function validateEventInput(value: unknown): EventInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DatabaseError('VALIDATION', 'Event input must be an object.');
  const input = value as EventInput;
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 240)
    throw new DatabaseError('VALIDATION', 'Enter an event title containing 1 to 240 characters.');
  const description = input.description ?? '';
  const location = input.location ?? '';
  if (
    typeof description !== 'string' ||
    description.length > 100000 ||
    typeof location !== 'string' ||
    location.length > 500
  )
    throw new DatabaseError(
      'VALIDATION',
      'Description allows 100000 characters; location allows 500.',
    );
  if (typeof input.allDay !== 'boolean')
    throw new DatabaseError('VALIDATION', 'Choose timed or all-day event.');
  if (
    input.reminderMinutes != null &&
    ![0, 5, 10, 15, 30, 60, 1440].includes(input.reminderMinutes)
  )
    throw new DatabaseError('VALIDATION', 'Choose a supported reminder time.');
  validateLocal(input.startLocal, !input.allDay);
  validateLocal(input.endLocal, !input.allDay, true);
  const duration = civilMinutes(input.endLocal) - civilMinutes(input.startLocal);
  if (duration <= 0 || duration > 366 * 1440)
    throw new DatabaseError(
      'VALIDATION',
      'Event end must follow its start, with duration at most 366 days.',
    );
  if (input.allDay && (!input.startLocal.endsWith('T00:00') || !input.endLocal.endsWith('T00:00')))
    throw new DatabaseError('VALIDATION', 'All-day events require date-only boundaries.');
  return {
    title: input.title.trim(),
    description,
    location: location.trim(),
    startLocal: input.startLocal,
    endLocal: input.endLocal,
    allDay: input.allDay,
    categoryId: input.categoryId == null ? null : calendarId(input.categoryId),
    reminderMinutes: input.reminderMinutes ?? null,
  };
}

export function validateRule(value: unknown, start: string): RecurrenceRule | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value))
    throw new DatabaseError('VALIDATION', 'Invalid recurrence rule.');
  const input = value as RecurrenceRule;
  if (
    !frequencies.includes(input.frequency) ||
    !Number.isSafeInteger(input.interval) ||
    input.interval < 1 ||
    input.interval > 365
  )
    throw new DatabaseError(
      'VALIDATION',
      'Choose a recurrence frequency and interval from 1 to 365.',
    );
  const weekdays = input.frequency === 'weekly' ? input.weekdays : [];
  if (
    !Array.isArray(weekdays) ||
    (input.frequency === 'weekly' && !weekdays.length) ||
    weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw new DatabaseError('VALIDATION', 'Select at least one weekday for weekly recurrence.');
  const until = input.until || null;
  const count = input.count ?? null;
  if (until) {
    validateDate(until);
    if (until < start.slice(0, 10))
      throw new DatabaseError('VALIDATION', 'Recurrence end cannot precede the event start.');
  }
  if (count !== null && (!Number.isSafeInteger(count) || count < 1 || count > 10000))
    throw new DatabaseError('VALIDATION', 'Occurrence limit must be between 1 and 10000.');
  if (until && count !== null)
    throw new DatabaseError('VALIDATION', 'Use either an end date or occurrence limit, not both.');
  return {
    frequency: input.frequency,
    interval: input.interval,
    weekdays: [...new Set(weekdays)].sort(),
    until,
    count,
  };
}
