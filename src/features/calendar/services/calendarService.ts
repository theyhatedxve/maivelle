import { DatabaseError } from '../../../database/errors.ts';
import { addDays, validateLocal, validateRange } from './calendarDates.ts';
import { expandEvent } from './recurrence.ts';
import { calendarId, validateEventInput, validateRule } from '../validation/eventInput.ts';
export type EventEntry = import('./recurrence.ts').Occurrence & {
  type: 'event';
};
export type TaskEntry = import('../../../database/repositories/tasksRepository.ts').Task & {
  type: 'task';
  instanceId: string;
  startLocal: string;
  endLocal: string;
  allDay: boolean;
};
export type CalendarEntry = EventEntry | TaskEntry;

/** Civil ISO timestamps and opaque stable IDs need deterministic code-unit order,
not language collation (measured as expensive on Android Hermes). */
export function compareCalendarEntries(
  a: Pick<CalendarEntry, 'startLocal' | 'allDay' | 'instanceId'>,
  b: Pick<CalendarEntry, 'startLocal' | 'allDay' | 'instanceId'>,
) {
  if (a.startLocal !== b.startLocal) return a.startLocal < b.startLocal ? -1 : 1;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.instanceId === b.instanceId ? 0 : a.instanceId < b.instanceId ? -1 : 1;
}

