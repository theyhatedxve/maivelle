const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { openTestDatabase } = require('../database/sqliteAdapter.cts');
const { runCrossModuleChecks } = require('../../src/testing/database/phase13Scenarios.ts');
const { observeNotesCount } = require('../../src/features/notes/hooks/observeNotesCount.ts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { createNotesRepository } = require('../../src/database/repositories/notesRepository.ts');
const {
  compareCalendarEntries,
} = require('../../src/features/calendar/services/calendarService.ts');
test('dashboard count ignores an older read arriving after a newer mutation', async () => {
  const pending = [];
  let notify;
  const values = [];
  const stop = observeNotesCount(
    {
      countActive: () => new Promise((resolve) => pending.push(resolve)),
      subscribe: (listener) => {
        notify = listener;
        return () => {};
      },
    },
    (value) => values.push(value),
    (error) => {
      throw error;
    },
  );
  notify();
  pending[1](1);
  await new Promise(setImmediate);
  pending[0](0);
  await new Promise(setImmediate);
  stop();
  assert.deepEqual(values, [1]);
});
test('a blurred dashboard ignores late count success and failure and releases its subscription', async () => {
  for (const failure of [false, true]) {
    let resolve,
      reject,
      unsubscribed = false;
    const values = [];
    const stop = observeNotesCount(
      {
        countActive: () =>
          new Promise((a, b) => {
            resolve = a;
            reject = b;
          }),
        subscribe: () => () => {
          unsubscribed = true;
        },
      },
      (value) => values.push(value),
      (error) => values.push(error),
    );
    stop();
    if (failure) reject(Error('Late failure'));
    else resolve(3);
    await new Promise(setImmediate);
    assert.deepEqual(values, []);
    assert.ok(unsubscribed);
  }
});
test('library previews are bounded while full-text search and editor bodies remain intact', async (t) => {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db);
  const notes = createNotesRepository(db, randomUUID);
  const body = '\t\u2003\n' + 'public '.repeat(1000) + 'FIND_AT_END';
  const saved = await notes.create({ title: 'Public preview', body });
  const rows = await notes.list({ preview: true, search: 'FIND_AT_END' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].body, body.trim().slice(0, 240));
  assert.equal((await notes.getById(saved.id)).body, body);
  assert.equal((await notes.list())[0].body, body);
  await assert.rejects(notes.list({ preview: 'yes' }), { code: 'VALIDATION' });
});
test('Calendar key sorting is chronological, all-day first and deterministic for ties', () => {
  const rows = [
    { startLocal: '2026-10-22T00:00', allDay: true, instanceId: 'z' },
    { startLocal: '2026-10-21T00:00', allDay: false, instanceId: 'b' },
    { startLocal: '2026-10-21T00:00', allDay: true, instanceId: 'c' },
    { startLocal: '2026-10-21T00:00', allDay: false, instanceId: 'a' },
  ];
  assert.deepEqual(
    rows.sort(compareCalendarEntries).map((r) => r.instanceId),
    ['c', 'a', 'b', 'z'],
  );
  assert.equal(compareCalendarEntries(rows[0], rows[0]), 0);
});
test('real SQLite integration: dashboard invalidation, Tasks/Calendar, Finance/Budget and timer recovery', async (t) => {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  const checks = await runCrossModuleChecks(db, randomUUID);
  assert.equal(checks.length, 12);
});
