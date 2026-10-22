import * as SQLite from 'expo-sqlite';
import { uuid } from 'expo';
import { initializeDatabase } from '../../database/initialize.ts';
import { migrations } from '../../database/migrations/index.ts';
import { createNotesRepository } from '../../database/repositories/notesRepository.ts';
import { createTasksRepository } from '../../database/repositories/tasksRepository.ts';
import { createTasksService } from '../../features/tasks/services/tasksService.ts';
import { createCalendarRepository } from '../../database/repositories/calendarRepository.ts';
import { createCalendarService } from '../../features/calendar/services/calendarService.ts';
import { DatabaseError } from '../../database/errors.ts';

function ensure(value: unknown, label: string) {
  if (!value) throw new DatabaseError('TEST_FAILED', label);
}
export async function runNativeCalendarChecks() {
  if (!__DEV__)
    throw new DatabaseError(
      'DEVELOPMENT_ONLY',
      'Calendar diagnostics use synthetic fixtures only.',
    );
  const filename = `maivelle-isolated-calendar-${uuid.v4()}.db`;
  const db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
  let passed = false;
  const results = [];
  try {
    await initializeDatabase(db, migrations.slice(0, 4));
    const notes = createNotesRepository(db, uuid.v4);
    const note = await notes.create({ title: 'Synthetic pre-Calendar note' });
    const tasks = createTasksRepository(db, uuid.v4);
    const task = await createTasksService(tasks).createTask({
      title: 'Synthetic calendar deadline',
      dueDate: '2026-10-19',
    });
    await initializeDatabase(db);
    await initializeDatabase(db);
    ensure(
      (await notes.getById(note.id))?.title === note.title &&
        (await tasks.getTaskById(task.id))?.title === task.title,
      'Previous records survive migration',
    );
    ensure(
      (
        await db.getAllAsync<import('../../database/rows.ts').MigrationLedgerRow>(
          'SELECT * FROM schema_migrations',
        )
      ).length === migrations.length,
      'Migration idempotency',
    );
    results.push('PASS: migration 5 preserves Notes/Tasks and is idempotent');
    const calendar = createCalendarService(createCalendarRepository(db, uuid.v4), tasks);
    const category = await calendar.createCategory('Synthetic Calendar category', '#6D42C7');
    const input = {
      title: 'Synthetic native event',
      description: '100%_ literal fixture',
      location: 'Imaginary room',
      startLocal: '2026-10-19T09:00',
      endLocal: '2026-10-19T10:00',
      allDay: false,
      categoryId: category.id,
    };
    const rule = { frequency: 'daily', interval: 1, weekdays: [], until: null, count: 3 };
    const event = await calendar.createEvent(input, rule);
    ensure(
      (await calendar.listRange('2026-10-19', '2026-10-23', '100%_')).length === 3,
      'Daily recurrence and literal search',
    );
    ensure(
      (await calendar.listRange('2026-10-19', '2026-10-20')).some(
        (entry) => entry.type === 'task' && entry.id === task.id,
      ),
      'Tasks projected without duplication',
    );
    results.push(
      'PASS: native event creation, category, daily recurrence, search and task projection',
    );
    await calendar.cancelOccurrence(event.id, '2026-10-20T09:00', true);
    ensure(
      (await calendar.listRange('2026-10-20', '2026-10-21')).length === 0,
      'Cancelled occurrence',
    );
    await calendar.updateOccurrence(event.id, '2026-10-21T09:00', {
      ...input,
      title: 'Moved native fixture',
      startLocal: '2026-12-01T14:00',
      endLocal: '2026-12-01T15:00',
    });
    ensure(
      (await calendar.listRange('2026-12-01', '2026-12-02'))[0]?.title === 'Moved native fixture',
      'Moved exception range',
    );
    ensure(
      (
        await calendar.updateEvent(
          event.id,
          { ...input, title: 'Updated parent' },
          event.recurrence,
        )
      ).createdAt === event.createdAt,
      'Stable parent creation timestamp',
    );
    await calendar.restoreOccurrence(event.id, '2026-10-20T09:00', true);
    ensure(
      (await calendar.listExceptions(event.id)).length === 1,
      'Restore preserves other exception',
    );
    results.push('PASS: occurrence cancellation, moved edit, restoration and series edit');
    const weekly = await calendar.createEvent(
      { ...input, startLocal: '2026-10-21T09:00', endLocal: '2026-10-21T10:00' },
      { ...rule, frequency: 'weekly', interval: 2, weekdays: [1, 3, 5], count: 4 },
    );
    ensure(
      (await calendar.listRange('2026-10-19', '2026-11-20')).filter(
        (entry) => entry.id === weekly.id,
      ).length === 4,
      'Weekly count',
    );
    const monthly = await calendar.createEvent(
      { ...input, startLocal: '2026-01-31T09:00', endLocal: '2026-01-31T10:00' },
      { ...rule, frequency: 'monthly' },
    );
    ensure(
      (await calendar.listRange('2026-01-01', '2026-04-01')).filter(
        (entry) => entry.id === monthly.id,
      ).length === 2,
      'Month-end skip',
    );
    const yearly = await calendar.createEvent(
      { ...input, startLocal: '2096-02-29T09:00', endLocal: '2096-02-29T10:00' },
      { ...rule, frequency: 'yearly' },
    );
    ensure(
      !(await calendar.listRange('2100-02-01', '2100-03-01')).some(
        (entry) => entry.id === yearly.id,
      ),
      'Non-leap century',
    );
    ensure(
      (await calendar.listRange('2104-02-01', '2104-03-01')).some(
        (entry) => entry.id === yearly.id,
      ),
      'Leap-year occurrence',
    );
    results.push('PASS: weekly/monthly/yearly recurrence, month-end and leap-century rules');
    const allDay = await calendar.createEvent({
      ...input,
      title: 'Synthetic all day',
      allDay: true,
      startLocal: '2026-10-19T00:00',
      endLocal: '2026-10-21T00:00',
    });
    ensure(
      (await calendar.listRange('2026-10-20', '2026-10-21')).some(
        (entry) => entry.id === allDay.id,
      ),
      'All-day overlap',
    );
    ensure(
      !(await calendar.listRange('2026-10-21', '2026-10-22')).some(
        (entry) => entry.id === allDay.id,
      ),
      'Exclusive end date',
    );
    ensure(!(await calendar.deleteEvent(event.id, false)), 'Cancelled destructive action');
    await calendar.deleteEvent(event.id, true);
    ensure((await calendar.listExceptions(event.id)).length === 0, 'Exception cascade');
    ensure(
      (await notes.getById(note.id)) && (await tasks.getTaskById(task.id)),
      'Existing modules preserved after delete',
    );
    results.push('PASS: all-day boundaries, confirmed series delete and exception cascade');
    passed = true;
    return results;
  } finally {
    await db.closeAsync();
    if (passed) await SQLite.deleteDatabaseAsync(filename);
  }
}
