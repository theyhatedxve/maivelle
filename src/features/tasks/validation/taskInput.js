import { DatabaseError } from '../../../database/errors.js';

export const priorities = /** @type {const} */ (['low', 'medium', 'high', 'urgent']);
export const statuses = /** @type {const} */ (['todo', 'in_progress', 'completed']);
export const statusLabels = { todo: 'To Do', in_progress: 'In Progress', completed: 'Completed' };
/** @typedef {'low' | 'medium' | 'high' | 'urgent'} Priority */
/** @typedef {'todo' | 'in_progress' | 'completed'} Status */
/** @typedef {{title: string, description: string, priority: Priority, status: Status, dueDate: string | null, dueTime: string | null, categoryId: string | null}} TaskInput */

/** @param {unknown} value */
export function stableId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) throw new DatabaseError('VALIDATION', 'Invalid record identifier.');
  return value;
}
/** @param {unknown} value @param {number} [max] */
export function requiredTitle(value, max = 240) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new DatabaseError('VALIDATION', `Enter a title containing 1 to ${max} characters.`);
  return value.trim();
}
/** @param {unknown} value @returns {Status} */
export function taskStatus(value) {
  if (!statuses.includes(/** @type {Status} */ (value))) throw new DatabaseError('VALIDATION', 'Choose To Do, In Progress or Completed.');
  return /** @type {Status} */ (value);
}
/** @param {unknown} value @returns {TaskInput} */
export function validateTaskInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseError('VALIDATION', 'Task input must be an object.');
  const input = /** @type {TaskInput} */ (value);
  const title = requiredTitle(input.title);
  const description = input.description ?? '';
  if (typeof description !== 'string' || description.length > 100000) throw new DatabaseError('VALIDATION', 'Description must contain at most 100000 characters.');
  const priority = input.priority ?? 'medium';
  if (!priorities.includes(priority)) throw new DatabaseError('VALIDATION', 'Choose Low, Medium, High or Urgent priority.');
  const status = taskStatus(input.status ?? 'todo');
  const dueDate = input.dueDate === '' || input.dueDate == null ? null : input.dueDate;
  const dueTime = input.dueTime === '' || input.dueTime == null ? null : input.dueTime;
  if (dueDate !== null) {
    if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < '1900-01-01' || dueDate > '9999-12-31') throw new DatabaseError('VALIDATION', 'Use a due date in YYYY-MM-DD format (1900–9999).');
    const [year, month, day] = dueDate.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new DatabaseError('VALIDATION', 'Choose a valid calendar date.');
  }
  if (dueTime !== null) {
    if (!dueDate || typeof dueTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) throw new DatabaseError('VALIDATION', 'A due time requires a date and HH:mm format (00:00–23:59).');
    const [year, month, day] = dueDate.split('-').map(Number);
    const [hour, minute] = dueTime.split(':').map(Number);
    const date = new Date(year, month - 1, day, hour, minute);
    if (date.getHours() !== hour || date.getMinutes() !== minute) throw new DatabaseError('VALIDATION', 'This local time does not exist because of a clock change. Choose another time.');
  }
  const categoryId = input.categoryId == null ? null : stableId(input.categoryId);
  return { title, description, priority, status, dueDate, dueTime, categoryId };
}
