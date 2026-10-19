import { DatabaseError } from '../../../database/errors.js';

export const DAY = 86400000;
const pad = (/** @type {number} */ value) => String(value).padStart(2, '0');
/** Civil arithmetic uses UTC as a calculator, never as the stored timezone. @param {string} date */
export function civilDate(date) { return new Date(`${date}T00:00:00.000Z`); }
/** @param {Date} date */
export function dateKey(date) { return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`; }
/** @param {Date} [now] */
export function localToday(now = new Date()) { return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`; }
/** @param {string} date @param {number} amount */
export function addDays(date, amount) { return dateKey(new Date(civilDate(date).getTime() + amount * DAY)); }
/** @param {number} year @param {number} month Zero-based month. */
export function monthLength(year, month) { return new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); }
/** @param {string} date @param {number} amount */
export function addMonths(date, amount) {
  const value = civilDate(date); const month = value.getUTCMonth() + amount;
  const target = new Date(Date.UTC(value.getUTCFullYear(), month, 1));
  target.setUTCDate(Math.min(value.getUTCDate(), monthLength(target.getUTCFullYear(), target.getUTCMonth())));
  return dateKey(target);
}
/** @param {string} date @param {boolean} [endBoundary] */
export function validateDate(date, endBoundary = false) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1900-01-01' || date > (endBoundary ? '9999-12-31' : '9998-12-31') || !Number.isFinite(civilDate(date).getTime()) || dateKey(civilDate(date)) !== date) throw new DatabaseError('VALIDATION', 'Choose a valid date in YYYY-MM-DD format (1900–9998).');
  return date;
}
/** @param {string} value @param {boolean} [wallClock] @param {boolean} [endBoundary] */
export function validateLocal(value, wallClock = true, endBoundary = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new DatabaseError('VALIDATION', 'Use a valid date and a 24-hour HH:mm time.');
  validateDate(value.slice(0,10),endBoundary);
  if (!wallClock) return value;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || localToday(parsed) !== value.slice(0,10) || `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` !== value.slice(11)) throw new DatabaseError('VALIDATION', 'This local time does not exist because of a clock change.');
  return value;
}
/** @param {string} local */
export function civilMinutes(local) { return Date.parse(`${local}:00.000Z`) / 60000; }
/** @param {string} start @param {number} minutes */
export function addMinutes(start, minutes) { return new Date((civilMinutes(start) + minutes) * 60000).toISOString().slice(0,16); }
/** @param {string} start @param {string} end */
export function validateRange(start, end) {
  // Month grids may spill outside selectable dates at the supported year edges.
  for (const date of [start,end]) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1899-01-01' || date > '9999-12-31' || !Number.isFinite(civilDate(date).getTime()) || dateKey(civilDate(date)) !== date) throw new DatabaseError('RANGE','Choose valid calendar range dates.');
  }
  const days = (civilDate(end).getTime() - civilDate(start).getTime()) / DAY;
  if (days < 1 || days > 93) throw new DatabaseError('RANGE', 'Choose a calendar range between 1 and 93 days.');
}
/** @param {'month' | 'week' | 'day'} mode @param {string} selected */
export function visibleRange(mode, selected) {
  const date = civilDate(selected);
  const first = mode === 'month' ? `${selected.slice(0,7)}-01` : selected;
  const start = mode === 'day' ? selected : addDays(first, -civilDate(first).getUTCDay());
  const length = mode === 'month' ? 42 : mode === 'week' ? 7 : 1;
  return { start, end: addDays(start, length), days: Array.from({ length }, (_, index) => addDays(start, index)), label: mode === 'month' ? date.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }) : mode === 'week' ? `Week of ${start}` : selected };
}

/** Week lists the complete queried week; Month/Day focus the selected date.
 * @param {import('./calendarService.js').CalendarEntry[]} entries
 * @param {'month' | 'week' | 'day'} mode @param {string} selected
 */
export function agendaEntries(entries, mode, selected) {
  if (mode === 'week') return entries;
  const end = `${addDays(selected,1)}T00:00`; const start = `${selected}T00:00`;
  return entries.filter((entry) => entry.startLocal < end && entry.endLocal > start);
}
