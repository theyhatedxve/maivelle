const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, dirname, resolve, basename } = require('node:path');
const { spawnSync } = require('node:child_process');
const { openTestDatabase } = require('./sqliteAdapter.cts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { applyMigrations } = require('../../src/database/migrations/migrate.ts');
const { migrations } = require('../../src/database/migrations/index.ts');
const { createNotesRepository } = require('../../src/database/repositories/notesRepository.ts');
const { createConnectionManager } = require('../../src/database/connection.ts');
async function fixture(t, plan = migrations) {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  const status = await initializeDatabase(db, plan);
  return { db, status, notes: createNotesRepository(db, randomUUID) };
}
test('creates only the approved module tables and enforces foreign keys', async (t) => {
  const { db, status } = await fixture(t);
  assert.deepEqual(status, {
    version: migrations.length,
    journalMode: 'memory',
    foreignKeys: true,
  });
  const tables = await db.getAllAsync(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );
  assert.deepEqual(
    tables.map((table) => table.name),
    [
      'app_settings',
      'budget_accounts',
      'budget_allocations',
      'budget_funding_history',
      'budget_transaction_links',
      'budgets',
      'calendar_event_categories',
      'calendar_event_exceptions',
      'calendar_events',
      'financial_accounts',
      'medicine_dose_logs',
      'medicine_notification_jobs',
      'medicine_schedules',
      'medicines',
      'note_categories',
      'notes',
      'schema_migrations',
      'subtasks',
      'task_categories',
      'tasks',
      'time_projects',
      'time_session_segments',
      'time_sessions',
      'transaction_categories',
      'transactions',
      'vault_items',
      'vault_metadata',
      'vault_settings',
    ],
  );
  assert.equal((await db.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 1);
});
test('async CRUD returns predictable values and treats SQL syntax as plain data', async (t) => {
  const { notes } = await fixture(t);
  const body = "'); DROP TABLE notes; --";
  const created = await notes.create({ title: '  Synthetic fixture  ', body });
  assert.match(created.id, /^[\da-f-]{36}$/);
  assert.equal(created.title, 'Synthetic fixture');
  assert.equal(created.createdAt, created.updatedAt);
  assert.deepEqual(await notes.getById(created.id), created);
  const updated = await notes.update(created.id, { title: 'Changed', body: 'Sample only' });
  assert.equal(updated.id, created.id);
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.body, 'Sample only');
  assert.equal((await notes.list()).length, 1);
  assert.equal(await notes.remove(created.id), true);
  assert.equal(await notes.remove(created.id), false);
  assert.equal(await notes.getById(created.id), null);
  assert.equal(await notes.update(created.id, { body: 'absent' }), null);
});
test('partial updates preserve omitted fields and category deletion sets reference to null', async (t) => {
  const { db, notes } = await fixture(t);
  const categoryId = randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO note_categories VALUES (?, ?, ?, ?)',
    categoryId,
    'Synthetic category',
    now,
    now,
  );
  const created = await notes.create({ title: 'Category sample', body: 'Keep this', categoryId });
  const updated = await notes.update(created.id, { title: 'New title' });
  assert.equal(updated.categoryId, categoryId);
  assert.equal(updated.body, 'Keep this');
  assert.equal((await notes.list({ categoryId })).length, 1);
  await db.runAsync('DELETE FROM note_categories WHERE id = ?', categoryId);
  assert.equal((await notes.getById(created.id)).categoryId, null);
});
test('rejects invalid inputs without writing and validates pagination', async (t) => {
  const { notes } = await fixture(t);
  for (const value of [
    null,
    [],
    {},
    { title: '' },
    { title: ' ' },
    { title: 'x'.repeat(241) },
    { title: 'x', body: 1 },
    { title: 'x', categoryId: undefined },
    { title: 'x', ignored: true },
  ]) {
    await assert.rejects(notes.create(value), { code: 'VALIDATION' });
  }
  await assert.rejects(notes.update(randomUUID(), {}), { code: 'VALIDATION' });
  await assert.rejects(notes.getById("' OR 1=1"), { code: 'VALIDATION' });
  await assert.rejects(notes.list({ limit: 0 }), { code: 'VALIDATION' });
  await assert.rejects(notes.list({ offset: -1 }), { code: 'VALIDATION' });
  await assert.rejects(notes.list(null), { code: 'VALIDATION' });
  await assert.rejects(notes.list({ unexpected: true }), { code: 'VALIDATION' });
  assert.deepEqual(await notes.list(), []);
});
test('foreign key, unique, NOT NULL and CHECK constraints fail predictably', async (t) => {
  const { db, notes } = await fixture(t);
  await assert.rejects(notes.create({ title: 'Invalid reference', categoryId: randomUUID() }), {
    code: 'REFERENCE',
  });
  const fixed = createNotesRepository(db, () => 'fixed-test-id');
  await fixed.create({ title: 'First' });
  await assert.rejects(fixed.create({ title: 'Duplicate' }), { code: 'CONFLICT' });
  await assert.rejects(
    db.runAsync(
      'INSERT INTO notes (id, title, body, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      'bad-null',
      null,
      '',
      null,
      '2026',
      '2026',
    ),
    /NOT NULL/,
  );
  await assert.rejects(
    db.runAsync(
      'INSERT INTO notes (id, title, body, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      'bad-check',
      ' ',
      '',
      null,
      '2026',
      '2026',
    ),
    /CHECK/,
  );
  assert.equal((await notes.list()).length, 1);
});
test('repeated initialization is idempotent and keeps migration timestamps and rows', async (t) => {
  const { db, notes } = await fixture(t);
  const note = await notes.create({ title: 'Preserved' });
  const before = await db.getAllAsync('SELECT * FROM schema_migrations ORDER BY version');
  await initializeDatabase(db);
  assert.deepEqual(
    await db.getAllAsync('SELECT * FROM schema_migrations ORDER BY version'),
    before,
  );
  assert.deepEqual(await notes.getById(note.id), note);
});
test('existing records survive the subsequent real migrations', async (t) => {
  const { db, notes } = await fixture(t, migrations.slice(0, 1));
  const note = await notes.create({ title: 'Created under version one' });
  await initializeDatabase(db);
  assert.deepEqual(await notes.getById(note.id), note);
  assert.equal((await db.getAllAsync('SELECT * FROM schema_migrations')).length, migrations.length);
  assert.ok(
    await db.getFirstAsync(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='notes_category_id_idx'",
    ),
  );
});
test('failed subsequent migration rolls back DDL, DML and ledger without deleting records', async (t) => {
  const { db, notes } = await fixture(t);
  const note = await notes.create({ title: 'Survives failure' });
  const bad = {
    version: migrations.length + 1,
    name: 'deliberately-failing-test',
    sql: "CREATE TABLE rollback_fixture(id TEXT); UPDATE notes SET title='must roll back'; INSERT INTO missing_test_table VALUES (1);",
  };
  await assert.rejects(applyMigrations(db, [...migrations, bad]), { code: 'MIGRATION' });
  assert.equal(
    await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name='rollback_fixture'"),
    null,
  );
  assert.deepEqual(await notes.getById(note.id), note);
  assert.equal((await db.getAllAsync('SELECT * FROM schema_migrations')).length, migrations.length);
});
test('rejects changed, unknown-future and discontinuous migration histories', async (t) => {
  const { db, notes } = await fixture(t);
  await notes.create({ title: 'Keep through rejected plans' });
  await assert.rejects(
    applyMigrations(db, [{ ...migrations[0], sql: 'SELECT 1;' }, migrations[1]]),
    { code: 'MIGRATION_HISTORY' },
  );
  await assert.rejects(applyMigrations(db, migrations.slice(0, 1)), { code: 'MIGRATION_HISTORY' });
  await assert.rejects(applyMigrations(db, [migrations[1]]), { code: 'MIGRATION_PLAN' });
  assert.equal((await notes.list()).length, 1);
});
test('untracked pre-existing tables cause a safe initialization failure, not a reset', async (t) => {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await db.execAsync('CREATE TABLE notes (legacy_value TEXT);');
  await db.runAsync('INSERT INTO notes VALUES (?)', 'preserve legacy record');
  await assert.rejects(initializeDatabase(db), { code: 'MIGRATION' });
  assert.equal(
    (await db.getFirstAsync('SELECT legacy_value FROM notes')).legacy_value,
    'preserve legacy record',
  );
  assert.equal(
    await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name='schema_migrations'"),
    null,
  );
});
test('file uses WAL and records persist after another process starts, without networking', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'maivelle-db-test-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.match(basename(directory), /^maivelle-db-test-/);
    rmSync(directory, { recursive: true, force: true });
  });
  const filename = join(directory, 'synthetic.db');
  const db = openTestDatabase(filename);
  const status = await initializeDatabase(db);
  assert.equal(status.journalMode, 'wal');
  const note = await createNotesRepository(db, randomUUID).create({
    title: 'Restart persistence fixture',
  });
  await db.closeAsync();
  const script =
    "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const row=db.prepare('SELECT title FROM notes WHERE id=?').get(process.argv[2]);process.stdout.write(row.title);db.close();";
  const child = spawnSync(process.execPath, ['-e', script, filename, note.id], {
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, note.title);
});
test('production gate runs before any database file is opened', async () => {
  let opens = 0;
  const manager = createConnectionManager({
    development: false,
    openDatabase: async () => {
      opens++;
      throw new Error('must not open');
    },
  });
  await assert.rejects(manager.getDatabase(), { code: 'ENCRYPTION_REQUIRED' });
  assert.equal(opens, 0);
});
test('concurrent consumers share one ready connection and failed opens may be retried', async () => {
  let opens = 0;
  const db = openTestDatabase();
  const manager = createConnectionManager({
    development: true,
    openDatabase: async () => {
      opens++;
      return db;
    },
  });
  const [first, second] = await Promise.all([manager.getDatabase(), manager.getDatabase()]);
  assert.equal(first, second);
  assert.equal(opens, 1);
  await db.closeAsync();
  let attempts = 0;
  const retryDb = openTestDatabase();
  const retry = createConnectionManager({
    development: true,
    openDatabase: async () => {
      if (++attempts === 1) throw new Error('open failed');
      return retryDb;
    },
  });
  await assert.rejects(retry.getDatabase());
  await retry.getDatabase();
  assert.equal(attempts, 2);
  await retryDb.closeAsync();
});
test('failed initialization closes its owned connection and a retry can initialize', async (t) => {
  const conflicting = openTestDatabase();
  await conflicting.execAsync('CREATE TABLE notes (legacy_value TEXT)');
  let closed = 0;
  const close = conflicting.closeAsync;
  conflicting.closeAsync = async () => {
    closed++;
    await close();
  };
  const healthy = openTestDatabase();
  t.after(() => healthy.closeAsync());
  let attempts = 0;
  const manager = createConnectionManager({
    development: true,
    openDatabase: async () => (++attempts === 1 ? conflicting : healthy),
  });
  await assert.rejects(manager.getDatabase(), { code: 'MIGRATION' });
  assert.equal(closed, 1);
  assert.equal(await manager.getDatabase(), healthy);
  assert.equal(attempts, 2);
});
