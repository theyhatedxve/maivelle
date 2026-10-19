import { DatabaseError } from '../../../database/errors.js';
import { addDays, validateLocal, validateRange } from './calendarDates.js';
import { expandEvent } from './recurrence.js';
import { calendarId, validateEventInput, validateRule } from '../validation/eventInput.js';

/** @typedef {import('./recurrence.js').Occurrence & {type: 'event'}} EventEntry */
/** @typedef {import('../../../database/repositories/tasksRepository.js').Task & {type: 'task', instanceId: string, startLocal: string, endLocal: string, allDay: boolean}} TaskEntry */
/** @typedef {EventEntry | TaskEntry} CalendarEntry */

/** @param {ReturnType<typeof import('../../../database/repositories/calendarRepository.js').createCalendarRepository>} repository @param {ReturnType<typeof import('../../../database/repositories/tasksRepository.js').createTasksRepository>} tasks */
export function createCalendarService(repository, tasks) {
  const listeners = new Set(/** @type {(() => void)[]} */ ([]));
  /** @template T @param {Promise<T>} operation */
  async function changed(operation) { const result = await operation; for (const listener of listeners) listener(); return result; }
  /** @param {string} id */
  async function parent(id) { const event = await repository.getEventById(calendarId(id)); if (!event) throw new DatabaseError('NOT_FOUND', 'This event no longer exists. Return to Calendar.'); return event; }
  /** @param {string} id @param {string} start */
  async function original(id, start) {
    validateLocal(start, false); const event = await parent(id);
    const instance = expandEvent(event, start.slice(0,10), addDays(start.slice(0,10), 1)).find((item) => item.occurrenceStart === start);
    if (!event.recurrence || !instance) throw new DatabaseError('NOT_FOUND', 'This recurrence occurrence no longer exists.');
    return { event, instance };
  }
  return {
    /** @param {() => void} listener */
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** @param {unknown} input @param {unknown} [recurrence] */
    async createEvent(input, recurrence = null) { const event = validateEventInput(input); return changed(repository.createEvent(event, validateRule(recurrence, event.startLocal))); },
    /** @param {string} id */
    async getEventById(id) { return repository.getEventById(calendarId(id)); },
    /** @param {string} id @param {unknown} input @param {unknown} recurrence */
    async updateEvent(id, input, recurrence) {
      const event = validateEventInput(input); calendarId(id);
      const result = await repository.updateEvent(id, event, validateRule(recurrence, event.startLocal));
      if (!result) { await parent(id); throw new DatabaseError('EXCEPTIONS_EXIST', 'Restore occurrence exceptions before changing the series schedule or recurrence. Title, description, location and category can still be edited.'); }
      for (const listener of listeners) listener(); return result;
    },
    /** @param {string} id @param {boolean} confirmed */
    async deleteEvent(id, confirmed) { if (confirmed !== true) return false; return changed(repository.deleteEvent(calendarId(id))); },
    /** @param {number} [limit] @param {number} [offset] */
    async listSeries(limit = 50, offset = 0) { if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0) throw new DatabaseError('VALIDATION', 'Invalid calendar pagination.'); return repository.listSeries(limit, offset); },
    listCategories: repository.listCategories,
    /** @param {string} name @param {string} color */
    async createCategory(name, color) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color)) throw new DatabaseError('VALIDATION', 'Enter a category name of 1–80 characters and choose a color.');
      return changed(repository.createCategory(name.trim(), color));
    },
    /** @param {string} id */
    async getRecurrenceRule(id) { return (await parent(id)).recurrence; },
    /** @param {string} id @param {unknown} rule */
    async updateRecurrenceRule(id, rule) {
      const event = await parent(id); const result = await repository.updateRecurrenceRule(id, validateRule(rule, event.startLocal));
      if (!result) throw new DatabaseError('EXCEPTIONS_EXIST', 'Restore occurrence exceptions before changing recurrence.');
      for (const listener of listeners) listener(); return result.recurrence;
    },
    /** @param {string} id @param {unknown} rule */
    async createRecurrenceRule(id, rule) { if ((await parent(id)).recurrence) throw new DatabaseError('CONFLICT', 'This series already has a recurrence rule.'); return this.updateRecurrenceRule(id, rule); },
    /** @param {string} id */
    async deleteRecurrenceRule(id) { return this.updateRecurrenceRule(id, null); },
    /** @param {string} id */
    async listExceptions(id) { return repository.listExceptions(calendarId(id)); },
    /** @param {string} id @param {string} start */
    async getOccurrence(id, start) {
      const { instance } = await original(id, start); const exception = (await repository.listExceptions(id)).find((item) => item.occurrenceStart === start);
      if (exception?.kind === 'cancelled') return { ...instance, cancelled: true };
      return { ...instance, ...exception?.override, overridden: !!exception, cancelled: false };
    },
    /** @param {string} id @param {string} start @param {unknown} input */
    async updateOccurrence(id, start, input) { const { event } = await original(id, start); return changed(repository.putException(event, start, 'edited', validateEventInput(input))); },
    /** @param {string} id @param {string} start @param {boolean} confirmed */
    async cancelOccurrence(id, start, confirmed) { if (confirmed !== true) return false; const { event } = await original(id, start); return changed(repository.putException(event, start, 'cancelled', null)); },
    /** @param {string} id @param {string} start @param {boolean} confirmed */
    async restoreOccurrence(id, start, confirmed) { if (confirmed !== true) return false; calendarId(id); validateLocal(start,false); return changed(repository.deleteException(id, start)); },
    /** @param {string} from @param {string} to @param {string} [search] @returns {Promise<CalendarEntry[]>} */
    async listRange(from, to, search = '') {
      validateRange(from, to); if (typeof search !== 'string' || search.length > 1000) throw new DatabaseError('VALIDATION', 'Search must be at most 1000 characters.');
      const [{ events, exceptions }, deadlines] = await Promise.all([repository.listEventsByDateRange(from, to, addDays(from,-366)), tasks.listCalendarTasks(from,to)]);
      /** @type {CalendarEntry[]} */
      const entries = [];
      for (const event of events) {
        const overrides = exceptions.filter((item) => item.eventId === event.id); const seen = new Set();
        for (const occurrence of expandEvent(event,from,to)) {
          const exception = overrides.find((item) => item.occurrenceStart === occurrence.occurrenceStart); seen.add(occurrence.occurrenceStart);
          if (exception?.kind === 'cancelled') continue;
          const effective = { ...occurrence, ...exception?.override, overridden: !!exception };
          if (effective.startLocal < `${to}T00:00` && effective.endLocal > `${from}T00:00`) entries.push({ ...effective, type: 'event' });
        }
        for (const exception of overrides) {
          if (!seen.has(exception.occurrenceStart) && exception.kind === 'edited' && exception.override && exception.override.startLocal < `${to}T00:00` && exception.override.endLocal > `${from}T00:00`) entries.push({ ...event, ...exception.override, type: 'event', eventId: event.id, occurrenceStart: exception.occurrenceStart, instanceId: `${event.id}@${exception.occurrenceStart}`, overridden: true });
        }
        if (entries.length > 5000) throw new DatabaseError('RANGE', 'Too many calendar occurrences. Narrow the range.');
      }
      for (const task of deadlines) entries.push({ ...task, type: 'task', instanceId: `task:${task.id}`, startLocal: `${task.dueDate}T${task.dueTime ?? '00:00'}`, endLocal: `${addDays(task.dueDate ?? from,1)}T00:00`, allDay: !task.dueTime });
      const query = search.trim().toLocaleLowerCase();
      return entries.filter((entry) => `${entry.title}\n${entry.description}\n${entry.type === 'event' ? entry.location : ''}`.toLocaleLowerCase().includes(query)).sort((a,b) => a.startLocal.localeCompare(b.startLocal) || Number(b.allDay)-Number(a.allDay) || a.instanceId.localeCompare(b.instanceId));
    },
  };
}
