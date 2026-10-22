import * as SQLite from 'expo-sqlite';
import { uuid } from 'expo';
import { initializeDatabase } from '../../database/initialize.ts';
import { migrations } from '../../database/migrations/index.ts';
import { createFinanceRepository } from '../../database/repositories/financeRepository.ts';
import { createFinanceService } from '../../features/finance/services/financeService.ts';
import { createBudgetRepository } from '../../database/repositories/budgetRepository.ts';
import { createBudgetService } from '../../features/budget/services/budgetService.ts';
import { allocationAmounts } from '../../features/budget/services/budgetMath.ts';
import { DatabaseError } from '../../database/errors.ts';

function ensure(value: unknown, label: string) {
  if (!value) throw new DatabaseError('TEST_FAILED', label);
}
export async function runNativeBudgetChecks() {
  if (!__DEV__)
    throw new DatabaseError(
      'DEVELOPMENT_ONLY',
      'Synthetic diagnostics are disabled in release builds.',
    );
  const filename = `maivelle-isolated-budget-${uuid.v4()}.db`;
  let db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
  let passed = false;
  const results = [];
  try {
    await initializeDatabase(db, migrations.slice(0, 8));
    await db.runAsync(
      "INSERT INTO notes(id,title,body,created_at,updated_at) VALUES('pre-budget','Synthetic preserved note','','a','a')",
    );
    await initializeDatabase(db);
    await initializeDatabase(db);
    ensure(
      (
        await db.getAllAsync<import('../../database/rows.ts').MigrationLedgerRow>(
          'SELECT * FROM schema_migrations',
        )
      ).length === migrations.length &&
        (
          await db.getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
            "SELECT title FROM notes WHERE id='pre-budget'",
          )
        )?.title === 'Synthetic preserved note',
      'Migration preservation',
    );
    results.push('PASS: migration 9 preserves old records and is idempotent');
    const clock = () => new Date('2026-10-20T08:00:00Z');
    const finance = createFinanceService(createFinanceRepository(db, uuid.v4), clock);
    let budget = createBudgetService(createBudgetRepository(db, uuid.v4), clock);
    const a = await finance.saveAccount(null, null, {
      name: 'Fictional budget cash',
      type: 'cash',
      currency: 'PHP',
      opening: '1000.01',
      archived: false,
    });
    const b = await finance.saveAccount(null, null, {
      name: 'Fictional budget bank',
      type: 'bank',
      currency: 'PHP',
      opening: '500.00',
      archived: false,
    });
    const category = await finance.saveCategory(null, null, {
      name: 'Fictional budget food',
      kind: 'expense',
      color: '#6D42C7',
    });
    const input = {
      name: 'Fictional native budget',
      currency: 'PHP',
      from: '2026-10-01',
      to: '2026-10-31',
      accountIds: [a.id, b.id],
      funding: '1500.01',
    };
    const id = await budget.create(input);
    const report = async () => {
      const value = (await budget.overview()).reports.find((r) => r.id === id);
      if (!value) throw new Error('Missing synthetic budget');
      return value;
    };
    const allocation = await budget.saveAllocation(id, 1, {
      id: null,
      categoryKey: category.id,
      mode: 'percent',
      value: '50',
    });
    await budget.saveAllocation(id, 2, {
      id: null,
      categoryKey: 'uncategorized',
      mode: 'fixed',
      value: '750.00',
    });
    ensure((await report()).unallocated === 1n, 'Exact mixed allocation');
    ensure(
      allocationAmounts(1, [
        { id: 'a', mode: 'percent', value: 5000 },
        { id: 'b', mode: 'percent', value: 5000 },
      ]).get('a') === 1n,
      'Native largest remainder',
    );
    let rejected = false;
    try {
      await budget.create(input);
    } catch {
      rejected = true;
    }
    ensure(rejected, 'Overlap rejected');
    results.push(
      'PASS: multi-account snapshot, fixed/percent allocation, centavo rounding, overlap prevention',
    );
    const raw = {
      type: 'expense',
      amount: '10.25',
      accountId: a.id,
      toAccountId: null,
      categoryId: category.id,
      description: 'Fictional native linked expense',
      date: '2026-10-20',
    };
    let expense = await finance.saveTransaction(null, null, uuid.v4(), raw);
    await budget.setLink(id, (await report()).revision, allocation, expense.id, true);
    ensure(
      (await report()).spent === 1025n && (await report()).funding_minor === 150001,
      'Linked snapshot',
    );
    rejected = false;
    try {
      await budget.setLink(id, (await report()).revision, allocation, expense.id, true);
    } catch {
      rejected = true;
    }
    ensure(rejected, 'Duplicate rejected');
    expense = await finance.saveTransaction(expense.id, expense.revision, expense.id, {
      ...raw,
      amount: '20.00',
    });
    ensure((await report()).spent === 2000n, 'Finance edit live');
    await finance.deleteTransaction(expense);
    ensure(
      (await report()).spent === 0n && (await report()).links.length === 0,
      'Native temporary-connection delete cleanup',
    );
    ensure((await report()).accountBalance === 150001n, 'Finance reconciliation');
    results.push(
      'PASS: native expense linking, duplicate prevention, Finance edits/deletion and balance reconciliation',
    );
    await budget.adjustFunding(
      id,
      (await report()).revision,
      '1500.00',
      'Synthetic centavo adjustment',
    );
    await budget.edit(id, (await report()).revision, 'Fictional archived budget', true);
    await db.closeAsync();
    db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
    await initializeDatabase(db);
    budget = createBudgetService(createBudgetRepository(db, uuid.v4), clock);
    ensure(
      (await report()).archived === 1 &&
        (await report()).fundingHistory.length === 2 &&
        (await report()).funding_minor === 150000,
      'Persisted archive/funding',
    );
    results.push('PASS: funding audit, archive and native database reopen persistence');
    passed = true;
    return results;
  } finally {
    await db.closeAsync();
    if (passed) await SQLite.deleteDatabaseAsync(filename);
  }
}
