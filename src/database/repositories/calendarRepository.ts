import { DatabaseError, storageError } from '../errors.ts';
export type CalendarEvent =
  import('../../features/calendar/validation/eventInput.ts').EventInput & {
    id: string;
    recurrence: import('../../features/calendar/validation/eventInput.ts').RecurrenceRule | null;
    createdAt: string;
    updatedAt: string;
  };
export type CalendarException = {
  eventId: string;
  occurrenceStart: string;
  kind: 'cancelled' | 'edited';
  override: import('../../features/calendar/validation/eventInput.ts').EventInput | null;
};
export type CalendarCategory = {
  id: string;
  name: string;
  color: string;
};

function eventFields(row: any) {
  return {
    title: row.title,
    description: row.description,
    location: row.location,
    startLocal: row.start_local,
    endLocal: row.end_local,
    allDay: row.all_day === 1,
    categoryId: row.category_id,
    reminderMinutes: row.reminder_minutes ?? null,
  };
}

function eventRow(row: any): CalendarEvent | null {
  return row
    ? {
        ...eventFields(row),
        id: row.id,
        recurrence: JSON.parse(row.recurrence_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}

function exceptionRow(row: any): CalendarException {
  return {
    eventId: row.event_id,
    occurrenceStart: row.occurrence_start,
    kind: row.kind,
    override: row.kind === 'edited' ? eventFields(row) : null,
  };
}

export function createCalendarRepository(
  db: import('../types.ts').Database,
  createId: () => string,
) {
  return {
    async createEvent(
      input: import('../../features/calendar/validation/eventInput.ts').EventInput,
      rule: CalendarEvent['recurrence'],
    ) {
      const now = new Date().toISOString();
      try {
        return eventRow(
          await db.getFirstAsync(
            'INSERT INTO calendar_events (id,title,description,location,start_local,end_local,all_day,category_id,reminder_minutes,recurrence_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *',
            createId(),
            input.title,
            input.description,
            input.location,
            input.startLocal,
            input.endLocal,
            Number(input.allDay),
            input.categoryId,
            input.reminderMinutes ?? null,
            JSON.stringify(rule),
            now,
            now,
          ),
        ) as CalendarEvent;
      } catch (error) {
        throw storageError(error, 'create the event');
      }
    },

    async getEventById(id: string) {
      try {
        return eventRow(
          await db.getFirstAsync<import('../rows.ts').CalendarEventsRow>(
            'SELECT * FROM calendar_events WHERE id=?',
            id,
          ),
        );
      } catch (error) {
        throw storageError(error, 'load the event');
      }
    },

    async listEventsByDateRange(from: string, to: string, lookback: string) {
      try {
        const parents = await db.getAllAsync(
          `SELECT e.* FROM calendar_events e WHERE
          (e.recurrence_json!='null' AND e.start_local<?) OR (e.start_local<? AND e.end_local>?)
          OR EXISTS(SELECT 1 FROM calendar_event_exceptions x WHERE x.event_id=e.id AND x.kind='edited' AND x.start_local<? AND x.end_local>?) LIMIT 1001`,
          `${to}T00:00`,
          `${to}T00:00`,
          `${from}T00:00`,
          `${to}T00:00`,
          `${from}T00:00`,
        );
        const exceptions = await db.getAllAsync<import('../rows.ts').CalendarEventExceptionsRow>(
          `SELECT * FROM calendar_event_exceptions WHERE
          (occurrence_start>=? AND occurrence_start<?) OR (kind='edited' AND start_local<? AND end_local>?) LIMIT 10001`,
          `${lookback}T00:00`,
          `${to}T00:00`,
          `${to}T00:00`,
          `${from}T00:00`,
        );
        if (parents.length > 1000 || exceptions.length > 10000)
          throw new DatabaseError(
            'RANGE',
            'Too many calendar series or exceptions. Narrow the range or manage older series. No records were hidden or reset.',
          );
        return {
          events: parents.map((row) => eventRow(row) as CalendarEvent),
          exceptions: exceptions.map(exceptionRow),
        };
      } catch (error) {
        throw storageError(error, 'load calendar events');
      }
    },

    async updateEvent(
      id: string,
      input: import('../../features/calendar/validation/eventInput.ts').EventInput,
      rule: CalendarEvent['recurrence'],
    ) {
      try {
        return eventRow(
          await db.getFirstAsync(
            `UPDATE calendar_events SET title=?,description=?,location=?,start_local=?,end_local=?,all_day=?,category_id=?,reminder_minutes=?,recurrence_json=?,updated_at=MAX(updated_at,?)
          WHERE id=? AND ((start_local=? AND end_local=? AND all_day=? AND recurrence_json=?)
          OR NOT EXISTS(SELECT 1 FROM calendar_event_exceptions WHERE event_id=calendar_events.id)) RETURNING *`,
            input.title,
            input.description,
            input.location,
            input.startLocal,
            input.endLocal,
            Number(input.allDay),
            input.categoryId,
            input.reminderMinutes ?? null,
            JSON.stringify(rule),
            new Date().toISOString(),
            id,
            input.startLocal,
            input.endLocal,
            Number(input.allDay),
            JSON.stringify(rule),
          ),
        );
      } catch (error) {
        throw storageError(error, 'update the event');
      }
    },
    /** Parent deletion and exception cascade are one atomic SQLite statement. */
    async deleteEvent(id: string) {
      try {
        return (await db.runAsync('DELETE FROM calendar_events WHERE id=?', id)).changes === 1;
      } catch (error) {
        throw storageError(error, 'delete the event series');
      }
    },

    async listSeries(limit: number, offset: number) {
      try {
        return (
          await db.getAllAsync<import('../rows.ts').CalendarEventsRow>(
            'SELECT * FROM calendar_events ORDER BY updated_at DESC,id LIMIT ? OFFSET ?',
            limit,
            offset,
          )
        ).map((row) => eventRow(row) as CalendarEvent);
      } catch (error) {
        throw storageError(error, 'list event series');
      }
    },
    async listCategories() {
      try {
        return (
          await db.getAllAsync<
            Pick<import('../rows.ts').CalendarEventCategoriesRow, 'id' | 'name' | 'color'>
          >('SELECT id,name,color FROM calendar_event_categories ORDER BY name COLLATE NOCASE,id')
        ).map((row) => ({ ...(row as CalendarCategory) }));
      } catch (error) {
        throw storageError(error, 'load event categories');
      }
    },

    async createCategory(name: string, color: string) {
      const id = createId();
      const now = new Date().toISOString();
      try {
        await db.runAsync(
          'INSERT INTO calendar_event_categories (id,name,color,created_at,updated_at) VALUES (?,?,?,?,?)',
          id,
          name,
          color,
          now,
          now,
        );
        return { id, name, color };
      } catch (error) {
        const failure = storageError(error, 'create the event category');
        if (failure.code === 'CONFLICT')
          throw new DatabaseError(
            'CONFLICT',
            'An event category with this name already exists.',
            error,
          );
        throw failure;
      }
    },

    async getRecurrenceRule(id: string) {
      const event = await this.getEventById(id);
      return event?.recurrence ?? null;
    },

    async updateRecurrenceRule(id: string, rule: CalendarEvent['recurrence']) {
      try {
        const row = await db.getFirstAsync(
          `UPDATE calendar_events SET recurrence_json=?,updated_at=MAX(updated_at,?) WHERE id=? AND NOT EXISTS(SELECT 1 FROM calendar_event_exceptions WHERE event_id=calendar_events.id) RETURNING *`,
          JSON.stringify(rule),
          new Date().toISOString(),
          id,
        );
        return eventRow(row);
      } catch (error) {
        throw storageError(error, 'change recurrence');
      }
    },

    async createRecurrenceRule(id: string, rule: CalendarEvent['recurrence']) {
      return this.updateRecurrenceRule(id, rule);
    },

    async deleteRecurrenceRule(id: string) {
      return this.updateRecurrenceRule(id, null);
    },

    async listExceptions(id: string) {
      try {
        return (
          await db.getAllAsync<import('../rows.ts').CalendarEventExceptionsRow>(
            'SELECT * FROM calendar_event_exceptions WHERE event_id=? ORDER BY occurrence_start',
            id,
          )
        ).map(exceptionRow);
      } catch (error) {
        throw storageError(error, 'load occurrence exceptions');
      }
    },

    async putException(
      parent: CalendarEvent,
      occurrenceStart: string,
      kind: 'cancelled' | 'edited',
      input: import('../../features/calendar/validation/eventInput.ts').EventInput | null,
    ) {
      const now = new Date().toISOString();
      try {
        const result = await db.runAsync(
          `INSERT INTO calendar_event_exceptions (event_id,occurrence_start,kind,title,description,location,start_local,end_local,all_day,category_id,reminder_minutes,created_at,updated_at)
          SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? FROM calendar_events WHERE id=? AND updated_at=? AND recurrence_json!='null' AND start_local=? AND end_local=? AND recurrence_json=? AND all_day=?
          ON CONFLICT(event_id,occurrence_start) DO UPDATE SET kind=excluded.kind,title=excluded.title,description=excluded.description,location=excluded.location,start_local=excluded.start_local,end_local=excluded.end_local,all_day=excluded.all_day,category_id=excluded.category_id,reminder_minutes=excluded.reminder_minutes,updated_at=MAX(calendar_event_exceptions.updated_at,excluded.updated_at)`,
          parent.id,
          occurrenceStart,
          kind,
          input?.title ?? null,
          input?.description ?? null,
          input?.location ?? null,
          input?.startLocal ?? null,
          input?.endLocal ?? null,
          input ? Number(input.allDay) : null,
          input?.categoryId ?? null,
          input?.reminderMinutes ?? null,
          now,
          now,
          parent.id,
          parent.updatedAt,
          parent.startLocal,
          parent.endLocal,
          JSON.stringify(parent.recurrence),
          Number(parent.allDay),
        );
        if (!result.changes)
          throw new DatabaseError(
            'CONFLICT',
            'The series changed. Reload it before editing this occurrence.',
          );
        return true;
      } catch (error) {
        throw storageError(error, 'save the occurrence exception');
      }
    },

    async deleteException(id: string, occurrenceStart: string) {
      try {
        return (
          (
            await db.runAsync(
              'DELETE FROM calendar_event_exceptions WHERE event_id=? AND occurrence_start=?',
              id,
              occurrenceStart,
            )
          ).changes === 1
        );
      } catch (error) {
        throw storageError(error, 'restore the original occurrence');
      }
    },
  };
}
