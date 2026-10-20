import { DatabaseError } from '../../../database/errors.js';
import { validateDate } from '../../calendar/services/calendarDates.js';

/** @typedef {{weekdays: number[], times: string[], startDate: string | null, endDate: string | null}} ScheduleInput */
/** @typedef {{name: string, form: string, instructions: string, notes: string, active: boolean, startDate: string | null, endDate: string | null, schedules: ScheduleInput[]}} MedicineInput */
const fail = (/** @type {string} */ message) => { throw new DatabaseError('VALIDATION',message); };
/** @param {unknown} value @param {string} label @param {number} max */
function text(value,label,max) { if (typeof value !== 'string' || value.length>max) return fail(`${label} must be text of at most ${max} characters.`); return value.trim(); }
/** @param {unknown} value */
function optionalDate(value) { return value === null || value === '' || value === undefined ? null : validateDate(/** @type {string} */ (value)); }
/** @param {unknown} value @returns {ScheduleInput} */
export function validateSchedule(value) {
  if (!value || typeof value !== 'object') return fail('Invalid schedule.');
  const item = /** @type {ScheduleInput} */ (value);
  if (!Array.isArray(item.weekdays) || !item.weekdays.length || item.weekdays.some((day) => !Number.isInteger(day) || day<0 || day>6)) return fail('Select at least one weekday.');
  if (!Array.isArray(item.times) || !item.times.length || item.times.length>12 || item.times.some((time) => typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return fail('Enter 1–12 unique times in 24-hour HH:mm format.');
  if (new Set(item.times).size !== item.times.length) return fail('Remove duplicate times from the schedule.');
  const startDate = optionalDate(item.startDate); const endDate = optionalDate(item.endDate);
  if (startDate && endDate && endDate<startDate) return fail('Schedule end date must be on or after its start.');
  return { weekdays:[...new Set(item.weekdays)].sort(), times:[...item.times].sort(), startDate,endDate };
}
/** @param {unknown} value @returns {MedicineInput} */
export function validateMedicine(value) {
  if (!value || typeof value !== 'object') return fail('Invalid medicine form.');
  const item = /** @type {MedicineInput} */ (value);
  const name = text(item.name,'Medicine name',240); if (!name) return fail('Enter a medicine name.');
  if (typeof item.active !== 'boolean' || !Array.isArray(item.schedules) || item.schedules.length>8) return fail('Use at most eight schedules.');
  const startDate = optionalDate(item.startDate); const endDate = optionalDate(item.endDate);
  if (startDate && endDate && endDate<startDate) return fail('Medicine end date must be on or after its start.');
  const schedules = item.schedules.map(validateSchedule);
  for (const schedule of schedules) {
    const first=[startDate,schedule.startDate].filter(Boolean).sort().at(-1);
    const last=[endDate,schedule.endDate].filter(Boolean).sort()[0];
    if(first && last && first>last) return fail('Schedule dates must overlap the medicine dates.');
  }
  const slots = new Set();
  for (const schedule of schedules) for (const day of schedule.weekdays) for (const time of schedule.times) {
    const key = `${day}/${time}`;
    if (slots.has(key)) return fail('Schedules overlap on a weekday and time. Combine them or choose distinct times.');
    slots.add(key);
  }
  return { name,form:text(item.form,'Medication form',120),instructions:text(item.instructions,'Dosage instructions',2000),notes:text(item.notes,'Notes',10000),active:item.active,startDate,endDate,schedules };
}
