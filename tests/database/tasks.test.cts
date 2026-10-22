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
const { createTasksRepository } = require('../../src/database/repositories/tasksRepository.ts');
const { createTasksService } = require('../../src/features/tasks/services/tasksService.ts');
const { isTaskOverdue, taskClock } = require('../../src/features/tasks/services/taskDates.ts');
const { createNotesRepository } = require('../../src/database/repositories/notesRepository.ts');
const now = new Date(2026, 9, 19, 12, 0, 0, 500);
async function fixture(t) {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db);
  const repository = createTasksRepository(db, randomUUID);
  return { db, repository, service: createTasksService(repository, () => now) };
}
test('task CRUD preserves stable IDs and creation timestamp, binds SQL-looking content', async (t) => {
  const { service } = await fixture(t);
  const task = await service.createTask({
    title: '  Synthetic task  ',
    description: "'); DROP TABLE tasks; --",
  });
  assert.equal(task.title, 'Synthetic task');
  assert.equal(task.status, 'todo');
  assert.equal(task.priority, 'medium');
  assert.equal(task.createdAt, task.updatedAt);
  assert.equal(task.completedAt, null);
  const updated = await service.updateTask(task.id, { ...task, title: 'Edited fixture' });
  assert.equal(updated.id, task.id);
  assert.equal(updated.createdAt, task.createdAt);
  assert.ok(updated.updatedAt >= task.updatedAt);
  assert.equal((await service.getTaskById(task.id)).description, task.description);
  assert.equal(await service.deleteTask(task.id, false), false);
  assert.equal(await service.deleteTask(task.id, true), true);
  assert.equal(await service.deleteTask(task.id, true), false);
  assert.equal(await service.getTaskById(task.id), null);
  await assert.rejects(service.updateTask(task.id, { title: 'Missing' }), { code: 'NOT_FOUND' });
});
test('completion and reopening maintain completed_at across repeated completion and edits', async (t) => {
  const { service } = await fixture(t);
  const task = await service.createTask({ title: 'Status fixture' });
  const progressing = await service.setTaskStatus(task.id, 'in_progress');
  assert.equal(progressing.completedAt, null);
  const completed = await service.setTaskStatus(task.id, 'completed');
  assert.ok(completed.completedAt);
  assert.equal(
    (await service.setTaskStatus(task.id, 'completed')).completedAt,
    completed.completedAt,
  );
  assert.equal(
    (await service.updateTask(task.id, { ...completed, title: 'Completed edit' })).completedAt,
    completed.completedAt,
  );
  const reopened = await service.setTaskStatus(task.id, 'todo');
  assert.equal(reopened.completedAt, null);
  assert.equal(reopened.createdAt, task.createdAt);
  const createdCompleted = await service.createTask({
    title: 'Already complete',
    status: 'completed',
  });
  assert.ok(createdCompleted.completedAt);
});
test('date-only deadlines stay current all day and timed deadlines change dynamically', async (t) => {
  const { service, repository } = await fixture(t);
  const allDay = await service.createTask({ title: 'All day', dueDate: '2026-10-19' });
  const timed = await service.createTask({
    title: 'Timed',
    dueDate: '2026-10-19',
    dueTime: '12:00',
  });
  assert.equal(isTaskOverdue(allDay, new Date(2026, 9, 19, 23, 59, 59)), false);
  assert.equal(isTaskOverdue(allDay, new Date(2026, 9, 20, 0, 0)), true);
  assert.equal(isTaskOverdue(timed, new Date(2026, 9, 19, 12, 0, 0, 0)), false);
  assert.equal(isTaskOverdue(timed, now), true);
  assert.equal(isTaskOverdue({ ...timed, status: 'completed' }, now), false);
  assert.equal(taskClock(new Date(2026, 0, 2, 3, 4, 5, 6)).localNow, '2026-01-02T03:04:05.006');
  let clock = new Date(2026, 9, 19, 10);
  const movingClock = createTasksService(repository, () => clock);
  assert.equal((await movingClock.listTasks({ filter: 'overdue' })).length, 0);
  clock = new Date(2026, 9, 20);
  assert.equal((await movingClock.listTasks({ filter: 'overdue' })).length, 2);
});
test('Today, Upcoming, Overdue, Completed and All filters agree with live summaries', async (t) => {
  const { service, repository } = await fixture(t);
  const yesterday = await service.createTask({ title: 'Yesterday', dueDate: '2026-10-18' });
  const earlier = await service.createTask({
    title: 'Earlier',
    dueDate: '2026-10-19',
    dueTime: '11:59',
  });
  await service.createTask({ title: 'Later', dueDate: '2026-10-19', dueTime: '13:00' });
  await service.createTask({ title: 'All day', dueDate: '2026-10-19' });
  await service.createTask({ title: 'Tomorrow', dueDate: '2026-10-20' });
  await service.createTask({ title: 'Unscheduled' });
  await service.createTask({ title: 'Completed', status: 'completed', dueDate: '2026-10-18' });
  assert.equal((await service.listTasks({ filter: 'today' })).length, 3);
  assert.equal((await service.listTasks({ filter: 'upcoming' })).length, 1);
  assert.deepEqual(
    new Set((await service.listTasks({ filter: 'overdue' })).map((task) => task.id)),
    new Set([yesterday.id, earlier.id]),
  );
  assert.equal((await service.listTasks({ filter: 'completed' })).length, 1);
  assert.equal((await service.listTasks({ filter: 'all' })).length, 7);
  assert.deepEqual(await service.summary(), { incomplete: 6, today: 3, overdue: 2, completed: 1 });
  const future = createTasksService(repository, () => new Date(2026, 9, 20));
  assert.equal((await future.listTasks({ filter: 'overdue' })).length, 4);
});
test('literal local search covers title and description, including wildcards and quotes', async (t) => {
  const { service } = await fixture(t);
  await service.createTask({ title: 'Synthetic IDEA', description: '100%_literal sample' });
  await service.createTask({ title: 'Other', description: 'Plain' });
  for (const search of ['idea', '%_', 'literal'])
    assert.equal((await service.listTasks({ search })).length, 1);
  assert.equal((await service.listTasks({ search: "' OR 1=1 --" })).length, 0);
});
test('due, priority and recent sorting are consistent with stable pagination', async (t) => {
  const { service, db } = await fixture(t);
  const low = await service.createTask({ title: 'Low', priority: 'low', dueDate: '2026-10-19' });
  const urgent = await service.createTask({
    title: 'Urgent',
    priority: 'urgent',
    dueDate: '2026-10-20',
  });
  const medium = await service.createTask({ title: 'Medium', priority: 'medium' });
  const high = await service.createTask({ title: 'High', priority: 'high' });
  assert.deepEqual(
    (await service.listTasks({ sort: 'priority' })).map((task) => task.id),
    [urgent.id, high.id, medium.id, low.id],
  );
  assert.deepEqual(
    (await service.listTasks({ sort: 'due', limit: 2 })).map((task) => task.id),
    [low.id, urgent.id],
  );
  await db.runAsync(
    'UPDATE tasks SET updated_at=? WHERE id=?',
    '9999-01-01T00:00:00.000Z',
    medium.id,
  );
  assert.equal((await service.listTasks({ sort: 'recent' }))[0].id, medium.id);
  const first = await service.listTasks({ sort: 'priority', limit: 2 });
  const second = await service.listTasks({ sort: 'priority', limit: 2, offset: 2 });
  assert.equal(new Set([...first, ...second].map((task) => task.id)).size, 4);
  await service.setTaskStatus(urgent.id, 'completed');
  assert.equal((await service.listTasks({ sort: 'priority' })).at(-1).id, urgent.id);
});
test('all-day deadlines sort after the last timed minute on the same date', async (t) => {
  const { service } = await fixture(t);
  const allDay = await service.createTask({ title: 'All day', dueDate: '2026-10-19' });
  const timed = await service.createTask({
    title: 'Last timed minute',
    dueDate: '2026-10-19',
    dueTime: '23:59',
  });
  for (const sort of ['due', 'priority'])
    assert.deepEqual(
      (await service.listTasks({ sort })).map((task) => task.id),
      [timed.id, allDay.id],
    );
});
test('successful mutations invalidate views and failed or cancelled work does not', async (t) => {
  const { service } = await fixture(t);
  let changes = 0;
  const unsubscribe = service.subscribe(() => changes++);
  const task = await service.createTask({ title: 'Notification fixture' });
  assert.equal(changes, 1);
  await service.setTaskStatus(task.id, 'completed');
  assert.equal(changes, 2);
  await service.deleteTask(task.id, false);
  assert.equal(changes, 2);
  await assert.rejects(service.createTask({ title: '' }), { code: 'VALIDATION' });
  assert.equal(changes, 2);
  await service.createSubtask(task.id, 'Checklist fixture');
  assert.equal(changes, 3);
  await service.deleteTask(task.id, true);
  assert.equal(changes, 4);
  unsubscribe();
  await service.createCategory('After unsubscribe');
  assert.equal(changes, 4);
});
test('category CRUD and filtering preserve tasks when a category is removed', async (t) => {
  const { service } = await fixture(t);
  const category = await service.createCategory(' Synthetic group ');
  const task = await service.createTask({ title: 'Categorized task', categoryId: category.id });
  assert.equal((await service.listTasks({ categoryId: category.id })).length, 1);
  assert.equal((await service.listTasks({ categoryId: null })).length, 0);
  assert.equal(await service.updateCategory(category.id, 'Renamed group'), true);
  assert.equal((await service.listCategories())[0].name, 'Renamed group');
  await assert.rejects(service.createCategory('Renamed group'), { code: 'CONFLICT' });
  assert.equal(await service.deleteCategory(category.id, false), false);
  assert.equal(await service.deleteCategory(category.id, true), true);
  const retained = await service.getTaskById(task.id);
  assert.equal(retained.title, task.title);
  assert.equal(retained.categoryId, null);
  assert.equal(retained.createdAt, task.createdAt);
  assert.equal((await service.listTasks({ categoryId: null })).length, 1);
});
test('subtask CRUD and progress work, parent deletion cascades atomically', async (t) => {
  const { service, db } = await fixture(t);
  const task = await service.createTask({ title: 'Checklist parent' });
  const other = await service.createTask({ title: 'Other parent' });
  const first = await service.createSubtask(task.id, ' First item ');
  const second = await service.createSubtask(task.id, 'Second item');
  const retained = await service.createSubtask(other.id, 'Keep this');
  assert.equal(first.title, 'First item');
  const updated = await service.updateSubtask(first.id, 'Renamed item', true);
  assert.equal(updated.createdAt, first.createdAt);
  assert.equal(updated.completed, true);
  let parent = await service.getTaskById(task.id);
  assert.equal(parent.subtaskCount, 2);
  assert.equal(parent.completedSubtaskCount, 1);
  assert.equal(parent.status, 'todo'); // Checklist progress does not silently complete its parent.
  await service.deleteSubtask(second.id, true);
  assert.equal((await service.listSubtasks(task.id)).length, 1);
  // A failed parent delete must roll back its FK cascade, preserving all checklist rows.
  await db.execAsync(
    "CREATE TRIGGER fail_parent_delete BEFORE DELETE ON tasks WHEN OLD.title='Checklist parent' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;",
  );
  await assert.rejects(service.deleteTask(task.id, true));
  assert.equal((await service.listSubtasks(task.id)).length, 1);
  assert.ok(await service.getTaskById(task.id));
  await db.execAsync('DROP TRIGGER fail_parent_delete');
  await service.deleteTask(task.id, true);
  assert.deepEqual(await service.listSubtasks(task.id), []);
  assert.equal((await service.listSubtasks(other.id))[0].id, retained.id);
});
test('invalid titles, dates, times, statuses, priorities, identifiers and pagination fail safely', async (t) => {
  const { service } = await fixture(t);
  const invalid = [
    null,
    [],
    {},
    { title: '' },
    { title: ' ' },
    { title: 'x'.repeat(241) },
    { title: 'x', description: 3 },
    { title: 'x', priority: 'critical' },
    { title: 'x', status: 'done' },
    { title: 'x', dueDate: '2026-02-30' },
    { title: 'x', dueDate: '2025-02-29' },
    { title: 'x', dueTime: '10:00' },
    { title: 'x', dueDate: '2026-10-19', dueTime: '24:00' },
  ];
  for (const input of invalid)
    await assert.rejects(service.createTask(input), { code: 'VALIDATION' });
  for (const query of [
    null,
    { sort: 'toString' },
    { sort: 'bad' },
    { filter: 'bad' },
    { limit: 0 },
    { offset: -1 },
    { unexpected: true },
  ])
    await assert.rejects(service.listTasks(query), { code: 'VALIDATION' });
  await assert.rejects(service.getTaskById("' OR 1=1"), { code: 'VALIDATION' });
  await assert.rejects(service.createCategory(' '), { code: 'VALIDATION' });
  await assert.rejects(service.createSubtask(randomUUID(), ' '), { code: 'VALIDATION' });
  await assert.rejects(service.createTask({ title: 'Absent category', categoryId: randomUUID() }), {
    code: 'REFERENCE',
  });
  await assert.rejects(service.createSubtask(randomUUID(), 'Absent parent'), { code: 'REFERENCE' });
  assert.equal((await service.summary()).incomplete, 0);
  assert.equal(
    (await service.createTask({ title: 'Leap date', dueDate: '2028-02-29' })).dueDate,
    '2028-02-29',
  );
});
test('migration 4 preserves existing Notes/settings and remains idempotent with task records', async (t) => {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db, migrations.slice(0, 3));
  const notes = createNotesRepository(db, randomUUID);
  const note = await notes.create({ title: 'Existing Notes fixture' });
  await db.runAsync(
    'INSERT INTO app_settings VALUES (?,?,?,?)',
    'synthetic.keep',
    'preserve',
    '2026',
    '2026',
  );
  await initializeDatabase(db);
  const service = createTasksService(createTasksRepository(db, randomUUID));
  const task = await service.createTask({ title: 'New task' });
  const child = await service.createSubtask(task.id, 'Keep checklist');
  const history = await db.getAllAsync('SELECT * FROM schema_migrations ORDER BY version');
  await initializeDatabase(db);
  assert.deepEqual(
    await db.getAllAsync('SELECT * FROM schema_migrations ORDER BY version'),
    history,
  );
  assert.deepEqual(await notes.getById(note.id), note);
  assert.equal(
    (await db.getFirstAsync('SELECT value FROM app_settings WHERE key=?', 'synthetic.keep')).value,
    'preserve',
  );
  assert.equal((await service.listSubtasks(task.id))[0].id, child.id);
});
test('task schema rejects invalid flags, dates, references and inconsistent completion directly', async (t) => {
  const { service, db } = await fixture(t);
  const task = await service.createTask({ title: 'Constraint fixture' });
  for (const sql of [
    "UPDATE tasks SET due_time='10:00' WHERE id=?",
    "UPDATE tasks SET due_date='2026-02-30' WHERE id=?",
    "UPDATE tasks SET status='completed' WHERE id=?",
    "UPDATE tasks SET priority='critical' WHERE id=?",
  ])
    await assert.rejects(db.runAsync(sql, task.id), /CHECK/);
  assert.equal((await service.getTaskById(task.id)).status, 'todo');
});
test('task/category/subtask records persist across a separate process without networking', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'maivelle-tasks-test-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.match(basename(directory), /^maivelle-tasks-test-/);
    rmSync(directory, { recursive: true, force: true });
  });
  const filename = join(directory, 'synthetic.db');
  const db = openTestDatabase(filename);
  await initializeDatabase(db);
  const service = createTasksService(createTasksRepository(db, randomUUID));
  const category = await service.createCategory('Persist category');
  const task = await service.createTask({
    title: 'Persist task',
    categoryId: category.id,
    status: 'completed',
    dueDate: '2026-10-19',
    dueTime: '14:30',
  });
  await service.createSubtask(task.id, 'Persist subtask');
  await db.closeAsync();
  const script =
    "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const row=db.prepare('SELECT t.title,t.completed_at,c.name,(SELECT COUNT(*) FROM subtasks s WHERE s.task_id=t.id) AS children FROM tasks t JOIN task_categories c ON c.id=t.category_id WHERE t.id=?').get(process.argv[2]);process.stdout.write(JSON.stringify(row));db.close();";
  const child = spawnSync(process.execPath, ['-e', script, filename, task.id], {
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    title: task.title,
    completed_at: task.completedAt,
    name: category.name,
    children: 1,
  });
});
