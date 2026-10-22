import { initializeDatabase } from '../../database/initialize.ts';
import { createNotesRepository } from '../../database/repositories/notesRepository.ts';
import { createNoteCategoriesRepository } from '../../database/repositories/noteCategoriesRepository.ts';
import { createNotesService } from '../../features/notes/services/notesService.ts';
import { createTasksRepository } from '../../database/repositories/tasksRepository.ts';
import { createTasksService } from '../../features/tasks/services/tasksService.ts';
import { createCalendarRepository } from '../../database/repositories/calendarRepository.ts';
import { createCalendarService } from '../../features/calendar/services/calendarService.ts';
import { createFinanceRepository } from '../../database/repositories/financeRepository.ts';
import { createFinanceService } from '../../features/finance/services/financeService.ts';
import { createBudgetRepository } from '../../database/repositories/budgetRepository.ts';
import { createBudgetService } from '../../features/budget/services/budgetService.ts';
import { createTimeTrackerRepository } from '../../database/repositories/timeTrackerRepository.ts';
import { createTimeTrackerService } from '../../features/timeTracker/services/timeTrackerService.ts';
/** Public fictional fixtures only. Caller supplies a separate, disposable database. */
export async function runCrossModuleChecks(
  db: import('expo-sqlite').SQLiteDatabase,
  id: () => string,
  emit: (line: string) => void = () => {},
) {
  const results: string[] = [];
  const check = (ok: unknown, label: string) => {
    if (!ok) throw new Error(`Integration failed: ${label}`);
    results.push(`PASS: ${label}`);
    emit(results.join('\n'));
  };
  await initializeDatabase(db);
  const ledger = await db.getAllAsync<import('../../database/rows.ts').MigrationLedgerRow>(
    'SELECT * FROM schema_migrations ORDER BY version',
  );
  const notes = createNotesService(
    createNotesRepository(db, id),
    createNoteCategoriesRepository(db, id),
  );
  const counts: Promise<number>[] = [];
  const stopNotes = notes.subscribe(() => counts.push(notes.countActive()));
  const note = await notes.save(null, {
    title: 'Public integration note',
    body: 'Fictional only',
    categoryId: null,
  });
  await notes.setFlag(note.id, 'archived', true);
  await notes.setFlag(note.id, 'archived', false);
  stopNotes();
  check(
    JSON.stringify(await Promise.all(counts)) === '[1,0,1]',
    'Notes mutations invalidate dashboard counts from SQLite',
  );
  const taskRepo = createTasksRepository(db, id);
  const tasks = createTasksService(taskRepo, () => new Date('2026-10-21T12:00:00'));
  const calendar = createCalendarService(createCalendarRepository(db, id), taskRepo);
  const taskRefreshes: Promise<unknown>[] = [];
  const stopTasks = tasks.subscribe(() => taskRefreshes.push(tasks.summary()));
  const task = await tasks.createTask({
    title: 'Public deadline',
    dueDate: '2026-10-21',
    dueTime: '09:30',
  });
  const first = await calendar.listRange('2026-10-21', '2026-10-22');
  check(
    first.some((entry) => entry.type === 'task' && entry.id === task.id && !entry.allDay),
    'Tasks project into Calendar without duplicate records',
  );
  await tasks.setTaskStatus(task.id, 'completed');
  const done = await calendar.listRange('2026-10-21', '2026-10-22');
  check(
    done.some(
      (entry) => entry.type === 'task' && entry.id === task.id && entry.status === 'completed',
    ) && (await tasks.summary()).incomplete === 0,
    'Task completion reconciles Calendar and dashboard',
  );
  await tasks.deleteTask(task.id, true);
  stopTasks();
  await Promise.all(taskRefreshes);
  check(
    (await calendar.listRange('2026-10-21', '2026-10-22')).length === 0,
    'Task deletion removes its Calendar projection',
  );
  const group = await tasks.createCategory('Public transaction category');
  const related = await tasks.createTask({
    title: 'Public cascade parent',
    categoryId: group.id,
  });
  await tasks.createSubtask(related.id, 'Public cascade child');
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (
      (await tx.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys !== 1
    )
      throw new Error('Writer FK enforcement missing');
    await tx.runAsync('DELETE FROM task_categories WHERE id=?', group.id);
  });
  const kept = (await tasks.getTaskById(related.id))?.categoryId === null;
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM tasks WHERE id=?', related.id);
  });
  check(
    kept && (await tasks.listSubtasks(related.id)).length === 0,
    'Exclusive writers enforce FK, SET NULL and cascades',
  );
  const clock = () => new Date('2026-10-21T08:00:00Z');
  const finance = createFinanceService(createFinanceRepository(db, id), clock);
  const budget = createBudgetService(createBudgetRepository(db, id), clock);
  const account = await finance.saveAccount(null, null, {
    name: 'Public fixture cash',
    type: 'cash',
    currency: 'PHP',
    opening: '1000.00',
    archived: false,
  });
  const category = await finance.saveCategory(null, null, {
    name: 'Public fixture food',
    kind: 'expense',
    color: '#6D42C7',
  });
  const budgetId = await budget.create({
    name: 'Public October plan',
    currency: 'PHP',
    from: '2026-10-01',
    to: '2026-10-31',
    accountIds: [account.id],
    funding: '1000.00',
  });
  let report = (await budget.overview()).reports[0];
  await budget.saveAllocation(budgetId, report.revision, {
    id: null,
    categoryKey: category.id,
    mode: 'fixed',
    value: '100.00',
  });
  const input = {
    type: 'expense',
    amount: '10.25',
    accountId: account.id,
    toAccountId: null,
    categoryId: category.id,
    description: 'Public fictional expense',
    date: '2026-10-21',
  };
  let expense = await finance.saveTransaction(null, null, id(), input);
  report = (await budget.overview()).reports[0];
  // Expense links are explicit; reuse the reviewed linking service.
  await budget.setLink(budgetId, report.revision, report.categories[0].id, expense.id, true);
  report = (await budget.overview()).reports[0];
  check(
    report.spent === 1025n && (await finance.report()).totals[0].balanceMinor === 98975n,
    'Finance and linked Budget expense reconcile exactly',
  );
  expense = await finance.saveTransaction(expense.id, expense.revision, id(), {
    ...input,
    amount: '20.50',
  });
  check(
    (await budget.overview()).reports[0].spent === 2050n,
    'Finance edits refresh linked Budget calculations',
  );
  await finance.deleteTransaction(expense);
  check(
    (await budget.overview()).reports[0].spent === 0n &&
      (await finance.report()).totals[0].balanceMinor === 100000n,
    'Finance deletion restores Budget and account totals',
  );
  let now = Date.parse('2026-10-21T08:00:00Z');
  const timeRepo = createTimeTrackerRepository(db, id);
  let timer = createTimeTrackerService(timeRepo, () => now);
  const project = await timer.saveProject(null, {
    name: 'Public focus',
    description: 'Fictional',
    color: '#6D42C7',
    archived: false,
  });
  await timer.start(project, 'Public integration timer');
  now += 60000;
  timer = createTimeTrackerService(createTimeTrackerRepository(db, id), () => now);
  const recovered = await timer.active();
  if (!recovered) throw new Error('Persisted timer missing');
  check(
    recovered.status === 'running' && (await timer.summary()).today.totalMs === 60000,
    'Fresh timer service recovers persisted segments',
  );
  const paused = await timer.transition(recovered, 'pause');
  now += 60000;
  await timer.transition(paused, 'stop');
  check(
    (await timer.summary()).today.totalMs === 60000,
    'Paused time is excluded after timer recovery',
  );
  let rolledBack = false;
  try {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('UPDATE notes SET title=? WHERE id=?', 'Should roll back', note.id);
      await tx.runAsync('UPDATE notes SET category_id=? WHERE id=?', 'missing-category', note.id);
    });
  } catch {
    rolledBack = true;
  }
  check(
    rolledBack && (await notes.getById(note.id))?.title === 'Public integration note',
    'Foreign-key failure rolls back cross-record work',
  );
  await initializeDatabase(db);
  check(
    JSON.stringify(
      await db.getAllAsync<import('../../database/rows.ts').MigrationLedgerRow>(
        'SELECT * FROM schema_migrations ORDER BY version',
      ),
    ) === JSON.stringify(ledger) &&
      (await db.getAllAsync('PRAGMA foreign_key_check')).length === 0 &&
      (await db.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check'))
        ?.integrity_check === 'ok',
    'Migration history and cross-module integrity remain valid',
  );
  return results;
}
/** Bounded stress fixture and measurements; never called against the live database. */
export async function measureModuleQueries(
  db: import('expo-sqlite').SQLiteDatabase,
  id: () => string,
) {
  await initializeDatabase(db);
  const stamp = '2026-10-21T08:00:00.000Z';
  const body = 'public fixture '.repeat(585); // approximately 8 KiB per note
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (let i = 0; i < 1000; i++) {
      await tx.runAsync(
        'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
        `perf-note-${i}`,
        `Public ${i}`,
        body,
        stamp,
        stamp,
      );
      await tx.runAsync(
        'INSERT INTO tasks(id,title,description,due_date,created_at,updated_at) VALUES(?,?,?,?,?,?)',
        `perf-task-${i}`,
        `Public ${i}`,
        'Public task',
        '2026-10-21',
        stamp,
        stamp,
      );
    }
  });
  const notes = createNotesRepository(db, id);
  const tasks = createTasksRepository(db, id);
  const calendar = createCalendarService(createCalendarRepository(db, id), tasks);
  const finance = createFinanceService(createFinanceRepository(db, id), () => new Date(stamp));
  const budget = createBudgetService(createBudgetRepository(db, id), () => new Date(stamp));
  const timer = createTimeTrackerService(createTimeTrackerRepository(db, id), () =>
    Date.parse(stamp),
  );
  await calendar.createEvent(
    {
      title: 'Old daily series',
      description: 'Public',
      location: '',
      startLocal: '1900-01-01T09:00',
      endLocal: '1900-01-01T10:00',
      allDay: false,
      categoryId: null,
    },
    { frequency: 'daily', interval: 1, weekdays: [], until: null, count: null },
  );
  const metrics: Record<string, number> = {};

  async function timed(name: string, action: () => Promise<unknown>) {
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await action();
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    metrics[name + 'MedianMs'] = Number(times[2].toFixed(2));
    metrics[name + 'MaxMs'] = Number(times[4].toFixed(2));
  }
  await timed('notes50', () => notes.list({ archived: false, limit: 50 }));
  metrics.notes50BodyCharacters = (await notes.list({ archived: false, limit: 50 })).reduce(
    (sum, n) => sum + n.body.length,
    0,
  );
  await timed('notesPreview50', () => notes.list({ archived: false, limit: 50, preview: true }));
  metrics.notesPreview50BodyCharacters = (
    await notes.list({ archived: false, limit: 50, preview: true })
  ).reduce((sum, n) => sum + n.body.length, 0);
  await timed('tasks50', () =>
    tasks.listTasks({ limit: 50 }, { today: '2026-10-21', localNow: '2026-10-21T12:00' }),
  );
  await timed('calendarTaskQuery', () => tasks.listCalendarTasks('2026-10-21', '2026-10-22'));
  const keys = Array.from({ length: 1000 }, (_, i) => `task:perf-task-${i}`);
  await timed('localeKeySort', async () => {
    [...keys].sort((a, b) => a.localeCompare(b));
  });
  await timed('binaryKeySort', async () => {
    [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  });
  await timed('calendarDay', () => calendar.listRange('2026-10-21', '2026-10-22'));
  await timed('calendarWeek', () => calendar.listRange('2026-10-19', '2026-10-26'));
  await timed('calendarMonth', () => calendar.listRange('2026-10-01', '2026-11-01'));
  // Financial aggregation workload, distinct from the empty-ledger baseline.
  const accounts: import('../../database/repositories/financeRepository.ts').FinancialAccount[] =
    [];
  for (let index = 0; index < 5; index++)
    accounts.push(
      await finance.saveAccount(null, null, {
        name: `Public performance cash ${index}`,
        type: 'cash',
        currency: 'PHP',
        opening: '100000.00',
        archived: false,
      }),
    );
  const category = await finance.saveCategory(null, null, {
    name: 'Public performance expense',
    kind: 'expense',
    color: '#6D42C7',
  });
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (let i = 0; i < 1000; i++)
      await tx.runAsync(
        'INSERT INTO transactions(id,type,amount_minor,currency,account_id,category_id,category_key,category_name,category_color,description,occurred_on,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
        `perf-expense-${i}`,
        'expense',
        100,
        'PHP',
        accounts[i % 5].id,
        category.id,
        category.id,
        category.name,
        category.color,
        'Public fixture',
        '2026-10-21',
        stamp,
        stamp,
      );
  });
  for (let i = 0; i < 5; i++) {
    const plan = await budget.create({
      name: `Public performance plan ${i}`,
      currency: 'PHP',
      from: '2026-10-01',
      to: '2026-10-31',
      accountIds: [accounts[i].id],
      funding: '10000.00',
    });
    let report = (await budget.overview()).reports.find((item) => item.id === plan);
    if (!report) throw new Error('Performance plan missing');
    await budget.saveAllocation(plan, report.revision, {
      id: null,
      categoryKey: category.id,
      mode: 'fixed',
      value: '100.00',
    });
    report = (await budget.overview()).reports.find((item) => item.id === plan);
    if (!report) throw new Error('Performance allocation missing');
    const allocation = report.categories[0].id;
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (let j = 0; j < 20; j++)
        await tx.runAsync(
          'INSERT INTO budget_transaction_links(id,budget_id,allocation_id,transaction_id,created_at) VALUES(?,?,?,?,?)',
          id(),
          plan,
          allocation,
          `perf-expense-${i + 5 * j}`,
          stamp,
        );
    });
  }
  metrics.financialTransactionCount = 1000;
  metrics.budgetCount = 5;
  metrics.linkCount = 100;
  await timed('finance', () => finance.report());
  await timed('budget', () => budget.overview());
  await timed('timer', () => timer.summary());
  metrics.pageCount =
    (await db.getFirstAsync<{ page_count: number }>('PRAGMA page_count'))?.page_count ?? 0;
  metrics.foreignKeyViolations = (await db.getAllAsync('PRAGMA foreign_key_check')).length;
  metrics.notesLibraryIndexUsed = Number(
    (
      await db.getAllAsync<{ detail: string }>(
        'EXPLAIN QUERY PLAN SELECT id FROM notes WHERE is_archived=0 ORDER BY is_pinned DESC,updated_at DESC,id LIMIT 50',
      )
    ).some((row) => String(row.detail).includes('notes_library_idx')),
  );
  return metrics;
}
