import { DatabaseError } from '../errors.js';
import { migrations } from './index.js';

/** @type {WeakSet<object>} */
const running = new WeakSet();

/**
 * Run only on an owned connection before publishing it to consumers.
 * BEGIN IMMEDIATE uses this connection's foreign-key settings and reserves the writer.
 * All pending migrations and their ledger entries commit together, or all roll back.
 * @param {import('../types.js').Database} db
 * @param {import('../types.js').Migration[]} [plan]
 */
export async function applyMigrations(db, plan = migrations) {
  if (running.has(db)) throw new DatabaseError('MIGRATION_BUSY', 'Database initialization is already running.');
  if (plan.some((migration, index) => migration.version !== index + 1 || !migration.name || !migration.sql)) {
    throw new DatabaseError('MIGRATION_PLAN', 'Migration versions must be consecutive, starting at one.');
  }
  running.add(db);
  let began = false;
  try {
    await db.execAsync('BEGIN IMMEDIATE');
    began = true;
    await db.execAsync(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL CHECK(version > 0),
      name TEXT NOT NULL UNIQUE,
      sql TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`);
    /** @type {{version: number, name: string, sql: string}[]} */
    const applied = await db.getAllAsync('SELECT version, name, sql FROM schema_migrations ORDER BY version');
    for (const [index, recorded] of applied.entries()) {
      const expected = plan[index];
      if (!expected || recorded.version !== expected.version || recorded.name !== expected.name || recorded.sql !== expected.sql) {
        throw new DatabaseError('MIGRATION_HISTORY', 'Database migration history differs from this app version. Update the app or recover from a verified backup; do not reset data.');
      }
    }
    for (const migration of plan.slice(applied.length)) {
      // Only reviewed, source-controlled migration SQL is executed as a batch.
      await db.execAsync(migration.sql);
      await db.runAsync('INSERT INTO schema_migrations (version, name, sql, applied_at) VALUES (?, ?, ?, ?)', migration.version, migration.name, migration.sql, new Date().toISOString());
    }
    const violations = await db.getAllAsync('PRAGMA foreign_key_check');
    if (violations.length) throw new DatabaseError('MIGRATION_CONSTRAINT', 'Database references failed validation. No migrations were committed.');
    await db.execAsync('COMMIT');
    began = false;
    return plan.length;
  } catch (error) {
    if (began) {
      try { await db.execAsync('ROLLBACK'); } catch (rollbackError) {
        throw new DatabaseError('MIGRATION_ROLLBACK', 'Migration rollback failed. Close the connection and investigate without resetting data.', rollbackError);
      }
    }
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('MIGRATION', 'Database migration failed. Existing data was not reset.', error);
  } finally {
    running.delete(db);
  }
}
