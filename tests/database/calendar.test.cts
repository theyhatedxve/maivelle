const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname, basename } = require('node:path');
const { spawnSync } = require('node:child_process');
const { openTestDatabase } = require('./sqliteAdapter.cts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { migrations } = require('../../src/database/migrations/index.ts');
const { applyMigrations } = require('../../src/database/migrations/migrate.ts');
const {
  createCalendarRepository,
} = require('../../src/database/repositories/calendarRepository.ts');
const { createTasksRepository } = require('../../src/database/repositories/tasksRepository.ts');
const { createTasksService } = require('../../src/features/tasks/services/tasksService.ts');
const { createNotesRepository } = require('../../src/database/repositories/notesRepository.ts');
const {
  createCalendarService,
} = require('../../src/features/calendar/services/calendarService.ts');
const {
  visibleRange,
  agendaEntries,
  addDays,
  addMonths,
} = require('../../src/features/calendar/services/calendarDates.ts');
const { eventToForm, formToEvent } = require('../../src/features/calendar/validation/eventForm.ts');
const { expandEvent } = require('../../src/features/calendar/services/recurrence.ts');
const input = (extra = {}) => ({
  title: 'Synthetic event',
  description: 'Sample only',
  location: 'Imaginary room',
  startLocal: '2026-10-19T09:00',
  endLocal: '2026-10-19T10:00',
  allDay: false,
  categoryId: null,
  ...extra,
});
const rule = (frequency, extra = {}) => ({
  frequency,
  interval: 1,
  weekdays: [1, 3, 5],
  until: null,
  count: null,
  ...extra,
});
async function fixture(t) {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db);
  const repository = createCalendarRepository(db, randomUUID);
  const tasks = createTasksRepository(db, randomUUID);
  return {
    db,
    repository,
    tasks: createTasksService(tasks),
    service: createCalendarService(repository, tasks),
  };
}
const dates = (entries) => entries.map((entry) => entry.startLocal.slice(0, 10));
test('expansion rejects malformed persisted rules and excessive durations before looping', () => {
  const event = {
    ...input(),
    id: 'synthetic-guard',
    createdAt: '2026',
    updatedAt: '2026',
    recurrence: rule('monthly', { interval: 0 }),
  };
  assert.throws(() => expandEvent(event, '2026-10-19', '2026-10-20'), { code: 'VALIDATION' });
  assert.throws(
    () =>
      expandEvent(
        { ...event, recurrence: rule('daily'), endLocal: '9998-12-31T10:00' },
        '2026-10-19',
        '2026-10-20',
      ),
    { code: 'RANGE' },
  );
});
test('Calendar CRUD binds values, preserves identity/created_at and requires confirmed deletion', async (t) => {
  const { service } = await fixture(t);
  let changes = 0;
  const unsubscribe = service.subscribe(() => changes++);
  const event = await service.createEvent(
    input({ title: '  Synthetic fixture  ', location: "'); DROP TABLE tasks; --" }),
  );
  assert.equal(event.title, 'Synthetic fixture');
  assert.deepEqual(await service.getEventById(event.id), event);
  const edited = await service.updateEvent(event.id, input({ title: 'Edited fixture' }), null);
  assert.equal(edited.id, event.id);
  assert.equal(edited.createdAt, event.createdAt);
  assert.ok(edited.updatedAt >= event.updatedAt);
  assert.equal(await service.deleteEvent(event.id, false), false);
  assert.equal(changes, 2);
  assert.equal(await service.deleteEvent(event.id, true), true);
  assert.equal(await service.getEventById(event.id), null);
  unsubscribe();
  await assert.rejects(service.updateEvent(event.id, input(), null), { code: 'NOT_FOUND' });
});
test('all-day exclusive ends, multi-day overlap and midnight boundaries are correct', async (t) => {
  const { service } = await fixture(t);
  const allDay = await service.createEvent(
    input({ allDay: true, startLocal: '2026-10-19T00:00', endLocal: '2026-10-21T00:00' }),
  );
  assert.equal(eventToForm(allDay).endDate, '2026-10-20');
  assert.deepEqual(
    formToEvent(eventToForm(allDay)),
    input({ allDay: true, startLocal: '2026-10-19T00:00', endLocal: '2026-10-21T00:00' }),
  );
  await service.createEvent(
    input({
      title: 'Cross midnight',
      startLocal: '2026-10-19T23:00',
      endLocal: '2026-10-20T01:00',
    }),
  );
  assert.equal((await service.listRange('2026-10-20', '2026-10-21')).length, 2);
  assert.equal((await service.listRange('2026-10-21', '2026-10-22')).length, 0);
  assert.equal((await service.listRange('2026-10-18', '2026-10-19')).length, 0);
});
test('daily intervals, count and inclusive until boundaries generate bounded occurrences', async (t) => {
  const { service } = await fixture(t);
  const event = await service.createEvent(input(), rule('daily', { interval: 2, count: 3 }));
  assert.deepEqual(dates(await service.listRange('2026-10-19', '2026-10-29')), [
    '2026-10-19',
    '2026-10-21',
    '2026-10-23',
  ]);
  await service.updateRecurrenceRule(event.id, rule('daily', { until: '2026-10-20' }));
  assert.deepEqual(dates(await service.listRange('2026-10-19', '2026-10-29')), [
    '2026-10-19',
    '2026-10-20',
  ]);
  await assert.rejects(service.listRange('2026-01-01', '2027-01-01'), { code: 'RANGE' });
});
test('weekly selected weekdays, interval and partial first-week count are consistent', async (t) => {
  const { service } = await fixture(t);
  await service.createEvent(
    input({ startLocal: '2026-10-21T09:00', endLocal: '2026-10-21T10:00' }),
    rule('weekly', { interval: 2, count: 4 }),
  );
  assert.deepEqual(dates(await service.listRange('2026-10-19', '2026-11-20')), [
    '2026-10-21',
    '2026-10-23',
    '2026-11-02',
    '2026-11-04',
  ]);
});
test('monthly rules skip invalid month days without consuming the occurrence limit', async (t) => {
  const { service } = await fixture(t);
  await service.createEvent(
    input({ startLocal: '2026-01-31T09:00', endLocal: '2026-01-31T10:00' }),
    rule('monthly', { count: 3 }),
  );
  assert.deepEqual(dates(await service.listRange('2026-01-01', '2026-04-01')), [
    '2026-01-31',
    '2026-03-31',
  ]);
  assert.deepEqual(dates(await service.listRange('2026-04-01', '2026-07-01')), ['2026-05-31']);
});
test('yearly leap-day recurrence counts valid occurrences across century boundaries', async (t) => {
  const { service } = await fixture(t);
  await service.createEvent(
    input({ startLocal: '2096-02-29T09:00', endLocal: '2096-02-29T10:00' }),
    rule('yearly', { count: 3 }),
  );
  assert.deepEqual(dates(await service.listRange('2100-02-01', '2100-03-01')), []);
  assert.deepEqual(dates(await service.listRange('2104-02-01', '2104-03-01')), ['2104-02-29']);
  assert.deepEqual(dates(await service.listRange('2108-02-01', '2108-03-01')), ['2108-02-29']);
  assert.deepEqual(dates(await service.listRange('2112-02-01', '2112-03-01')), []);
});
test('ancient unbounded daily series queries jump to a bounded modern range', async (t) => {
  const { service } = await fixture(t);
  await service.createEvent(
    input({ startLocal: '1900-01-01T09:00', endLocal: '1900-01-01T10:00' }),
    rule('daily'),
  );
  assert.equal((await service.listRange('9990-01-01', '9990-01-08')).length, 7);
});
test('cancel and restore occurrence leave parent and adjacent instances intact', async (t) => {
  const { service } = await fixture(t);
  const event = await service.createEvent(input(), rule('daily', { count: 3 }));
  await service.cancelOccurrence(event.id, '2026-10-20T09:00', true);
  assert.deepEqual(dates(await service.listRange('2026-10-19', '2026-10-23')), [
    '2026-10-19',
    '2026-10-21',
  ]);
  assert.equal((await service.getOccurrence(event.id, '2026-10-20T09:00')).cancelled, true);
  assert.equal((await service.getEventById(event.id)).title, event.title);
  assert.equal(await service.restoreOccurrence(event.id, '2026-10-20T09:00', false), false);
  await service.restoreOccurrence(event.id, '2026-10-20T09:00', true);
  assert.equal((await service.listRange('2026-10-19', '2026-10-23')).length, 3);
  await assert.rejects(service.cancelOccurrence(event.id, '2026-10-25T09:00', true), {
    code: 'NOT_FOUND',
  });
});
test('moved occurrence appears once in its new range, searchable by effective location/title', async (t) => {
  const { service } = await fixture(t);
  const event = await service.createEvent(input(), rule('daily', { count: 2 }));
  await service.updateOccurrence(
    event.id,
    '2026-10-20T09:00',
    input({
      title: 'Moved sample',
      location: 'Offline observatory',
      startLocal: '2026-12-01T14:00',
      endLocal: '2026-12-01T15:00',
    }),
  );
  assert.equal((await service.listRange('2026-10-20', '2026-10-21')).length, 0);
  const december = await service.listRange('2026-12-01', '2026-12-02', 'observatory');
  assert.equal(december.length, 1);
  assert.equal(december[0].overridden, true);
  assert.equal(december[0].occurrenceStart, '2026-10-20T09:00');
  assert.equal(december[0].instanceId, `${event.id}@2026-10-20T09:00`);
  await service.updateOccurrence(event.id, '2026-10-20T09:00', input({ title: 'Moved back' }));
  assert.equal((await service.listRange('2026-10-19', '2026-10-21')).length, 2);
  const future = await service.createEvent(
    input({ startLocal: '2026-12-19T09:00', endLocal: '2026-12-19T10:00' }),
    rule('daily', { count: 2 }),
  );
  await service.updateOccurrence(
    future.id,
    future.startLocal,
    input({ startLocal: '2026-11-01T09:00', endLocal: '2026-11-01T10:00' }),
  );
  assert.equal((await service.listRange('2026-11-01', '2026-11-02'))[0].eventId, future.id);
});
test('series metadata updates preserve exceptions; schedule/rule changes require explicit restoration', async (t) => {
  const { service } = await fixture(t);
  const event = await service.createEvent(input(), rule('daily', { count: 3 }));
  await service.cancelOccurrence(event.id, '2026-10-20T09:00', true);
  await service.updateEvent(event.id, input({ title: 'New series name' }), event.recurrence);
  await assert.rejects(
    service.updateEvent(
      event.id,
      input({ startLocal: '2026-10-19T11:00', endLocal: '2026-10-19T12:00' }),
      event.recurrence,
    ),
    { code: 'EXCEPTIONS_EXIST' },
  );
  await assert.rejects(service.deleteRecurrenceRule(event.id), { code: 'EXCEPTIONS_EXIST' });
  await service.restoreOccurrence(event.id, '2026-10-20T09:00', true);
  await service.deleteRecurrenceRule(event.id);
  assert.equal(await service.getRecurrenceRule(event.id), null);
  await service.createRecurrenceRule(event.id, rule('weekly'));
  assert.equal((await service.getRecurrenceRule(event.id)).frequency, 'weekly');
  await assert.rejects(service.createRecurrenceRule(event.id, rule('daily')), { code: 'CONFLICT' });
});
test('deleting a series cascades exceptions atomically and preserves unrelated series', async (t) => {
  const { service, db } = await fixture(t);
  const event = await service.createEvent(input(), rule('daily'));
  const other = await service.createEvent(input({ title: 'Keep this' }));
  await service.cancelOccurrence(event.id, event.startLocal, true);
  await db.execAsync(
    "CREATE TRIGGER fail_calendar_delete BEFORE DELETE ON calendar_events WHEN OLD.title='Synthetic event' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;",
  );
  await assert.rejects(service.deleteEvent(event.id, true));
  assert.equal((await service.listExceptions(event.id)).length, 1);
  await db.execAsync('DROP TRIGGER fail_calendar_delete');
  await service.deleteEvent(event.id, true);
  assert.deepEqual(await service.listExceptions(event.id), []);
  assert.ok(await service.getEventById(other.id));
});
test('task deadlines are projected directly, include completed tasks, and never create events', async (t) => {
  const { service, tasks, db } = await fixture(t);
  const task = await tasks.createTask({ title: 'Synthetic deadline', dueDate: '2026-10-19' });
  let entries = await service.listRange('2026-10-19', '2026-10-20');
  assert.equal(entries[0].type, 'task');
  assert.equal(entries[0].id, task.id);
  assert.equal(entries[0].allDay, true);
  await tasks.setTaskStatus(task.id, 'completed');
  entries = await service.listRange('2026-10-19', '2026-10-20');
  assert.equal(entries[0].status, 'completed');
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS total FROM calendar_events')).total, 0);
  await tasks.deleteTask(task.id, true);
  assert.deepEqual(await service.listRange('2026-10-19', '2026-10-20'), []);
});
test('category colors and FK removal preserve events and edited occurrences', async (t) => {
  const { service, db } = await fixture(t);
  const category = await service.createCategory(' Synthetic category ', '#6D42C7');
  const event = await service.createEvent(
    input({ categoryId: category.id }),
    rule('daily', { count: 2 }),
  );
  await service.updateOccurrence(
    event.id,
    event.startLocal,
    input({ categoryId: category.id, title: 'Edited colored fixture' }),
  );
  assert.deepEqual(await service.listCategories(), [
    { id: category.id, name: 'Synthetic category', color: '#6D42C7' },
  ]);
  await assert.rejects(service.createCategory(category.name, category.color), { code: 'CONFLICT' });
  await db.runAsync('DELETE FROM calendar_event_categories WHERE id=?', category.id);
  assert.equal((await service.getEventById(event.id)).categoryId, null);
  assert.equal((await service.getOccurrence(event.id, event.startLocal)).categoryId, null);
});
test('validation rejects empty titles, invalid/end-before-start dates, times, rules and ranges', async (t) => {
  const { service } = await fixture(t);
  for (const change of [
    { title: '' },
    { title: ' ' },
    { title: 'x'.repeat(241) },
    { startLocal: '2026-02-30T09:00' },
    { endLocal: '2026-10-19T08:00' },
    { startLocal: '2026-10-19T24:00' },
    { allDay: true },
    { location: 'x'.repeat(501) },
  ])
    await assert.rejects(service.createEvent(input(change)), { code: 'VALIDATION' });
  for (const recurrence of [
    rule('daily', { interval: 0 }),
    rule('weekly', { weekdays: [] }),
    rule('weekly', { weekdays: [7] }),
    rule('daily', { count: 0 }),
    rule('daily', { until: '2026-10-18' }),
    rule('daily', { until: '2026-10-20', count: 3 }),
    rule('forever'),
  ])
    await assert.rejects(service.createEvent(input(), recurrence), { code: 'VALIDATION' });
  await assert.rejects(service.getEventById("' OR 1=1"), { code: 'VALIDATION' });
  await assert.rejects(service.listRange('2026-10-19', '2026-10-19'), { code: 'RANGE' });
  assert.deepEqual(await service.listSeries(), []);
});
test('month/week/day navigation uses civil dates without UTC day shifts', () => {
  const month = visibleRange('month', '2026-10-19');
  assert.equal(month.days.length, 42);
  assert.equal(month.start, '2026-09-27');
  assert.equal(month.end, '2026-11-08');
  assert.equal(visibleRange('week', '2026-10-19').start, '2026-10-18');
  assert.equal(visibleRange('day', '2026-10-19').end, '2026-10-20');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
});
test('week agenda includes other weekdays while day/month agendas focus the selected day', async (t) => {
  const { service } = await fixture(t);
  await service.createEvent(input(), rule('daily', { count: 3 }));
  const entries = await service.listRange('2026-10-18', '2026-10-25');
  assert.equal(agendaEntries(entries, 'week', '2026-10-19').length, 3);
  assert.equal(agendaEntries(entries, 'day', '2026-10-19').length, 1);
  assert.equal(agendaEntries(entries, 'month', '2026-10-20').length, 1);
});
test('supported year-edge month grids retain events and the final all-day inclusive date', async (t) => {
  const { service } = await fixture(t);
  const early = await service.createEvent(
    input({ startLocal: '1900-01-01T09:00', endLocal: '1900-01-01T10:00' }),
  );
  const first = visibleRange('month', '1900-01-01');
  assert.equal((await service.listRange(first.start, first.end))[0].id, early.id);
  const last = await service.createEvent(
    input({ allDay: true, startLocal: '9998-12-31T00:00', endLocal: '9999-01-01T00:00' }),
  );
  const range = visibleRange('month', '9998-12-31');
  assert.equal((await service.listRange(range.start, range.end))[0].id, last.id);
  assert.equal(eventToForm(last).endDate, '9998-12-31');
});
test('exception writes reject a changed schedule even if its timestamp did not advance', async (t) => {
  const { service, repository, db } = await fixture(t);
  const original = await service.createEvent(input(), rule('daily'));
  await db.runAsync(
    'UPDATE calendar_events SET start_local=?,end_local=? WHERE id=?',
    '2026-10-19T11:00',
    '2026-10-19T12:00',
    original.id,
  );
  await assert.rejects(repository.putException(original, original.startLocal, 'cancelled', null), {
    code: 'CONFLICT',
  });
  assert.deepEqual(await service.listExceptions(original.id), []);
});
test('time-zone/DST rules preserve all-day dates and skip nonexistent timed recurrence slots', () => {
  const script = `
    const assert=require('node:assert/strict');
    const {validateEventInput}=require('./src/features/calendar/validation/eventInput.ts');
    const {expandEvent}=require('./src/features/calendar/services/recurrence.ts');
    const base={title:'DST fixture',description:'',location:'',startLocal:'2026-03-07T02:30',endLocal:'2026-03-07T03:30',allDay:false,categoryId:null};
    const event={...validateEventInput(base),id:'synthetic-dst',createdAt:'2026',updatedAt:'2026',recurrence:{frequency:'daily',interval:1,weekdays:[],until:null,count:3}};
    assert.deepEqual(expandEvent(event,'2026-03-07','2026-03-10').map(x=>x.startLocal),['2026-03-07T02:30','2026-03-09T02:30']);
    const allDay={...event,allDay:true,startLocal:'2026-03-07T00:00',endLocal:'2026-03-08T00:00'};
    assert.equal(expandEvent(allDay,'2026-03-07','2026-03-10').length,3);
    assert.throws(()=>validateEventInput({...base,startLocal:'2026-03-08T02:30',endLocal:'2026-03-08T04:00'}),{code:'VALIDATION'});
  `;
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: dirname(require.resolve('../../package.json')),
    env: { ...process.env, TZ: 'America/New_York' },
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
});
test('migration 5 preserves Notes, Tasks, checklist and settings and is idempotent', async (t) => {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db, migrations.slice(0, 4));
  const notes = createNotesRepository(db, randomUUID);
  const note = await notes.create({ title: 'Previous Notes record' });
  const tasks = createTasksRepository(db, randomUUID);
  const task = await createTasksService(tasks).createTask({ title: 'Previous task' });
  const child = await tasks.createSubtask(task.id, 'Previous checklist');
  await db.runAsync(
    'INSERT INTO app_settings VALUES (?,?,?,?)',
    'synthetic.calendar.keep',
    'preserve',
    '2026',
    '2026',
  );
  await initializeDatabase(db);
  const history = await db.getAllAsync('SELECT * FROM schema_migrations');
  await initializeDatabase(db);
  assert.deepEqual(await db.getAllAsync('SELECT * FROM schema_migrations'), history);
  assert.deepEqual(await notes.getById(note.id), note);
  assert.equal((await tasks.listSubtasks(task.id))[0].id, child.id);
  assert.equal(
    (
      await db.getFirstAsync(
        'SELECT value FROM app_settings WHERE key=?',
        'synthetic.calendar.keep',
      )
    ).value,
    'preserve',
  );
  const bad = {
    version: migrations.length + 1,
    name: 'calendar-failing-test',
    sql: 'CREATE TABLE calendar_rollback_fixture(id); INSERT INTO absent_fixture VALUES(1);',
  };
  await assert.rejects(applyMigrations(db, [...migrations, bad]), { code: 'MIGRATION' });
  assert.ok(await tasks.getTaskById(task.id));
});
test('all-day cancellation and restoration work when the local midnight does not exist', () => {
  const script = `
    const assert=require('node:assert/strict');
    const {randomUUID}=require('node:crypto');
    const {openTestDatabase}=require('./tests/database/sqliteAdapter.cts');
    const {initializeDatabase}=require('./src/database/initialize.ts');
    const {createCalendarRepository}=require('./src/database/repositories/calendarRepository.ts');
    const {createTasksRepository}=require('./src/database/repositories/tasksRepository.ts');
    const {createCalendarService}=require('./src/features/calendar/services/calendarService.ts');
    (async()=>{const db=openTestDatabase();try{await initializeDatabase(db);
      const service=createCalendarService(createCalendarRepository(db,randomUUID),createTasksRepository(db,randomUUID));
      const event=await service.createEvent({title:'Synthetic midnight gap',description:'',location:'',allDay:true,startLocal:'2018-11-04T00:00',endLocal:'2018-11-05T00:00',categoryId:null},{frequency:'daily',interval:1,weekdays:[],until:null,count:1});
      await service.cancelOccurrence(event.id,event.startLocal,true);
      assert.equal((await service.listRange('2018-11-04','2018-11-05')).length,0);
      await service.restoreOccurrence(event.id,event.startLocal,true);
      assert.equal((await service.listRange('2018-11-04','2018-11-05')).length,1);
    }finally{await db.closeAsync()}})().catch(error=>{console.error(error);process.exitCode=1});
  `;
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: dirname(require.resolve('../../package.json')),
    env: { ...process.env, TZ: 'America/Sao_Paulo' },
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
});
test('calendar/rule/exception records persist across a process restart without networking', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'maivelle-calendar-test-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.match(basename(directory), /^maivelle-calendar-test-/);
    rmSync(directory, { recursive: true, force: true });
  });
  const filename = join(directory, 'synthetic.db');
  const db = openTestDatabase(filename);
  await initializeDatabase(db);
  const service = createCalendarService(
    createCalendarRepository(db, randomUUID),
    createTasksRepository(db, randomUUID),
  );
  const event = await service.createEvent(input(), rule('daily'));
  await service.cancelOccurrence(event.id, event.startLocal, true);
  await db.closeAsync();
  const script =
    "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const e=db.prepare('SELECT title,recurrence_json FROM calendar_events WHERE id=?').get(process.argv[2]);const x=db.prepare('SELECT kind FROM calendar_event_exceptions WHERE event_id=?').get(process.argv[2]);process.stdout.write(JSON.stringify([e.title,JSON.parse(e.recurrence_json).frequency,x.kind]));db.close();";
  const child = spawnSync(process.execPath, ['-e', script, filename, event.id], {
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), [event.title, 'daily', 'cancelled']);
});
