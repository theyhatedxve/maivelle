const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { openTestDatabase } = require('./sqliteAdapter.cts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { migrations } = require('../../src/database/migrations/index.ts');
const {
  createCalendarRepository,
} = require('../../src/database/repositories/calendarRepository.ts');
const { createTasksRepository } = require('../../src/database/repositories/tasksRepository.ts');
const {
  createCalendarService,
} = require('../../src/features/calendar/services/calendarService.ts');
const { calendarReminderPlan } = require('../../src/services/notifications/calendarReminders.ts');
const { exportRecords, importRecords } = require('../../src/database/backup/portableRecords.ts');

const input = (extra = {}) => ({
  title: 'Fictional reminder',
  description: '',
  location: '',
  startLocal: '2026-10-22T14:00',
  endLocal: '2026-10-22T15:00',
  allDay: false,
  categoryId: null,
  reminderMinutes: 10,
  ...extra,
});
async function fixture(t) {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db);
  const repository = createCalendarRepository(db, randomUUID);
  return {
    db,
    repository,
    service: createCalendarService(repository, createTasksRepository(db, randomUUID)),
  };
}

test('migration 11 preserves schema 10 events and timestamps, and reruns safely', async (t) => {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db, migrations.slice(0, 10));
  await db.runAsync(
    'INSERT INTO calendar_events (id,title,start_local,end_local,all_day,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    'old-event',
    'Fictional legacy',
    '2026-10-22T14:00',
    '2026-10-22T15:00',
    0,
    '2026-10-01',
    '2026-10-02',
  );
  const before = await db.getFirstAsync('SELECT * FROM calendar_events');
  await initializeDatabase(db);
  await initializeDatabase(db);
  assert.deepEqual(await db.getFirstAsync('SELECT * FROM calendar_events'), {
    ...before,
    reminder_minutes: null,
  });
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM schema_migrations')).n, 11);
});

test('reminders persist through CRUD and edited/cancelled/restored recurring occurrences', async (t) => {
  const { db, service } = await fixture(t);
  const event = await service.createEvent(input(), {
    frequency: 'daily',
    interval: 1,
    weekdays: [],
    until: null,
    count: 3,
  });
  assert.equal((await service.getEventById(event.id)).reminderMinutes, 10);
  await service.updateOccurrence(
    event.id,
    '2026-10-23T14:00',
    input({ startLocal: '2026-10-23T16:00', endLocal: '2026-10-23T17:00', reminderMinutes: 30 }),
  );
  let entries = await service.listRange('2026-10-22', '2026-10-25');
  assert.deepEqual(
    entries.map((e) => e.reminderMinutes),
    [10, 30, 10],
  );
  const now = new Date('2026-10-22T13:00').getTime();
  assert.equal(
    calendarReminderPlan(entries, now).requests[0].at,
    new Date('2026-10-22T13:50').getTime(),
  );
  await service.cancelOccurrence(event.id, '2026-10-23T14:00', true);
  entries = await service.listRange('2026-10-22', '2026-10-25');
  assert.equal(calendarReminderPlan(entries, now).requests.length, 2);
  await service.restoreOccurrence(event.id, '2026-10-23T14:00', true);
  assert.equal((await service.listRange('2026-10-22', '2026-10-25'))[1].reminderMinutes, 10);
  await assert.rejects(() =>
    service.updateEvent(event.id, input({ reminderMinutes: -5 }), event.recurrence),
  );
  await assert.rejects(() =>
    db.runAsync('UPDATE calendar_events SET reminder_minutes=? WHERE id=?', 7, event.id),
  );
  await service.deleteEvent(event.id, true);
  assert.equal(
    (await db.getFirstAsync('SELECT COUNT(*) AS n FROM calendar_event_exceptions')).n,
    0,
  );
});

test('reminder plans skip elapsed deadlines, retain unique identities and cap pending requests', async (t) => {
  const { service } = await fixture(t);
  await service.createEvent(input(), {
    frequency: 'daily',
    interval: 1,
    weekdays: [],
    until: null,
    count: 90,
  });
  const entries = await service.listRange('2026-10-22', '2027-01-20');
  const plan = calendarReminderPlan(entries, new Date('2026-10-22T14:00').getTime());
  assert.equal(plan.requests.length, 64);
  assert.equal(plan.limited, true);
  assert.equal(new Set(plan.requests.map((r) => r.id)).size, 64);
  assert.ok(plan.requests.every((r) => r.at > new Date('2026-10-22T14:00').getTime()));
});

test('portable recovery accepts schema 10 records and preserves reminders in schema 11', async (t) => {
  const source = await fixture(t);
  await source.service.createEvent(input());
  const records = [];
  for await (const record of exportRecords(source.db)) records.push(record);
  for (const legacy of [false, true]) {
    const target = await fixture(t);
    async function* stream() {
      for (const record of records) {
        if (!legacy) {
          yield record;
          continue;
        }
        if (record.kind === 'schema') {
          yield {
            ...record,
            version: 10,
            columns: Object.fromEntries(
              Object.entries(record.columns as Record<string, string[]>).map(([table, columns]) => [
                table,
                columns.filter((field) => field !== 'reminder_minutes'),
              ]),
            ),
          };
        } else {
          const schema = records[0].columns[record.table];
          if (record.table === 'schema_migrations' && record.values[0] === 11) continue;
          yield {
            ...record,
            values: record.values.filter((_, i) => schema[i] !== 'reminder_minutes'),
          };
        }
      }
    }
    await importRecords(target.db, stream());
    const [event] = await target.service.listSeries();
    assert.equal(event.title, 'Fictional reminder');
    assert.equal(event.reminderMinutes, legacy ? null : 10);
    await initializeDatabase(target.db);
  }
});
