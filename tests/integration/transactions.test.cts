const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { openTestDatabase } = require('../database/sqliteAdapter.cts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { configuredTransaction } = require('../../src/database/transactions.ts');
test('fresh writer connections enable FK before BEGIN; cascade, SET NULL and rollback work', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'maivelle-phase13-transactions-'));
  const filename = join(dir, 'fixture.db');
  const db = openTestDatabase(filename);
  t.after(async () => {
    await db.closeAsync();
    rmSync(dir, { recursive: true, force: true });
  });
  await initializeDatabase(db);
  await db.runAsync(
    'INSERT INTO task_categories(id,name,created_at,updated_at) VALUES(?,?,?,?)',
    'cat',
    'Public',
    'a',
    'a',
  );
  await db.runAsync(
    'INSERT INTO tasks(id,title,category_id,created_at,updated_at) VALUES(?,?,?,?,?)',
    'parent',
    'Public',
    'cat',
    'a',
    'a',
  );
  await db.runAsync(
    'INSERT INTO subtasks(id,task_id,title,created_at,updated_at) VALUES(?,?,?,?,?)',
    'child',
    'parent',
    'Public',
    'a',
    'a',
  );
  // Reproduce the installed Expo fresh-connection premise independently.
  const fresh = openTestDatabase(filename);
  // Node enables FK by default; explicitly model Expo's observed new-handle policy.
  await fresh.execAsync('PRAGMA foreign_keys=OFF');
  assert.equal((await fresh.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 0);
  await fresh.closeAsync();
  const open = async () => {
    const connection = openTestDatabase(filename);
    await connection.execAsync('PRAGMA foreign_keys=OFF');
    return connection;
  };
  await assert.rejects(
    configuredTransaction(open, async (tx) => {
      await tx.runAsync('UPDATE tasks SET title=? WHERE id=?', 'Should roll back', 'parent');
      await tx.runAsync('UPDATE tasks SET category_id=? WHERE id=?', 'missing', 'parent');
    }),
    /FOREIGN KEY/,
  );
  assert.equal(
    (await db.getFirstAsync('SELECT title FROM tasks WHERE id=?', 'parent')).title,
    'Public',
  );
  await configuredTransaction(open, async (tx) => {
    await tx.runAsync('DELETE FROM task_categories WHERE id=?', 'cat');
  });
  assert.equal(
    (await db.getFirstAsync('SELECT category_id FROM tasks WHERE id=?', 'parent')).category_id,
    null,
  );
  await configuredTransaction(open, async (tx) => {
    await tx.runAsync('DELETE FROM tasks WHERE id=?', 'parent');
  });
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM subtasks')).n, 0);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
});
