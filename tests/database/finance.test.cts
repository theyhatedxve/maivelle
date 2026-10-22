const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname, basename } = require('node:path');
const { spawnSync } = require('node:child_process');
const { openTestDatabase } = require('./sqliteAdapter.cts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { applyMigrations } = require('../../src/database/migrations/migrate.ts');
const { migrations } = require('../../src/database/migrations/index.ts');
const { createFinanceRepository } = require('../../src/database/repositories/financeRepository.ts');
const { createFinanceService } = require('../../src/features/finance/services/financeService.ts');
const {
  parseMoney,
  formatMoney,
  moneyInput,
  MAX_MINOR,
} = require('../../src/features/finance/services/money.ts');
const { ledgerBalances } = require('../../src/features/finance/services/financeLedger.ts');
const accountInput = (name = 'Synthetic cash', opening = '1000.00', currency = 'PHP') => ({
  name,
  type: 'cash',
  currency,
  opening,
  archived: false,
});
const entry = (accountId, values = {}) => ({
  type: 'expense',
  amount: '10.25',
  accountId,
  toAccountId: null,
  categoryId: null,
  description: 'Fictional fixture',
  date: '2026-10-20',
  ...values,
});
async function fixture(t) {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db);
  let now = new Date('2026-10-20T08:00:00.000Z');
  const repository = createFinanceRepository(db, randomUUID);
  const service = createFinanceService(repository, () => now);
  const a = await service.saveAccount(null, null, accountInput());
  const b = await service.saveAccount(null, null, accountInput('Synthetic bank', '500.00'));
  return {
    db,
    repository,
    service,
    a,
    b,
    advance: () => {
      now = new Date(now.getTime() + 1000);
    },
    save: (input, key = randomUUID()) => service.saveTransaction(null, null, key, input),
  };
}
const balance = (report, id) => report.accounts.find((a) => a.id === id).balanceMinor;
test('decimal money uses exact centavos and BigInt formatting, including huge totals', () => {
  for (const [input, expected] of [
    ['0.01', 1],
    ['0.10', 10],
    ['1.1', 110],
    ['9999999999.99', MAX_MINOR],
    [' 12.34 ', 1234],
  ])
    assert.equal(parseMoney(input), expected);
  assert.equal(parseMoney('-1.01', true), -101);
  assert.equal(parseMoney('0', true), 0);
  assert.equal(moneyInput(-101), '-1.01');
  assert.equal(formatMoney(900719925474099301n), 'PHP 9,007,199,254,740,993.01');
  for (const value of [
    '',
    ' ',
    0,
    NaN,
    Infinity,
    '0',
    '0.00',
    '-1',
    '1.001',
    '1e3',
    '1,000.00',
    '.25',
    '1.',
    '10000000000.00',
    '9007199254740993',
  ])
    assert.throws(() => parseMoney(value), { code: 'VALIDATION' });
});
test('accounts create/edit preserve IDs, creation time, revision and opening balances separate from income', async (t) => {
  const f = await fixture(t);
  let report = await f.service.report();
  assert.equal(balance(report, f.a.id), 100000n);
  assert.equal(report.incomeMinor, 0n);
  assert.equal(report.expenseMinor, 0n);
  assert.equal(report.totals[0].balanceMinor, 150000n);
  f.advance();
  const updated = await f.service.saveAccount(f.a.id, f.a.revision, {
    ...accountInput('Renamed cash', '1000.01'),
    type: 'ewallet',
  });
  assert.equal(updated.id, f.a.id);
  assert.equal(updated.created_at, f.a.created_at);
  assert.notEqual(updated.updated_at, f.a.updated_at);
  assert.equal(updated.revision, 2);
  assert.equal(balance(await f.service.report(), f.a.id), 100001n);
  await assert.rejects(f.service.saveAccount(f.a.id, f.a.revision, accountInput()), {
    code: 'CONFLICT',
  });
  await assert.rejects(
    f.service.saveAccount(f.a.id, updated.revision, accountInput('X', '1.00', 'USD')),
    { code: 'VALIDATION' },
  );
});
test('income/expense entries reconcile exact balances and positive integer amounts', async (t) => {
  const f = await fixture(t);
  await f.save(entry(f.a.id, { type: 'income', amount: '100.10' }));
  await f.save(entry(f.a.id, { amount: '0.20' }));
  await f.save(entry(f.a.id, { amount: '0.10' }));
  const report = await f.service.report();
  assert.equal(balance(report, f.a.id), 109980n);
  assert.equal(report.incomeMinor, 10010n);
  assert.equal(report.expenseMinor, 30n);
  assert.equal(report.netMinor, 9980n);
  assert.equal(
    (await f.db.getFirstAsync('SELECT typeof(amount_minor) t FROM transactions')).t,
    'integer',
  );
});
test('one transfer row changes both accounts atomically and never counts as income/expense', async (t) => {
  const f = await fixture(t);
  const transfer = await f.save(
    entry(f.a.id, { type: 'transfer', amount: '123.45', toAccountId: f.b.id }),
  );
  let report = await f.service.report();
  assert.equal(balance(report, f.a.id), 87655n);
  assert.equal(balance(report, f.b.id), 62345n);
  assert.equal(report.totals[0].balanceMinor, 150000n);
  assert.equal(report.incomeMinor, 0n);
  assert.equal(report.expenseMinor, 0n);
  assert.equal((await f.db.getFirstAsync('SELECT COUNT(*) n FROM transactions')).n, 1);
  const updated = await f.service.saveTransaction(
    transfer.id,
    transfer.revision,
    'ignored',
    entry(f.a.id, { type: 'transfer', amount: '23.45', toAccountId: f.b.id }),
  );
  report = await f.service.report();
  assert.equal(balance(report, f.a.id), 97655n);
  assert.equal(balance(report, f.b.id), 52345n);
  assert.equal(updated.created_at, transfer.created_at);
  await f.service.deleteTransaction(updated);
  report = await f.service.report();
  assert.equal(balance(report, f.a.id), 100000n);
  assert.equal(balance(report, f.b.id), 50000n);
});
test('same-account and cross-currency transfers fail without any partial write', async (t) => {
  const f = await fixture(t);
  const usd = await f.service.saveAccount(
    null,
    null,
    accountInput('Synthetic USD', '10.00', 'USD'),
  );
  await assert.rejects(f.save(entry(f.a.id, { type: 'transfer', toAccountId: f.a.id })), {
    code: 'VALIDATION',
  });
  await assert.rejects(f.save(entry(f.a.id, { type: 'transfer', toAccountId: usd.id })), {
    code: 'VALIDATION',
  });
  assert.equal((await f.service.history()).length, 0);
  assert.equal(
    (await f.service.report()).totals.find((r) => r.currency === 'USD').balanceMinor,
    1000n,
  );
});
test('duplicate submission token is idempotent; changed retries and simultaneous taps do not duplicate', async (t) => {
  const f = await fixture(t);
  const token = randomUUID();
  const input = entry(f.a.id, { type: 'transfer', toAccountId: f.b.id });
  const first = await f.save(input, token);
  const again = await f.save(input, token);
  assert.equal(first.id, again.id);
  assert.equal(again.revision, 1);
  await assert.rejects(f.save({ ...input, amount: '1.00' }, token), {
    code: 'CONFLICT',
  });
  const results = await Promise.allSettled([f.save(entry(f.a.id)), f.save(entry(f.a.id))]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await f.service.history()).length, 2);
});
test('separate service instances retry the same committed command without duplicating transfer', async (t) => {
  const f = await fixture(t);
  const token = randomUUID();
  const input = entry(f.a.id, { type: 'transfer', toAccountId: f.b.id });
  await f.save(input, token);
  const second = createFinanceService(
    createFinanceRepository(f.db, randomUUID),
    () => new Date('2026-10-20T08:00:00Z'),
  );
  await second.saveTransaction(null, null, token, input);
  assert.equal((await f.service.history()).length, 1);
  assert.equal((await f.service.report()).totals[0].balanceMinor, 150000n);
});
test('transaction edits preserve identity and creation time without double-counting; stale delete rejected', async (t) => {
  const f = await fixture(t);
  const original = await f.save(entry(f.a.id));
  f.advance();
  const changed = await f.service.saveTransaction(
    original.id,
    original.revision,
    'ignored',
    entry(f.b.id, { type: 'income', amount: '20.00' }),
  );
  const report = await f.service.report();
  assert.equal(changed.id, original.id);
  assert.equal(changed.created_at, original.created_at);
  assert.notEqual(changed.updated_at, original.updated_at);
  assert.equal(balance(report, f.a.id), 100000n);
  assert.equal(balance(report, f.b.id), 52000n);
  assert.equal(report.expenseMinor, 0n);
  assert.equal(report.incomeMinor, 2000n);
  await assert.rejects(f.service.deleteTransaction(original), {
    code: 'CONFLICT',
  });
  await f.service.deleteTransaction(changed);
  assert.equal(balance(await f.service.report(), f.b.id), 50000n);
});
test('negative opening and derived balances are allowed and reconcile exactly', async (t) => {
  const f = await fixture(t);
  const debt = await f.service.saveAccount(null, null, accountInput('Synthetic negative', '-0.01'));
  await f.save(entry(debt.id, { amount: '0.02' }));
  assert.equal(balance(await f.service.report(), debt.id), -3n);
});
test('archiving preserves totals/history, rejects new entries, permits editing existing entries and restores', async (t) => {
  const f = await fixture(t);
  const row = await f.save(entry(f.a.id));
  const archived = await f.service.archiveAccount(f.a, true);
  assert.equal((await f.service.history({ accountId: f.a.id })).length, 1);
  assert.equal(balance(await f.service.report(), f.a.id), 98975n);
  await assert.rejects(f.save(entry(f.a.id)), { code: 'REFERENCE' });
  await assert.rejects(f.save(entry(f.b.id, { type: 'transfer', toAccountId: f.a.id })), {
    code: 'REFERENCE',
  });
  await f.service.saveTransaction(
    row.id,
    row.revision,
    'unused',
    entry(f.a.id, { amount: '1.00' }),
  );
  await f.service.archiveAccount(archived, false);
  await f.save(entry(f.a.id, { amount: '2.00' }));
  assert.equal(balance(await f.service.report(), f.a.id), 99700n);
});
test('category CRUD enforces kind and preserves transaction snapshots and stable historical grouping on deletion', async (t) => {
  const f = await fixture(t);
  let category = await f.service.saveCategory(null, null, {
    name: 'Fictional food',
    kind: 'expense',
    color: '#6D42C7',
  });
  const original = await f.save(entry(f.a.id, { categoryId: category.id }));
  await assert.rejects(f.save(entry(f.a.id, { type: 'income', categoryId: category.id })), {
    code: 'REFERENCE',
  });
  category = await f.service.saveCategory(category.id, category.revision, {
    name: 'Fictional renamed',
    kind: 'expense',
    color: '#2563EB',
  });
  assert.equal((await f.service.report()).categories[0].name, 'Fictional renamed');
  await f.service.deleteCategory(category);
  const row = await f.service.getTransaction(original.id);
  assert.equal(row.category_id, null);
  assert.equal(row.category_key, category.id);
  assert.equal(row.category_label, 'Fictional food');
  assert.equal((await f.service.report()).expenseMinor, 1025n);
  assert.equal((await f.service.report()).categories[0].id, category.id);
  await assert.rejects(f.service.deleteTransaction(original), {
    code: 'CONFLICT',
  });
  const sameName = await f.service.saveCategory(null, null, {
    name: 'Fictional food',
    kind: 'expense',
    color: '#6D42C7',
  });
  await f.save(entry(f.a.id, { categoryId: sameName.id }));
  await f.service.deleteCategory(sameName);
  assert.equal((await f.service.report()).categories.length, 2);
});
test('literal bound search, account/incoming-transfer/category/type/date filters and sorting work', async (t) => {
  const f = await fixture(t);
  const category = await f.service.saveCategory(null, null, {
    name: 'Fictional category',
    kind: 'income',
    color: '#8B5CF6',
  });
  await f.save(
    entry(f.a.id, {
      description: "Literal 100%_'); DROP TABLE notes; --",
      date: '2026-10-19',
    }),
  );
  await f.save(entry(f.b.id, { type: 'income', categoryId: category.id, amount: '20.00' }));
  await f.save(entry(f.a.id, { type: 'transfer', toAccountId: f.b.id, amount: '30.00' }));
  assert.equal((await f.service.history({ search: '100%_' })).length, 1);
  assert.equal((await f.service.history({ categoryId: category.id })).length, 1);
  assert.equal((await f.service.history({ accountId: f.b.id })).length, 2);
  assert.equal((await f.service.history({ type: 'transfer' })).length, 1);
  assert.equal((await f.service.history({ from: '2026-10-19', to: '2026-10-19' })).length, 1);
  assert.equal((await f.service.history({ sort: 'largest' }))[0].amount_minor, 3000);
  assert.equal((await f.service.history({ sort: 'oldest' }))[0].occurred_on, '2026-10-19');
  assert.equal((await f.service.history({ search: 'Synthetic bank' })).length, 2);
});
test('monthly reports, net flow, spending distribution, trends and currencies stay separate', async (t) => {
  const f = await fixture(t);
  await f.save(entry(f.a.id, { type: 'income', amount: '100.01', date: '2026-09-30' }));
  await f.save(entry(f.a.id, { type: 'income', amount: '200.02', date: '2026-10-01' }));
  await f.save(entry(f.a.id, { amount: '30.03', date: '2026-10-20' }));
  await f.save(entry(f.a.id, { type: 'transfer', toAccountId: f.b.id, amount: '50.00' }));
  const usd = await f.service.saveAccount(null, null, accountInput('USD', '0.00', 'USD'));
  await f.save(entry(usd.id, { amount: '10.00' }));
  const report = await f.service.report('2026-10');
  assert.equal(report.incomeMinor, 20002n);
  assert.equal(report.expenseMinor, 3003n);
  assert.equal(report.netMinor, 16999n);
  assert.equal(report.categories[0].amountMinor, 3003n);
  assert.equal(report.trends.find((r) => r.month === '2026-09').incomeMinor, 10001n);
  assert.equal(report.totals.find((r) => r.currency === 'USD').balanceMinor, -1000n);
  assert.equal((await f.service.report('2026-10', 'USD')).expenseMinor, 1000n);
});
test('large centavo amounts and aggregation beyond Number.MAX_SAFE_INTEGER remain exact', async (t) => {
  const f = await fixture(t);
  await f.save(entry(f.a.id, { type: 'income', amount: '9999999999.99' }));
  await f.save(entry(f.a.id, { amount: '0.01' }));
  assert.equal(balance(await f.service.report(), f.a.id), 100000n + BigInt(MAX_MINOR) - 1n);
  const account = { ...f.a, opening_minor: MAX_MINOR };
  const row = {
    ...(await f.service.history())[0],
    type: 'income',
    account_id: f.a.id,
    amount_minor: MAX_MINOR,
  };
  const exact = ledgerBalances(
    [account],
    Array.from({ length: 10000 }, () => row),
  )[0].balanceMinor;
  assert.equal(exact, 10001n * BigInt(MAX_MINOR));
  assert.ok(exact > BigInt(Number.MAX_SAFE_INTEGER));
  assert.equal(formatMoney(exact), 'PHP 100,009,999,999,899.99');
});
test('invalid fields, dates, amounts, IDs and filters fail with no partial records', async (t) => {
  const f = await fixture(t);
  for (const input of [
    entry(f.a.id, { amount: '' }),
    entry(f.a.id, { amount: '0' }),
    entry(f.a.id, { amount: '-1' }),
    entry(f.a.id, { date: '2026-02-30' }),
    entry(f.a.id, { date: '2026-10-21' }),
    entry(f.a.id, { accountId: 'missing' }),
    entry(f.a.id, { categoryId: 'missing' }),
    entry(f.a.id, { type: 'transfer' }),
    entry(f.a.id, { type: 'other' }),
  ])
    await assert.rejects(f.save(input));
  assert.equal((await f.service.history()).length, 0);
  await assert.rejects(f.service.saveAccount(null, null, { ...accountInput(), name: ' ' }), {
    code: 'VALIDATION',
  });
  await assert.rejects(
    f.service.saveCategory(null, null, {
      name: 'X',
      kind: 'expense',
      color: 'red',
    }),
    { code: 'VALIDATION' },
  );
  await assert.rejects(f.service.history({ sort: 'DROP TABLE' }), {
    code: 'VALIDATION',
  });
  await assert.rejects(f.service.history({ limit: 0 }), { code: 'VALIDATION' });
  await assert.rejects(f.service.history({ from: '2026-10-20', to: '2026-10-19' }), {
    code: 'VALIDATION',
  });
  await assert.rejects(f.service.report('2026-13'), { code: 'VALIDATION' });
  await assert.rejects(f.service.getTransaction("' OR 1=1"), {
    code: 'VALIDATION',
  });
});
test('database enforces integer amounts, transfer constraints, category kind and protected account history', async (t) => {
  const f = await fixture(t);
  const row = await f.save(entry(f.a.id));
  await assert.rejects(
    f.db.runAsync('UPDATE transactions SET amount_minor=? WHERE id=?', 1.2, row.id),
    /CHECK/,
  );
  await assert.rejects(
    f.db.runAsync('UPDATE transactions SET amount_minor=0 WHERE id=?', row.id),
    /CHECK/,
  );
  await assert.rejects(
    f.db.runAsync("UPDATE transactions SET occurred_on='2026-02-30' WHERE id=?", row.id),
    /CHECK/,
  );
  await assert.rejects(
    f.db.runAsync(
      "UPDATE transactions SET type='transfer',to_account_id=account_id WHERE id=?",
      row.id,
    ),
    /CHECK/,
  );
  await assert.rejects(
    f.db.runAsync('DELETE FROM financial_accounts WHERE id=?', f.a.id),
    /Archive|FOREIGN/,
  );
  await assert.rejects(
    f.db.runAsync("UPDATE financial_accounts SET currency='USD' WHERE id=?", f.a.id),
    /currency/,
  );
});
test('failed transfer edit rolls back parent fields and both calculated balances', async (t) => {
  const f = await fixture(t);
  const transfer = await f.save(entry(f.a.id, { type: 'transfer', toAccountId: f.b.id }));
  const before = await f.service.report();
  await assert.rejects(
    f.repository.saveTransaction(
      transfer.id,
      transfer.revision,
      'unused',
      {
        type: 'transfer',
        amountMinor: 0,
        accountId: f.a.id,
        toAccountId: f.b.id,
        categoryId: null,
        description: 'Must rollback',
        date: '2026-10-20',
      },
      new Date().toISOString(),
    ),
  );
  assert.equal((await f.service.getTransaction(transfer.id)).description, transfer.description);
  assert.deepEqual((await f.service.report()).totals, before.totals);
  assert.equal(balance(await f.service.report(), f.a.id), balance(before, f.a.id));
});
test('history covers more than one page without duplicated records', async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 61; i++)
    await f.save(entry(f.a.id, { description: `Sample ${i}`, amount: '0.01' }));
  const first = await f.service.history({ limit: 50 });
  const second = await f.service.history({ limit: 50, offset: 50 });
  assert.equal(first.length, 50);
  assert.equal(second.length, 11);
  assert.equal(new Set([...first, ...second].map((r) => r.id)).size, 61);
  assert.equal((await f.service.report()).expenseMinor, 61n);
});
test('migration 8 preserves previous modules, is idempotent and rolls back future failures', async (t) => {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db, migrations.slice(0, 7));
  await db.runAsync(
    "INSERT INTO notes(id,title,body,created_at,updated_at) VALUES('old-note','Keep','','a','a')",
  );
  await db.runAsync(
    "INSERT INTO time_projects(id,name,color,created_at,updated_at) VALUES('old-project','Keep','#6D42C7','a','a')",
  );
  await initializeDatabase(db);
  await initializeDatabase(db);
  assert.equal(
    (await db.getFirstAsync("SELECT name FROM time_projects WHERE id='old-project'")).name,
    'Keep',
  );
  assert.equal(
    (await db.getFirstAsync("SELECT title FROM notes WHERE id='old-note'")).title,
    'Keep',
  );
  const repo = createFinanceRepository(db, randomUUID);
  const service = createFinanceService(repo, () => new Date('2026-10-20T08:00:00Z'));
  const account = await service.saveAccount(null, null, accountInput());
  const transaction = await service.saveTransaction(null, null, randomUUID(), entry(account.id));
  await assert.rejects(
    applyMigrations(db, [
      ...migrations,
      {
        version: migrations.length + 1,
        name: 'deliberate-finance-failure',
        sql: "UPDATE transactions SET description='Must rollback';CREATE TABLE finance_rollback(id);INSERT INTO absent_table VALUES(1);",
      },
    ]),
    { code: 'MIGRATION' },
  );
  assert.equal((await service.getTransaction(transaction.id)).description, 'Fictional fixture');
  assert.equal(
    await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name='finance_rollback'"),
    null,
  );
  assert.equal((await db.getAllAsync('SELECT * FROM schema_migrations')).length, migrations.length);
});
test('finance records persist and reconcile across a separate process without networking', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'maivelle-finance-test-'));
  const filename = join(directory, 'persist.db');
  let db;
  try {
    db = openTestDatabase(filename);
    await initializeDatabase(db);
    const service = createFinanceService(
      createFinanceRepository(db, randomUUID),
      () => new Date('2026-10-20T08:00:00Z'),
    );
    const account = await service.saveAccount(null, null, accountInput());
    await service.saveTransaction(null, null, randomUUID(), entry(account.id, { amount: '0.01' }));
    await db.closeAsync();
    db = null;
    const script = `const {openTestDatabase}=require('./tests/database/sqliteAdapter.cts');const {createFinanceRepository}=require('./src/database/repositories/financeRepository.ts');const {createFinanceService}=require('./src/features/finance/services/financeService.ts');const {randomUUID}=require('node:crypto');const db=openTestDatabase(process.argv[1]);const s=createFinanceService(createFinanceRepository(db,randomUUID));s.report('2026-10').then(r=>{process.stdout.write(r.accounts[0].balanceMinor.toString());return db.closeAsync();});`;
    const child = spawnSync(process.execPath, ['-e', script, filename], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, '99999');
  } finally {
    if (db) await db.closeAsync();
    assert.equal(resolve(dirname(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('maivelle-finance-test-'));
    rmSync(directory, { recursive: true });
  }
});
