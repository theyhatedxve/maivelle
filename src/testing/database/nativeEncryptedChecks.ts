import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { FileMode } from 'expo-file-system';
import { vaultCrypto } from '../../services/security/vaultCrypto.native.ts';
import { toHex } from '../../features/vault/services/vaultFormat.ts';
import { databaseFile } from '../../features/settings/services/backupFiles.native.ts';
import { createEncryptedDatabaseFactory } from '../../database/storage/encryptedConnection.ts';
import { initializeDatabase } from '../../database/initialize.ts';
import { migrations } from '../../database/migrations/index.ts';
/** Disposable device-bound key records only; never application/Vault key namespaces. */
export async function runNativeEncryptedChecks() {
  if (!__DEV__) throw new Error('Development-only encryption probe');
  const name = `maivelle-phase13-encrypted-${toHex(await vaultCrypto.random(16))}.db`;
  const options = {
    keychainService: 'maivelle.phase13.encrypted-probe.v1',
    requireAuthentication: false,
  };
  const results: string[] = [];
  let db: import('expo-sqlite').SQLiteDatabase | undefined;
  const exists = () => databaseFile(SQLite.defaultDatabaseDirectory, name).exists;
  const backend = {
    readRecord: async (id: string) => SecureStore.getItemAsync(id, options),
    writeRecord: async (id: string, record: string) =>
      SecureStore.setItemAsync(id, record, options),
    random: () => vaultCrypto.random(32),
    fileExists: exists,
    openDatabase: (id: string) => SQLite.openDatabaseAsync(id, { useNewConnection: true }),
    keyDatabase: async (handle: SQLite.SQLiteDatabase, key: Uint8Array) => {
      // SQLCipher has no bound PRAGMA parameter. Only 32 native random bytes are hex-encoded;
      // never interpolate a password, log this statement, or propagate its raw native error.
      await handle.execAsync(`PRAGMA key = "x'${toHex(key)}'"`);
    },
  };
  const ensure = (condition: unknown, label: string) => {
    if (!condition) throw new Error('Encrypted probe failed: ' + label);
    results.push('PASS: ' + label);
  };
  try {
    const initial = createEncryptedDatabaseFactory({
      ...backend,
      initialize: (handle) => initializeDatabase(handle, migrations.slice(0, 1)),
    });
    db = await initial.provision(name);
    await db.runAsync(
      'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
      'public-encrypted-note',
      'Public encrypted fixture',
      'Fictional only',
      'a',
      'a',
    );
    await db.closeAsync();
    db = undefined;
    const input = databaseFile(SQLite.defaultDatabaseDirectory, name).open(FileMode.ReadOnly);
    const header = await input.readBytes(16);
    input.close();
    ensure(
      new TextDecoder().decode(header) !== 'SQLite format 3\0',
      'encrypted creation has no plaintext SQLite signature',
    );
    const owner = createEncryptedDatabaseFactory(backend);
    db = await owner.open(name);
    ensure(
      (
        await db.getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
          'SELECT title FROM notes WHERE id=?',
          'public-encrypted-note',
        )
      )?.title === 'Public encrypted fixture',
      'device-protected key reopens encrypted records and upgrades schema 1 to 10',
    );
    await initializeDatabase(db); // Idempotent migration; keyed writer policy must be retained.
    await db.withExclusiveTransactionAsync(async (tx) => {
      if (
        (await tx.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys !==
        1
      )
        throw new Error('Writer FK missing');
      await tx.runAsync(
        'UPDATE notes SET title=? WHERE id=?',
        'Public encrypted writer',
        'public-encrypted-note',
      );
    });
    ensure(
      (
        await db.getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
          'SELECT title FROM notes WHERE id=?',
          'public-encrypted-note',
        )
      )?.title === 'Public encrypted writer',
      'fresh exclusive writer is keyed before BEGIN and enforces FK',
    );
    await db.closeAsync();
    db = undefined;
    const wrong = createEncryptedDatabaseFactory({
      ...backend,
      readRecord: async () =>
        JSON.stringify({
          version: 1,
          database: name,
          key: toHex(await vaultCrypto.random(32)),
        }),
    });
    let rejected = false;
    try {
      await wrong.open(name);
    } catch {
      rejected = true;
    }
    ensure(rejected, 'wrong key rejected without recreating existing file');
    let opens = 0;
    const missing = createEncryptedDatabaseFactory({
      ...backend,
      readRecord: async () => null,
      openDatabase: async (id) => {
        opens++;
        return backend.openDatabase(id);
      },
    });
    rejected = false;
    try {
      await missing.open(name);
    } catch {
      rejected = true;
    }
    ensure(rejected && opens === 0, 'missing key fails before native database opening');
    const absent = createEncryptedDatabaseFactory({
      ...backend,
      fileExists: () => false,
      openDatabase: async (id) => {
        opens++;
        return backend.openDatabase(id);
      },
    });
    rejected = false;
    try {
      await absent.open(name);
    } catch {
      rejected = true;
    }
    ensure(rejected && opens === 0, 'missing file is not silently initialized by open');
    db = await owner.open(name);
    ensure(
      (
        await db.getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
          'SELECT title FROM notes WHERE id=?',
          'public-encrypted-note',
        )
      )?.title === 'Public encrypted writer' &&
        (await db.getAllAsync('PRAGMA foreign_key_check')).length === 0,
      'correct key still opens preserved records after rejected attempts',
    );
    await db.closeAsync();
    db = undefined;
    // Only this owned fixture is replaced with an empty file to simulate truncation.
    await SQLite.deleteDatabaseAsync(name);
    databaseFile(SQLite.defaultDatabaseDirectory, name).create();
    rejected = false;
    try {
      await owner.open(name);
    } catch (error) {
      rejected =
        error instanceof Error && 'code' in error && error.code === 'DATABASE_SCHEMA_MISSING';
    }
    ensure(rejected, 'empty existing file is rejected before migration initialization');
    return results;
  } finally {
    if (db) await db.closeAsync();
    if (exists()) await SQLite.deleteDatabaseAsync(name);
    // Key retirement occurs only after dependent disposable database removal succeeds.
    await SecureStore.deleteItemAsync(name, options);
  }
}
