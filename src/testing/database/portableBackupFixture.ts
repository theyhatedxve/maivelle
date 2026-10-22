import { createTasksRepository } from '../../database/repositories/tasksRepository.ts';
import { createTasksService } from '../../features/tasks/services/tasksService.ts';
import { createCalendarRepository } from '../../database/repositories/calendarRepository.ts';
import { createCalendarService } from '../../features/calendar/services/calendarService.ts';
import { createMedicineRepository } from '../../database/repositories/medicineRepository.ts';
import { createMedicineService } from '../../features/medicine/services/medicineService.ts';
import { createTimeTrackerRepository } from '../../database/repositories/timeTrackerRepository.ts';
import { createTimeTrackerService } from '../../features/timeTracker/services/timeTrackerService.ts';
import { createFinanceRepository } from '../../database/repositories/financeRepository.ts';
import { createFinanceService } from '../../features/finance/services/financeService.ts';
import { createBudgetRepository } from '../../database/repositories/budgetRepository.ts';
import { createBudgetService } from '../../features/budget/services/budgetService.ts';
import {
  createMedicineReconciler,
  MEDICINE_OWNER,
} from '../../services/notifications/medicineReconciler.ts';
// Fixed reviewed identifiers only. Small fictional fixtures, never application data.
const tables = [
  'notes',
  'tasks',
  'task_categories',
  'subtasks',
  'calendar_events',
  'calendar_event_exceptions',
  'medicines',
  'medicine_schedules',
  'medicine_dose_logs',
  'time_projects',
  'time_sessions',
  'time_session_segments',
  'financial_accounts',
  'transaction_categories',
  'transactions',
  'budgets',
  'budget_accounts',
  'budget_allocations',
  'budget_transaction_links',
  'vault_metadata',
  'vault_items',
];
/** Caller must supply an isolated, initialized fixture database. */
export async function seedPortableModules(
  db: import('expo-sqlite').SQLiteDatabase,
  id: () => string,
) {
  const clock = () => new Date('2026-10-21T07:00:00Z');
  const tasksRepository = createTasksRepository(db, id);
  const tasks = createTasksService(tasksRepository, clock);
  const group = await tasks.createCategory('Public restore category');
  const task = await tasks.createTask({
    title: 'Public restore task',
    categoryId: group.id,
    dueDate: '2026-10-21',
  });
  await tasks.createSubtask(task.id, 'Public restore subtask');
  const calendar = createCalendarService(createCalendarRepository(db, id), tasksRepository);
  const event = await calendar.createEvent(
    {
      title: 'Public restore event',
      description: 'Fictional',
      location: '',
      startLocal: '2026-10-21T09:00',
      endLocal: '2026-10-21T10:00',
      allDay: false,
      categoryId: null,
    },
    { frequency: 'daily', interval: 1, weekdays: [], until: null, count: 3 },
  );
  await calendar.cancelOccurrence(event.id, '2026-10-22T09:00', true);
  const medicine = createMedicineService(createMedicineRepository(db, id), clock);
  const item = await medicine.save(null, {
    name: 'Public fictional restore medicine',
    form: 'Synthetic',
    instructions: 'No real dosage',
    notes: 'Fictional only',
    active: true,
    startDate: null,
    endDate: null,
    schedules: [
      {
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        times: ['08:00', '20:00'],
        startDate: null,
        endDate: null,
      },
    ],
  });
  const doses = await medicine.doses('2026-10-21', '2026-10-22', item.id);
  await medicine.record(doses[0].id, 'taken');
  let now = clock().getTime();
  const timer = createTimeTrackerService(createTimeTrackerRepository(db, id), () => now);
  const project = await timer.saveProject(null, {
    name: 'Public restore focus',
    description: '',
    color: '#6D42C7',
    archived: false,
  });
  const session = await timer.start(project, 'Public restored timer');
  now += 60000;
  await timer.transition(session, 'stop');
  const finance = createFinanceService(createFinanceRepository(db, id), clock);
  const budget = createBudgetService(createBudgetRepository(db, id), clock);
  const account = await finance.saveAccount(null, null, {
    name: 'Public restore cash',
    type: 'cash',
    currency: 'PHP',
    opening: '1000.00',
    archived: false,
  });
  const category = await finance.saveCategory(null, null, {
    name: 'Public restore expense',
    kind: 'expense',
    color: '#6D42C7',
  });
  const plan = await budget.create({
    name: 'Public restore budget',
    currency: 'PHP',
    from: '2026-10-01',
    to: '2026-10-31',
    accountIds: [account.id],
    funding: '1000.00',
  });
  let report = (await budget.overview()).reports[0];
  await budget.saveAllocation(plan, report.revision, {
    id: null,
    categoryKey: category.id,
    mode: 'fixed',
    value: '100.00',
  });
  const expense = await finance.saveTransaction(null, null, id(), {
    type: 'expense',
    amount: '10.25',
    accountId: account.id,
    toAccountId: null,
    categoryId: category.id,
    description: 'Public fictional restore expense',
    date: '2026-10-21',
  });
  report = (await budget.overview()).reports[0];
  await budget.setLink(plan, report.revision, report.categories[0].id, expense.id, true);
}
/** No records are logged; compare exact fixture rows including stable IDs and timestamps. */
export async function portableRecords(db: import('../../database/types.ts').Database) {
  const records: Record<string, unknown[]> = {};
  for (const table of tables)
    records[table] = await db.getAllAsync(`SELECT * FROM ${table} ORDER BY rowid`);
  return records;
}
/** Rebuild device-derived requests with a recording adapter, never real alarms.
Tests native SQLite + real reconciler; does not claim Android OS delivery. */
export async function verifyRestoredReminders(
  db: import('expo-sqlite').SQLiteDatabase,
  id: () => string,
) {
  const now = new Date('2026-10-21T07:00:00Z');
  const repo = createMedicineRepository(db, id);
  const medicine = createMedicineService(repo, () => now);
  const doses = await medicine.doses('2026-10-21', '2026-10-22');
  const pending: Map<
    string,
    {
      id: string;
      owner: string;
      occurrenceId: string;
      scheduledAt: string;
      delivery: string;
    }
  > = new Map();
  const reconciler = createMedicineReconciler(repo, {
    permissions: async () => ({ granted: true, exact: false }),
    pending: async () => [...pending.values()],
    cancel: async (key) => {
      pending.delete(key);
    },
    schedule: async (dose, key, delivery) => {
      pending.set(key, {
        id: key,
        owner: MEDICINE_OWNER,
        occurrenceId: dose.id,
        scheduledAt: dose.scheduledAt,
        delivery,
      });
      return key;
    },
  });
  await reconciler.reconcile(doses, now);
  if (!pending.size || (await repo.jobs()).length !== pending.size)
    throw new Error('Restored reminder reconciliation failed');
  return pending.size;
}