export function createCalendarService(
  repository: ReturnType<
    typeof import('../../../database/repositories/calendarRepository.ts').createCalendarRepository
  >,
  tasks: ReturnType<
    typeof import('../../../database/repositories/tasksRepository.ts').createTasksRepository
  >,
) {
  const listeners = new Set([] as (() => void)[]);

  async function changed<T>(operation: Promise<T>) {
    const result = await operation;
    for (const listener of listeners) listener();
    return result;
  }

  async function parent(id: string) {
    const event = await repository.getEventById(calendarId(id));
    if (!event)
      throw new DatabaseError('NOT_FOUND', 'This event no longer exists. Return to Calendar.');
    return event;
  }

  async function original(id: string, start: string) {
    validateLocal(start, false);
    const event = await parent(id);
    const instance = expandEvent(event, start.slice(0, 10), addDays(start.slice(0, 10), 1)).find(
      (item) => item.occurrenceStart === start,
    );
    if (!event.recurrence || !instance)
      throw new DatabaseError('NOT_FOUND', 'This recurrence occurrence no longer exists.');
    return { event, instance };
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async createEvent(input: unknown, recurrence: unknown = null) {
      const event = validateEventInput(input);
      return changed(repository.createEvent(event, validateRule(recurrence, event.startLocal)));
    },

    async getEventById(id: string) {
      return repository.getEventById(calendarId(id));
    },

    async updateEvent(id: string, input: unknown, recurrence: unknown) {
      const event = validateEventInput(input);
      calendarId(id);
      const result = await repository.updateEvent(
        id,
        event,
        validateRule(recurrence, event.startLocal),
      );
      if (!result) {
        await parent(id);
        throw new DatabaseError(
          'EXCEPTIONS_EXIST',
          'Restore occurrence exceptions before changing the series schedule or recurrence. Title, description, location and category can still be edited.',
        );
      }
      for (const listener of listeners) listener();
      return result;
    },

    async deleteEvent(id: string, confirmed: boolean) {
      if (confirmed !== true) return false;
      return changed(repository.deleteEvent(calendarId(id)));
    },

    async listSeries(limit: number = 50, offset: number = 0) {
      if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 200 ||
        !Number.isSafeInteger(offset) ||
        offset < 0
      )
        throw new DatabaseError('VALIDATION', 'Invalid calendar pagination.');
      return repository.listSeries(limit, offset);
    },
    listCategories: repository.listCategories,

    async createCategory(name: string, color: string) {
      if (
        typeof name !== 'string' ||
        !name.trim() ||
        name.trim().length > 80 ||
        typeof color !== 'string' ||
        !/^#[\da-f]{6}$/i.test(color)
      )
        throw new DatabaseError(
          'VALIDATION',
          'Enter a category name of 1–80 characters and choose a color.',
        );
      return changed(repository.createCategory(name.trim(), color));
    },

    async getRecurrenceRule(id: string) {
      return (await parent(id)).recurrence;
    },

    async updateRecurrenceRule(id: string, rule: unknown) {
      const event = await parent(id);
      const result = await repository.updateRecurrenceRule(
        id,
        validateRule(rule, event.startLocal),
      );
      if (!result)
        throw new DatabaseError(
          'EXCEPTIONS_EXIST',
          'Restore occurrence exceptions before changing recurrence.',
        );
      for (const listener of listeners) listener();
      return result.recurrence;
    },

    async createRecurrenceRule(id: string, rule: unknown) {
      if ((await parent(id)).recurrence)
        throw new DatabaseError('CONFLICT', 'This series already has a recurrence rule.');
      return this.updateRecurrenceRule(id, rule);
    },

    async deleteRecurrenceRule(id: string) {
      return this.updateRecurrenceRule(id, null);
    },

    async listExceptions(id: string) {
      return repository.listExceptions(calendarId(id));
    },

    async getOccurrence(id: string, start: string) {
      const { instance } = await original(id, start);
      const exception = (await repository.listExceptions(id)).find(
        (item) => item.occurrenceStart === start,
      );
      if (exception?.kind === 'cancelled') return { ...instance, cancelled: true };
      return {
        ...instance,
        ...exception?.override,
        overridden: !!exception,
        cancelled: false,
      };
    },

    async updateOccurrence(id: string, start: string, input: unknown) {
      const { event } = await original(id, start);
      return changed(repository.putException(event, start, 'edited', validateEventInput(input)));
    },

    async cancelOccurrence(id: string, start: string, confirmed: boolean) {
      if (confirmed !== true) return false;
      const { event } = await original(id, start);
      return changed(repository.putException(event, start, 'cancelled', null));
    },

    async restoreOccurrence(id: string, start: string, confirmed: boolean) {
      if (confirmed !== true) return false;
      calendarId(id);
      validateLocal(start, false);
      return changed(repository.deleteException(id, start));
    },

    async listRange(from: string, to: string, search: string = ''): Promise<CalendarEntry[]> {
      validateRange(from, to);
      if (typeof search !== 'string' || search.length > 1000)
        throw new DatabaseError('VALIDATION', 'Search must be at most 1000 characters.');
      const [{ events, exceptions }, deadlines] = await Promise.all([
        repository.listEventsByDateRange(from, to, addDays(from, -366)),
        tasks.listCalendarTasks(from, to),
      ]);

      const entries: CalendarEntry[] = [];
      for (const event of events) {
        const overrides = exceptions.filter((item) => item.eventId === event.id);
        const seen = new Set();
        for (const occurrence of expandEvent(event, from, to)) {
          const exception = overrides.find(
            (item) => item.occurrenceStart === occurrence.occurrenceStart,
          );
          seen.add(occurrence.occurrenceStart);
          if (exception?.kind === 'cancelled') continue;
          const effective = {
            ...occurrence,
            ...exception?.override,
            overridden: !!exception,
          };
          if (effective.startLocal < `${to}T00:00` && effective.endLocal > `${from}T00:00`)
            entries.push({ ...effective, type: 'event' });
        }
        for (const exception of overrides) {
          if (
            !seen.has(exception.occurrenceStart) &&
            exception.kind === 'edited' &&
            exception.override &&
            exception.override.startLocal < `${to}T00:00` &&
            exception.override.endLocal > `${from}T00:00`
          )
            entries.push({
              ...event,
              ...exception.override,
              type: 'event',
              eventId: event.id,
              occurrenceStart: exception.occurrenceStart,
              instanceId: `${event.id}@${exception.occurrenceStart}`,
              overridden: true,
            });
        }
        if (entries.length > 5000)
          throw new DatabaseError('RANGE', 'Too many calendar occurrences. Narrow the range.');
      }
      for (const task of deadlines)
        entries.push({
          ...task,
          type: 'task',
          instanceId: `task:${task.id}`,
          startLocal: `${task.dueDate}T${task.dueTime ?? '00:00'}`,
          endLocal: `${addDays(task.dueDate ?? from, 1)}T00:00`,
          allDay: !task.dueTime,
        });
      const query = search.trim().toLocaleLowerCase();
      return entries
        .filter((entry) =>
          `${entry.title}\n${entry.description}\n${entry.type === 'event' ? entry.location : ''}`
            .toLocaleLowerCase()
            .includes(query),
        )
        .sort(compareCalendarEntries);
    },
  };
}
