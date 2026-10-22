import { initializeDatabase } from '../initialize.ts';
import { configureNativeTransactions } from '../transactions.ts';

function fail(code: string) {
  const error = new Error(
    `${code}: encrypted storage is unavailable. Existing files and key records were retained; no replacement database was created.`,
  );
  return Object.assign(error, { code });
}
/** Keyed connection factory; opening never falls back to provisioning.
Provision is explicit, never an open-time fallback. Key records belong in device-protected storage. */
export function createEncryptedDatabaseFactory(options: {
  readRecord: (name: string) => Promise<string | null>;
  writeRecord: (name: string, value: string) => Promise<void>;
  random: () => Promise<Uint8Array>;
  fileExists: (name: string) => boolean;
  openDatabase: (name: string) => Promise<import('expo-sqlite').SQLiteDatabase>;
  keyDatabase: (db: import('expo-sqlite').SQLiteDatabase, key: Uint8Array) => Promise<void>;
  initialize?: typeof initializeDatabase;
  configureWriters?: typeof configureNativeTransactions;
}) {
  const busy = new Set();
  const initialize = options.initialize ?? initializeDatabase;
  const configure = options.configureWriters ?? configureNativeTransactions;
  function name(value: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,110}\.db$/.test(value)) throw fail('INVALID_DATABASE_NAME');
    return value;
  }
  async function key(database: string) {
    let record;
    try {
      record = JSON.parse((await options.readRecord(database)) ?? 'null');
    } catch {
      throw fail('KEY_RECORD_INVALID');
    }
    if (!record) throw fail('KEY_UNAVAILABLE');
    if (
      record.version !== 1 ||
      record.database !== database ||
      typeof record.key !== 'string' ||
      !/^[0-9a-f]{64}$/.test(record.key)
    )
      throw fail('KEY_RECORD_INVALID');
    return Uint8Array.from((record.key as string).match(/../g)!, (pair) => parseInt(pair, 16));
  }
  async function handle(database: string, create = false) {
    const bytes = await key(database); // Before open, including every exclusive writer.
    let db;
    try {
      if (!create && !options.fileExists(database)) throw fail('DATABASE_MISSING');
      db = await options.openDatabase(database);
      try {
        await options.keyDatabase(db, bytes);
        (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sqlite_master'))!;
      } catch {
        throw fail('DATABASE_DECRYPTION');
      } // Never expose secret-bearing native SQL errors.
      // A zero-byte/truncated file can appear to accept any key. Only explicit
      // provision may initialize an empty schema; existing generations must have a ledger.
      if (!create) {
        const ledger = await db.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          'schema_migrations',
        );
        if (
          !ledger ||
          !(
            await db.getFirstAsync<{ count: number }>(
              'SELECT COUNT(*) AS count FROM schema_migrations',
            )
          )?.count
        )
          throw fail('DATABASE_SCHEMA_MISSING');
      }
      return db;
    } catch (error) {
      if (db) await db.closeAsync().catch(() => {});
      throw error;
    } finally {
      bytes.fill(0);
    }
  }
  async function owned(database: string, create = false) {
    const db = await handle(database, create);
    try {
      configure(db, () => handle(database));
      await initialize(db);
      return db;
    } catch {
      await db.closeAsync().catch(() => {});
      throw fail('ENCRYPTED_INITIALIZATION');
    }
  }
  async function exclusive(
    database: string,
    action: () => Promise<import('expo-sqlite').SQLiteDatabase>,
  ) {
    name(database);
    if (busy.has(database)) throw fail('PROVISIONING_BUSY');
    busy.add(database);
    try {
      return await action();
    } finally {
      busy.delete(database);
    }
  }
  return {
    /** Only an owner with a durable, incomplete FIRST-install intent may call this.
     * Retains/reuses the existing protected key, including an interrupted key write.
     * No key is generated and active/missing databases must never use this path. */
    recoverProvision: (database: string) => exclusive(database, () => owned(database, true)),
    open: (database: string) => exclusive(database, () => owned(database)),
    provision: (database: string) =>
      exclusive(database, async () => {
        if (options.fileExists(database) || (await options.readRecord(database)) !== null)
          throw fail('ALREADY_PROVISIONED');
        const bytes = await options.random();
        try {
          if (!(bytes instanceof Uint8Array) || bytes.length !== 32)
            throw fail('RANDOM_KEY_INVALID');
          const encoded = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
          await options.writeRecord(
            database,
            JSON.stringify({ version: 1, database, key: encoded }),
          );
        } finally {
          if (bytes instanceof Uint8Array) bytes.fill(0);
        }
        // Retain key/file on failure for explicit recovery, never silently retry with a new key.
        return owned(database, true);
      }),
  };
}
