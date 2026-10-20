import { DatabaseError } from '../../../database/errors.js';

/** @param {string} message @returns {never} */
export function invalid(message) {
  throw new DatabaseError('VALIDATION', message);
}
/** @param {unknown} value */
export function recordId(value) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)
  )
    invalid('Invalid time tracker record ID.');
  return value;
}
/** @param {unknown} value @param {number} max @param {string} label @param {boolean} [required] */
export function text(value, max, label, required = true) {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    invalid(
      `${label} must ${required ? 'contain text and ' : ''}be at most ${max} characters.`
    );
  return value.trim();
}
/** @param {unknown} value */
export function instant(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
  )
    invalid('Use a UTC timestamp such as 2026-10-20T09:00:00.000Z.');
  const ms = Date.parse(value);
  if (
    !Number.isSafeInteger(ms) ||
    ms < 0 ||
    new Date(ms).toISOString() !== value
  )
    invalid('Invalid UTC date or time.');
  return ms;
}
/** @typedef {{name: string, description: string, color: string, archived: boolean}} ProjectInput */
/** @param {ProjectInput} input */
export function projectInput(input) {
  if (!input || typeof input !== 'object') invalid('Provide activity details.');
  const name = text(input.name, 120, 'Activity name');
  const description = text(input.description, 2000, 'Description', false);
  if (
    !/^#[0-9a-f]{6}$/i.test(input.color) ||
    typeof input.archived !== 'boolean'
  )
    invalid('Choose a valid activity color and archive state.');
  return { name, description, color: input.color, archived: input.archived };
}
/** @typedef {{start: string, end: string}} SegmentInput */
/** @typedef {{title: string, projectId: string, segments: SegmentInput[]}} SessionInput */
/** @param {SessionInput} input @param {number} now */
export function sessionInput(input, now) {
  if (!input || typeof input !== 'object') invalid('Provide session details.');
  const title = text(input.title, 240, 'Session title');
  const projectId = recordId(input.projectId);
  if (
    !Array.isArray(input.segments) ||
    !input.segments.length ||
    input.segments.length > 1000
  )
    invalid('Provide between 1 and 1000 time segments.');
  let previousEnd = -1;
  const segments = input.segments.map((segment) => {
    const start = instant(segment.start);
    const end = instant(segment.end);
    if (end < start || start < previousEnd || end > now)
      invalid(
        'Segments must be ordered, non-overlapping, nonnegative and not in the future.'
      );
    previousEnd = end;
    return { start, end };
  });
  return { title, projectId, segments };
}
