import * as SQLite from 'expo-sqlite';
import { uuid } from 'expo';
import { initializeDatabase } from '../../database/initialize.ts';
import { migrations } from '../../database/migrations/index.ts';
import { createFinanceRepository } from '../../database/repositories/financeRepository.ts';
import { createFinanceService } from '../../features/finance/services/financeService.ts';
import { formatMoney } from '../../features/finance/services/money.ts';
import { DatabaseError } from '../../database/errors.ts';

function ensure(value: unknown, label: string) {
  if (!value) throw new DatabaseError('TEST_FAILED', label);
}
export async function runNativeFinanceChecks() {
  if (!__DEV__)
    throw new DatabaseError(
      'DEVELOPMENT_ONLY',
      'Synthetic diagnostics are disabled in release builds.',
    );
  const filename = `maivelle-isolated-finance-${uuid.v4()}.db`;
  let db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
  let passed = false;
  const results = [];
  try {
    ensure(
      formatMoney(900719925474099301n) === 'PHP 9,007,199,254,740,993.01',
      'Native BigInt exact formatting',
    );
    await initializeDatabase(db, migrations.slice(0, 7));
    await db.runAsync(
      "INSERT INTO notes(id,title,body,created_at,updated_at) VALUES('pre-finance-note','Synthetic preserved note','','a','a')",
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
            "SELECT title FROM notes WHERE id='pre-finance-note'",
          )
        )?.title === 'Synthetic preserved note',
      'Migration preservation/idempotency',
    );
    results.push('PASS: native BigInt precision and migration 8 preservation/idempotency');
    const clock = () => new Date('2026-10-20T08:00:00.000Z');
    let service = createFinanceService(createFinanceRepository(db, uuid.v4), clock);
    const cash = await service.saveAccount(null, null, {
      name: 'Fictional native cash',
      type: 'cash',
      currency: 'PHP',
      opening: '1000.01',
      archived: false,
    });
    const bank = await service.saveAccount(null, null, {
      name: 'Fictional native bank',
      type: 'bank',
      currency: 'PHP',
      opening: '0.00',
      archived: false,
    });
    const category = await service.saveCategory(null, null, {
      name: 'Fictional food',
      kind: 'expense',
      color: '#6D42C7',
    });
    const input = {
      type: 'expense',
      amount: '0.01',
      accountId: cash.id,
      toAccountId: null,
      categoryId: category.id,
      description: 'Synthetic 100%_ fixture',
      date: '2026-10-20',
    };
    let expense = await service.saveTransaction(null, null, uuid.v4(), input);
    await service.saveTransaction(null, null, uuid.v4(), {
      ...input,
      type: 'income',
      amount: '100.00',
      categoryId: null,
    });
    const key = uuid.v4();
    const transfer = await service.saveTransaction(null, null, key, {
      ...input,
      type: 'transfer',
      amount: '200.00',
      categoryId: null,
      toAccountId: bank.id,
    });
    await service.saveTransaction(null, null, key, {
      ...input,
      type: 'transfer',
      amount: '200.00',
      categoryId: null,
      toAccountId: bank.id,
    });
    let report = await service.report();
    ensure(
      report.accounts.find((a) => a.id === cash.id)?.balanceMinor === 90000n &&
        report.accounts.find((a) => a.id === bank.id)?.balanceMinor === 20000n &&
        report.incomeMinor === 10000n &&
        report.expenseMinor === 1n &&
        report.totals[0]?.balanceMinor === 110000n,
      'Balance/report reconciliation',
    );
    ensure(
      (await service.history()).length === 3 &&
        (await service.history({ type: 'transfer', accountId: bank.id })).length === 1,
      'One transfer and history filters',
    );
    results.push(
      'PASS: accounts/opening, expense/income, idempotent transfer and balanced reports',
    );
    expense = await service.saveTransaction(expense.id, expense.revision, uuid.v4(), {
      ...input,
      amount: '0.02',
    });
    ensure(
      (await service.getTransaction(expense.id))?.created_at === expense.created_at,
      'Creation preserved',
    );
    await service.deleteTransaction(transfer);
    await service.deleteCategory(category);
    expense = (await service.getTransaction(expense.id)) as NonNullable<
      Awaited<ReturnType<typeof service.getTransaction>>
    >;
    ensure(
      !expense.category_id && expense.category_key === category.id,
      'Category deletion preserves snapshot',
    );
    const archived = await service.archiveAccount(cash, true);
    let rejected = false;
    try {
      await service.saveTransaction(null, null, uuid.v4(), {
        ...input,
        categoryId: null,
      });
    } catch (error) {
      rejected = error instanceof DatabaseError && error.code === 'REFERENCE';
    }
    ensure(rejected, 'Archived account blocks new entries');
    await service.archiveAccount(archived, false);
    results.push(
      'PASS: edit/delete reconcile balances; category deletion and account archive preserve history',
    );
    rejected = false;
    try {
      await service.saveTransaction(null, null, uuid.v4(), {
        ...input,
        amount: '0',
        categoryId: null,
      });
    } catch (error) {
      rejected = error instanceof DatabaseError && error.code === 'VALIDATION';
    }
    ensure(rejected, 'Zero rejected');
    await db.closeAsync();
    db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
    await initializeDatabase(db);
    service = createFinanceService(createFinanceRepository(db, uuid.v4), clock);
    report = await service.report();
    ensure(
      report.accounts.find((a) => a.id === cash.id)?.balanceMinor === 109999n &&
        report.accounts.find((a) => a.id === bank.id)?.balanceMinor === 0n,
      'Restart balance reconciliation',
    );
    ensure(
      (await service.history({ search: '100%_', type: 'expense' })).length === 1,
      'Literal search',
    );
    ensure((await db.getAllAsync('PRAGMA foreign_key_check')).length === 0, 'References valid');
    results.push('PASS: validation, native restart persistence, search and foreign-key integrity');
    passed = true;
    return results;
  } finally {
    await db.closeAsync();
    if (passed) await SQLite.deleteDatabaseAsync(filename);
  }
}
