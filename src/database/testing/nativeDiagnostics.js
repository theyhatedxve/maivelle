import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { uuid } from 'expo';
import { getDatabase } from '../connection.js';
import { initializeDatabase } from '../initialize.js';
import { migrations } from '../migrations/index.js';
import { applyMigrations } from '../migrations/migrate.js';
import { createNotesRepository } from '../repositories/notesRepository.js';
import { createNoteCategoriesRepository } from '../repositories/noteCategoriesRepository.js';
import { createNotesService } from '../../features/notes/services/notesService.js';
import { DatabaseError } from '../errors.js';

function developmentOnly() {
  if (!__DEV__) throw new DatabaseError('DEVELOPMENT_ONLY', 'Synthetic database diagnostics are disabled in release builds.');
}

/** @param {unknown} condition @param {string} label */
function ensure(condition, label) {
  if (!condition) throw new DatabaseError('TEST_FAILED', label);
}

export async function runNativeDatabaseChecks() {
  developmentOnly();
  const filename = `maivelle-isolated-test-${uuid.v4()}.db`;
  const db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
  const results = [];
  let passed = false;
  try {
    const initial = await initializeDatabase(db, migrations.slice(0, 1));
    ensure(initial.foreignKeys && initial.journalMode === 'wal', 'Foreign keys and WAL');
    results.push('PASS: foreign keys and WAL');
    const cipher = await db.getFirstAsync('PRAGMA cipher_version');
    ensure(cipher && Object.values(cipher).some((value) => typeof value === 'string' && value.length), 'SQLCipher native library is missing; rebuild the app.');
    results.push('PASS: SQLCipher native support (test file is intentionally unkeyed)');
    ensure(await SecureStore.isAvailableAsync(), 'SecureStore native module unavailable');
    results.push('PASS: SecureStore API available (no key generated)');
    const notes = createNotesRepository(db, uuid.v4);
    const original = await notes.create({ title: 'Synthetic migration fixture', body: "'); DROP TABLE notes; --" });
    ensure((await notes.getById(original.id))?.body === original.body, 'Bound values round trip');
    results.push('PASS: insert/read and parameter binding');
    await initializeDatabase(db);
    await initializeDatabase(db);
    ensure((await notes.getById(original.id))?.title === original.title, 'Records survive v1 to latest migration');
    ensure((await db.getAllAsync('SELECT version FROM schema_migrations')).length === migrations.length, 'Migration idempotency');
    results.push('PASS: subsequent migration preserves records and is idempotent');
    ensure((await notes.update(original.id, { title: 'Updated synthetic fixture' }))?.body === original.body, 'Partial update');
    results.push('PASS: update');
    const service = createNotesService(notes, createNoteCategoriesRepository(db, uuid.v4));
    const category = await service.createCategory('Synthetic native category');
    const fixture = await service.save(null, { title: 'Synthetic Notes feature', body: 'Literal 100%_ search', categoryId: category.id });
    ensure((await service.list({ search: '100%_', categoryId: category.id, archived: false }))[0]?.id === fixture.id, 'Search and categories');
    ensure((await service.setFlag(fixture.id, 'pinned', true)).pinned, 'Pin');
    ensure(!(await service.setFlag(fixture.id, 'pinned', false)).pinned, 'Unpin');
    await service.setFlag(fixture.id, 'archived', true);
    ensure((await service.list({ archived: true }))[0]?.id === fixture.id && await service.countActive() === 1, 'Archive and count');
    await service.setFlag(fixture.id, 'archived', false);
    ensure(await service.countActive() === 2, 'Restore and count');
    ensure(!(await service.remove(fixture.id, false)) && await service.getById(fixture.id), 'Cancel deletion');
    ensure(await service.remove(fixture.id, true), 'Confirmed deletion');
    results.push('PASS: Notes search, categories, pin/unpin, archive/restore, counts and confirmed delete');
    let invalidRejected = false;
    try { await notes.create({ title: ' ' }); } catch (error) { invalidRejected = error instanceof DatabaseError && error.code === 'VALIDATION'; }
    ensure(invalidRejected, 'Invalid input rejected');
    let foreignKeyRejected = false;
    try { await notes.create({ title: 'Missing sample category', categoryId: uuid.v4() }); } catch (error) { foreignKeyRejected = error instanceof DatabaseError && error.code === 'REFERENCE'; }
    ensure(foreignKeyRejected, 'Invalid foreign key rejected');
    results.push('PASS: validation and foreign-key constraint errors');
    try {
      await applyMigrations(db, [...migrations, { version: migrations.length + 1, name: 'isolated-rollback-test', sql: 'CREATE TABLE rollback_fixture(id TEXT); INSERT INTO absent_fixture VALUES (1);' }]);
      throw new Error('Expected test migration failure');
    } catch (error) {
      ensure(error instanceof DatabaseError && error.code === 'MIGRATION', 'Expected migration error');
    }
    ensure(!(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name='rollback_fixture'")), 'DDL rollback');
    ensure(await notes.getById(original.id), 'Row survives migration failure');
    results.push('PASS: failed migration rolls back without resetting records');
    ensure(await notes.remove(original.id), 'Delete succeeds');
    ensure((await notes.getById(original.id)) === null && !(await notes.remove(original.id)), 'Delete and missing record semantics');
    results.push('PASS: delete and predictable missing-record results');
    passed = true;
    return results;
  } finally {
    await db.closeAsync();
    // Only this invocation's UUID-named isolated fixture is removed on success.
    // Failures are retained for diagnosis. The app database is never deleted.
    if (passed) await SQLite.deleteDatabaseAsync(filename);
  }
}

const markerKey = 'phase3.synthetic.restart-probe';

export async function seedRestartProbe() {
  developmentOnly();
  const db = await getDatabase();
  const value = uuid.v4();
  const now = new Date().toISOString();
  await db.runAsync(`INSERT INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`, markerKey, value, now, now);
  return `SAVED: ${value}`;
}

export async function readRestartProbe() {
  developmentOnly();
  const db = await getDatabase();
  /** @type {{value: string} | null} */
  const marker = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', markerKey);
  return marker ? `FOUND: ${marker.value}` : 'No restart probe saved yet.';
}
