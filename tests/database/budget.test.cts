const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname, basename } = require('node:path');
const { openTestDatabase } = require('./sqliteAdapter.cts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { migrations } = require('../../src/database/migrations/index.ts');
const { createFinanceRepository } = require('../../src/database/repositories/financeRepository.ts');
const { createFinanceService } = require('../../src/features/finance/services/financeService.ts');
const { createBudgetRepository } = require('../../src/database/repositories/budgetRepository.ts');
const { createBudgetService } = require('../../src/features/budget/services/budgetService.ts');
const { allocationAmounts } = require('../../src/features/budget/services/budgetMath.ts');
const clock = () => new Date('2026-10-20T08:00:00Z');
async function setup(db) {
  await initializeDatabase(db);
  const finance = createFinanceService(createFinanceRepository(db, randomUUID), clock);
  const budget = createBudgetService(createBudgetRepository(db, randomUUID), clock);
  const a = await finance.saveAccount(null, null, {
    name: 'Synthetic budget cash',
    type: 'cash',
    currency: 'PHP',
    opening: '1000.01',
    archived: false,
  });
  const b = await finance.saveAccount(null, null, {
    name: 'Synthetic budget bank',
    type: 'bank',
    currency: 'PHP',
    opening: '500.00',
    archived: false,
  });
  const food = await finance.saveCategory(null, null, {
    name: 'Fictional food',
    kind: 'expense',
    color: '#6D42C7',
  });
  const raw = {
    name: 'Synthetic October',
    currency: 'PHP',
    from: '2026-10-01',
    to: '2026-10-31',
    accountIds: [a.id],
    funding: '1000.01',
  };
  const id = await budget.create(raw);
  const report = async () => (await budget.overview()).reports.find((r) => r.id === id);
  const allocate = async (
    categoryKey = food.id,
    mode = 'fixed',
    value = '100.00',
    allocationId = null,
  ) =>
    budget.saveAllocation(id, (await report()).revision, {
      id: allocationId,
      categoryKey,
      mode,
      value,
    });
  const expenseInput = {
    type: 'expense',
    amount: '10.25',
    accountId: a.id,
    toAccountId: null,
    categoryId: food.id,
    description: 'Fictional budget expense',
    date: '2026-10-20',
  };
  const expense = (overrides = {}) =>
    finance.saveTransaction(null, null, randomUUID(), {
      ...expenseInput,
      ...overrides,
    });
  const link = async (allocationId, transactionId, linked = true) =>
    budget.setLink(id, (await report()).revision, allocationId, transactionId, linked);
  return {
    db,
    finance,
    budget,
    a,
    b,
    food,
    raw,
    id,
    report,
    allocate,
    expense,
    expenseInput,
    link,
  };
}
async function fixture(t) {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  return setup(db);
}
test('budget creation records fixed source balances, preserves Finance ledger, supports rename', async (t) => {
  const f = await fixture(t);
  const r = await f.report();
  assert.equal(r.funding_minor, 100001);
  assert.equal(r.unallocated, 100001n);
  assert.equal(JSON.parse(r.source_snapshot)[0].balanceMinor, '100001');
  assert.equal(r.fundingHistory.length, 1);
  await f.expense();
  const changed = await f.report();
  assert.equal(changed.funding_minor, 100001);
  assert.equal(changed.accountBalance, 98976n);
  assert.equal(changed.spent, 0n);
  await f.budget.edit(f.id, changed.revision, 'Renamed budget', false);
  const updated = await f.report();
  assert.equal(updated.name, 'Renamed budget');
  assert.equal(updated.created_at, r.created_at);
});
test('fixed and percentage allocations use exact centavos and prevent over-allocation', async (t) => {
  const f = await fixture(t);
  const a = await f.allocate(f.food.id, 'percent', '50');
  await f.allocate('uncategorized', 'fixed', '500.00');
  const r = await f.report();
  assert.equal(r.categories.find((c) => c.id === a).allocated, 50000n);
  assert.equal(r.unallocated, 1n);
  await assert.rejects(f.allocate(f.food.id, 'percent', '50.01', a), /exceed funding/);
  assert.equal((await f.report()).unallocated, 1n);
});
test('largest remainder rounds deterministically independent of array ordering including huge bounded funding', () => {
  const rows = [
    { id: 'b', mode: 'percent', value: 5000 },
    { id: 'a', mode: 'percent', value: 5000 },
  ];
  assert.equal(allocationAmounts(1, rows).get('a'), 1n);
  assert.equal(allocationAmounts(1, [...rows].reverse()).get('a'), 1n);
  const large = allocationAmounts(999999999999, rows);
  assert.equal(large.get('a') + large.get('b'), 999999999999n);
  assert.throws(() => allocationAmounts(100, [{ id: 'a', mode: 'percent', value: 10001 }]), /100%/);
});
test('zero funding and zero allocations are valid while negatives and empty forms are rejected', async (t) => {
  const f = await fixture(t);
  const zero = await f.budget.create({
    ...f.raw,
    name: 'Zero',
    accountIds: [f.b.id],
    funding: '0',
  });
  await f.budget.saveAllocation(zero, 1, {
    id: null,
    categoryKey: 'uncategorized',
    mode: 'fixed',
    value: '0',
  });
  for (const overrides of [
    { name: '' },
    { accountIds: [] },
    { accountIds: [f.a.id, f.a.id] },
    { currency: 'JPY' },
    { from: '2026-02-30' },
    { to: '2026-09-01' },
    { funding: '-1' },
    { funding: '1e3' },
  ])
    await assert.rejects(f.budget.create({ ...f.raw, ...overrides }));
  for (const value of ['', '-1', '100.01', 'NaN', '1.001'])
    await assert.rejects(f.allocate(f.food.id, 'percent', value));
});
test('funding exceeds balances rejected, accounts must be active and single currency', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    f.budget.create({ ...f.raw, accountIds: [f.b.id], funding: '500.01' }),
    /exceeds/,
  );
  const usd = await f.finance.saveAccount(null, null, {
    name: 'Fictional USD',
    type: 'cash',
    currency: 'USD',
    opening: '100',
    archived: false,
  });
  await assert.rejects(
    f.budget.create({ ...f.raw, accountIds: [f.b.id, usd.id], funding: '100' }),
    /currency/,
  );
  await f.finance.archiveAccount(f.b, true);
  await assert.rejects(
    f.budget.create({ ...f.raw, accountIds: [f.b.id], funding: '100' }),
    /active/,
  );
});
test('multi-account scope reconciles balances including internal transfers without modifying snapshot', async (t) => {
  const f = await fixture(t);
  const id = await f.budget.create({
    ...f.raw,
    from: '2026-11-01',
    to: '2026-11-30',
    accountIds: [f.a.id, f.b.id],
    funding: '1500.01',
  });
  await f.expense({
    type: 'transfer',
    amount: '200',
    toAccountId: f.b.id,
    categoryId: null,
  });
  const r = (await f.budget.overview()).reports.find((r) => r.id === id);
  assert.equal(r.accountBalance, 150001n);
  assert.equal(r.funding_minor, 150001);
  assert.equal(r.spent, 0n);
  assert.equal(JSON.parse(r.source_snapshot).length, 2);
});
test('overlapping account scopes are rejected even for archives; adjacent dates are allowed', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    f.budget.create({
      ...f.raw,
      accountIds: [f.a.id, f.b.id],
      from: '2026-10-31',
      to: '2026-11-30',
    }),
    /already reserves/,
  );
  await f.budget.edit(f.id, 1, f.raw.name, true);
  await assert.rejects(f.budget.create(f.raw), /already reserves/);
  await f.budget.create({ ...f.raw, from: '2026-11-01', to: '2026-11-30' });
});
test('link/unlink expense tracks actual spending without duplicate transactions or changes to balances', async (t) => {
  const f = await fixture(t);
  const a = await f.allocate();
  const expense = await f.expense();
  const before = await f.finance.report();
  await f.link(a, expense.id);
  assert.equal((await f.report()).spent, 1025n);
  assert.equal((await f.report()).categories[0].remaining, 8975n);
  await assert.rejects(f.link(a, expense.id), /already linked/);
  assert.equal((await f.db.getFirstAsync('SELECT COUNT(*) n FROM transactions')).n, 1);
  assert.deepEqual((await f.finance.report()).totals, before.totals);
  await f.link(a, expense.id, false);
  assert.equal((await f.report()).spent, 0n);
});
test('only correct category, date, currency and scoped expense can be linked; date boundaries inclusive', async (t) => {
  const f = await fixture(t);
  const a = await f.allocate();
  for (const overrides of [
    { type: 'income', categoryId: null },
    { type: 'transfer', categoryId: null, toAccountId: f.b.id },
    { accountId: f.b.id },
    { categoryId: null },
    { date: '2026-09-30' },
  ]) {
    const row = await f.expense(overrides);
    await assert.rejects(f.link(a, row.id), /Choose an expense/);
  }
  const first = await f.expense({ date: '2026-10-01' });
  await f.link(a, first.id);
  assert.equal((await f.report()).spent, 1025n);
  const lastId = await f.budget.create({
    ...f.raw,
    accountIds: [f.b.id],
    from: '2026-10-01',
    to: '2026-10-20',
    funding: '100',
  });
  const alloc = await f.budget.saveAllocation(lastId, 1, {
    id: null,
    categoryKey: f.food.id,
    mode: 'fixed',
    value: '100',
  });
  const last = await f.expense({ accountId: f.b.id, date: '2026-10-20' });
  await f.budget.setLink(lastId, 2, alloc, last.id, true);
});
test('Finance amount edits and deletes recalculate reports, also with FK pragma off temporary connections', async (t) => {
  const f = await fixture(t);
  const a = await f.allocate();
  let expense = await f.expense();
  await f.link(a, expense.id);
  expense = await f.finance.saveTransaction(expense.id, expense.revision, expense.id, {
    ...f.expenseInput,
    amount: '200',
  });
  assert.equal((await f.report()).spent, 20000n);
  assert.equal((await f.report()).categories[0].remaining, -10000n);
  await f.db.execAsync('PRAGMA foreign_keys=OFF');
  await f.finance.deleteTransaction(expense);
  assert.equal((await f.report()).spent, 0n);
  assert.equal((await f.report()).links.length, 0);
  await f.db.execAsync('PRAGMA foreign_keys=ON');
});
test('Finance edits moving expense out of category or period exclude but retain reviewable link', async (t) => {
  const f = await fixture(t);
  const a = await f.allocate();
  let row = await f.expense();
  await f.link(a, row.id);
  row = await f.finance.saveTransaction(row.id, row.revision, row.id, {
    ...f.expenseInput,
    date: '2026-09-30',
  });
  assert.equal((await f.report()).spent, 0n);
  assert.equal((await f.report()).links[0].valid, false);
  row = await f.finance.saveTransaction(row.id, row.revision, row.id, {
    ...f.expenseInput,
    categoryId: null,
  });
  assert.equal((await f.report()).spent, 0n);
  await f.link(a, row.id, false);
  assert.equal((await f.report()).links.length, 0);
});
test('deleting Finance category retains category identity and linked spending history', async (t) => {
  const f = await fixture(t);
  const a = await f.allocate();
  const row = await f.expense();
  await f.link(a, row.id);
  await f.finance.deleteCategory(f.food);
  const r = await f.report();
  assert.equal(r.spent, 1025n);
  assert.equal(r.categories[0].category_name, 'Fictional food');
  await f.allocate(f.food.id, 'fixed', '200', a);
  assert.equal((await f.report()).spent, 1025n);
});
test('allocation editing keeps stable IDs/spending; immutable category and duplicate category rejected', async (t) => {
  const f = await fixture(t);
  const a = await f.allocate();
  const row = await f.expense();
  await f.link(a, row.id);
  const before = (await f.report()).categories[0];
  await f.allocate(f.food.id, 'fixed', '0', a);
  const after = (await f.report()).categories[0];
  assert.equal(after.id, before.id);
  assert.equal(after.created_at, before.created_at);
  assert.equal(after.spent, 1025n);
  await assert.rejects(f.allocate('uncategorized', 'fixed', '0', a), /fixed/);
  await assert.rejects(f.allocate(), /already has an allocation/);
});
test('explicit funding adjustments have audit records, respect allocations and cannot reuse same balance repeatedly', async (t) => {
  const f = await fixture(t);
  await f.allocate(f.food.id, 'percent', '50');
  await f.budget.adjustFunding(f.id, (await f.report()).revision, '800', 'Synthetic correction');
  let r = await f.report();
  assert.equal(r.categories[0].allocated, 40000n);
  assert.equal(r.fundingHistory.length, 2);
  assert.equal(JSON.parse(r.source_snapshot)[0].balanceMinor, '100001');
  await f.budget.adjustFunding(f.id, r.revision, '900', 'Synthetic increase');
  r = await f.report();
  await assert.rejects(
    f.budget.adjustFunding(f.id, r.revision, '1100', 'Invalid reuse'),
    /exceeds/,
  );
  await assert.rejects(f.budget.adjustFunding(f.id, r.revision, '900', ''), /reason/);
  await f.allocate('uncategorized', 'fixed', '400');
  r = await f.report();
  await assert.rejects(
    f.budget.adjustFunding(f.id, r.revision, '100', 'Too little'),
    /exceed funding/,
  );
});
test('archives preserve reports but block mutations; restore and stale-editor protection', async (t) => {
  const f = await fixture(t);
  const a = await f.allocate();
  const row = await f.expense();
  await f.link(a, row.id);
  let r = await f.report();
  await f.budget.edit(f.id, r.revision, r.name, true);
  r = await f.report();
  assert.equal(r.spent, 1025n);
  await assert.rejects(f.allocate(), /Restore/);
  await assert.rejects(f.link(a, row.id, false), /Restore/);
  await f.budget.edit(f.id, r.revision, r.name, false);
  await assert.rejects(f.budget.edit(f.id, r.revision, 'Stale', false), /changed/);
});
test('database checks and parameter binding defend schema and SQL-like user text', async (t) => {
  const f = await fixture(t);
  await f.budget.edit(f.id, 1, "'); DROP TABLE notes; --", false);
  assert.equal((await f.report()).name, "'); DROP TABLE notes; --");
  await assert.rejects(
    f.db.runAsync('UPDATE budgets SET funding_minor=? WHERE id=?', 1.25, f.id),
    /CHECK/,
  );
  await assert.rejects(
    f.db.runAsync('UPDATE budgets SET ends_on=? WHERE id=?', '2026-02-30', f.id),
    /CHECK/,
  );
  assert.equal((await f.db.getAllAsync('PRAGMA foreign_key_check')).length, 0);
});
test('migration 9 preserves old records, is idempotent and survives reopening disk storage', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'maivelle-budget-test-'));
  const path = join(dir, 'local.db');
  let db = openTestDatabase(path);
  t.after(async () => {
    await db.closeAsync();
    const target = resolve(dir);
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !basename(target).startsWith('maivelle-budget-test-')
    )
      throw Error('Unsafe cleanup');
    rmSync(target, { recursive: true });
  });
  await initializeDatabase(db, migrations.slice(0, 8));
  await db.runAsync(
    "INSERT INTO notes(id,title,body,created_at,updated_at) VALUES('pre-budget','Synthetic old note','','a','a')",
  );
  const f = await setup(db);
  const a = await f.allocate();
  const row = await f.expense();
  await f.link(a, row.id);
  await initializeDatabase(db);
  await initializeDatabase(db);
  await db.closeAsync();
  db = openTestDatabase(path);
  await initializeDatabase(db);
  const service = createBudgetService(createBudgetRepository(db, randomUUID), clock);
  const r = (await service.overview()).reports.find((b) => b.id === f.id);
  assert.equal(r.spent, 1025n);
  assert.equal(
    (await db.getFirstAsync("SELECT title FROM notes WHERE id='pre-budget'")).title,
    'Synthetic old note',
  );
  assert.equal((await db.getAllAsync('SELECT * FROM schema_migrations')).length, migrations.length);
});
test('corrupt funding snapshot surfaces a meaningful error without resetting data', async (t) => {
  const f = await fixture(t);
  await f.db.runAsync('UPDATE budgets SET source_snapshot=? WHERE id=?', '{}', f.id);
  await assert.rejects(f.budget.overview(), { code: 'CORRUPT_SNAPSHOT' });
  assert.equal((await f.db.getFirstAsync('SELECT COUNT(*) n FROM budgets')).n, 1);
  assert.equal((await f.db.getFirstAsync('SELECT COUNT(*) n FROM financial_accounts')).n, 2);
});
