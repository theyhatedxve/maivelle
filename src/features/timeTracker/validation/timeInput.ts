import { DatabaseError } from '../../../database/errors.ts';
export type ProjectInput = {
  name: string;
  description: string;
  color: string;
  archived: boolean;
};
export type SegmentInput = {
  start: string;
  end: string;
};
export type SessionInput = {
  title: string;
  projectId: string;
  segments: SegmentInput[];
};

export function invalid(message: string): never {
  throw new DatabaseError('VALIDATION', message);
}

export function recordId(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value))
    invalid('Invalid time tracker record ID.');
  return value;
}

export function text(value: unknown, max: number, label: string, required: boolean = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    invalid(`${label} must ${required ? 'contain text and ' : ''}be at most ${max} characters.`);
  return value.trim();
}

export function instant(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value))
    invalid('Use a UTC timestamp such as 2026-10-20T09:00:00.000Z.');
  const ms = Date.parse(value);
  if (!Number.isSafeInteger(ms) || ms < 0 || new Date(ms).toISOString() !== value)
    invalid('Invalid UTC date or time.');
  return ms;
}

export function projectInput(input: ProjectInput) {
  if (!input || typeof input !== 'object') invalid('Provide activity details.');
  const name = text(input.name, 120, 'Activity name');
  const description = text(input.description, 2000, 'Description', false);
  if (!/^#[0-9a-f]{6}$/i.test(input.color) || typeof input.archived !== 'boolean')
    invalid('Choose a valid activity color and archive state.');
  return { name, description, color: input.color, archived: input.archived };
}

export function sessionInput(input: SessionInput, now: number) {
  if (!input || typeof input !== 'object') invalid('Provide session details.');
  const title = text(input.title, 240, 'Session title');
  const projectId = recordId(input.projectId);
  if (!Array.isArray(input.segments) || !input.segments.length || input.segments.length > 1000)
    invalid('Provide between 1 and 1000 time segments.');
  let previousEnd = -1;
  const segments = input.segments.map((segment) => {
    const start = instant(segment.start);
    const end = instant(segment.end);
    if (end < start || start < previousEnd || end > now)
      invalid('Segments must be ordered, non-overlapping, nonnegative and not in the future.');
    previousEnd = end;
    return { start, end };
  });
  return { title, projectId, segments };
}
