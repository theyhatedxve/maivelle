import * as SQLite from 'expo-sqlite';
import { File, Paths, FileMode } from 'expo-file-system';
import { getDatabase, storageControl, getStorage } from '../../../database/connection.ts';
import { createEncryptedBackupService } from './encryptedBackupService.native.ts';
import { initializeDatabase } from '../../../database/initialize.ts';
import { migrations } from '../../../database/migrations/index.ts';
import { createSettingsRepository } from '../../../database/repositories/settingsRepository.ts';
import { vaultCrypto } from '../../../services/security/vaultCrypto.native.ts';
import { toHex, masterPassword } from '../../vault/services/vaultFormat.ts';
import { integrity, migrateRestored, validateSchema, validateVault } from './backupValidation.ts';
import {
  encryptSnapshot,
  decryptSnapshot,
  requireSpace,
  backupHeader,
  CHUNK_BYTES,
} from './backupFormat.ts';
import {
  archiveDirectory,
  ensureArchiveDirectory,
  exportArchive,
  fileWriter,
  lineReader,
  chooseBackup,
  cacheInformation,
  cleanBackupCache,
  databaseFile,
} from './backupFiles.native.ts';
async function deleteOwnedDatabase(name: string) {
  if (!/^maivelle-(snapshot|reference|restored)-[0-9a-f]{32}\.db$/.test(name))
    throw new Error('Refusing cleanup outside owned staging files.');
  if (databaseFile(SQLite.defaultDatabaseDirectory, name).exists)
    await SQLite.deleteDatabaseAsync(name);
}
/** App-scoped coordinator; only public progress/URI survives external pickers. Never retains passphrases/keys. */
export function createLegacyBackupService(
  liveDatabase: () => Promise<SQLite.SQLiteDatabase> = getDatabase,
  files: {
    pick?: typeof chooseBackup;
    export?: typeof exportArchive;
  } = {},
) {
  let busy = false;
  let state = {
    busy: false,
    message: '',
    selected: '',
    prepared: '',
    preview: null as Record<string, number> | null,
  };
  const listeners: Set<() => void> = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  const progress = (message: string) => {
    state = { ...state, message };
    emit();
  };
  async function exclusive(action: () => Promise<void>) {
    if (busy) throw new Error('A backup operation is already running.');
    busy = true;
    state = { ...state, busy: true };
    emit();
    try {
      await action();
    } catch (error) {
      progress(
        error instanceof Error ? error.message : 'Backup operation failed. No live data was reset.',
      );
      throw error;
    } finally {
      busy = false;
      state = { ...state, busy: false };
      emit();
    }
  }

  async function verify(
    file: File,
    password: string,
    write: (bytes: Uint8Array) => Promise<void> = async () => {},
  ) {
    const reader = lineReader(file);
    try {
      return await decryptSnapshot(
        {
          nextLine: reader.nextLine,
          write,
          freeBytes: Paths.availableDiskSpace,
        },
        password,
        vaultCrypto,
        progress,
      );
    } finally {
      reader.close();
    }
  }
  const service = {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getState: () => state,
    async pick() {
      return exclusive(async () => {
        const selected = await (files.pick ?? chooseBackup)();
        if (selected) {
          await service.discard();
          state = {
            ...state,
            selected,
            message:
              'Local encrypted backup selected. Enter its passphrase and original Vault master password.',
          };
          emit();
        }
      });
    },

    async create(password: string) {
      return exclusive(async () => {
        masterPassword(password).fill(0);
        const id = toHex(await vaultCrypto.random(16));
        const name = `maivelle-snapshot-${id}.db`;
        let snapshot;
        try {
          const live = await liveDatabase();
          const pages = (await live.getFirstAsync<{ page_count: number }>('PRAGMA page_count'))!;
          const pageSize = (await live.getFirstAsync<{ page_size: number }>('PRAGMA page_size'))!;
          const estimate = pages.page_count * pageSize.page_size;
          requireSpace(
            backupHeader({
              format: 'maivelle-offline-backup',
              version: 1,
              id,
              createdAt: new Date().toISOString(),
              schema: 11,
              bytes: estimate,
              chunks: Math.ceil(estimate / CHUNK_BYTES),
              chunkBytes: CHUNK_BYTES,
              kdf: 'scrypt',
              N: 131072,
              r: 8,
              p: 1,
              dkLen: 32,
              salt: '0'.repeat(64),
            }),
            Paths.availableDiskSpace,
          );
          progress('Taking a consistent local SQLite snapshot…');
          snapshot = await SQLite.openDatabaseAsync(name, {
            useNewConnection: true,
          });
          await SQLite.backupDatabaseAsync({
            sourceDatabase: live,
            destDatabase: snapshot,
          });
          await integrity(snapshot);
          // Notification identifiers are device-derived state, never portable records.
          await snapshot.execAsync(
            'DELETE FROM medicine_notification_jobs; PRAGMA wal_checkpoint(TRUNCATE);',
          );
          const path = snapshot.databasePath;
          await snapshot.closeAsync();
          snapshot = undefined;
          const inputFile = databaseFile(path);
          const input = inputFile.open(FileMode.ReadOnly);
          ensureArchiveDirectory();
          const outputFile = new File(archiveDirectory, `backup-${id}.json`);
          const output = fileWriter(outputFile);
          try {
            await encryptSnapshot(
              {
                size: inputFile.size,
                schema: 11,
                read: (n) => input.readBytes(n),
                write: output.line,
              },
              password,
              vaultCrypto,
              progress,
            );
          } catch (error) {
            output.close();
            input.close();
            if (outputFile.exists) outputFile.delete();
            throw error;
          }
          output.close();
          input.close();
          await verify(outputFile, password);
          progress(
            'Encrypted snapshot verified. Choose a local folder. Files can later be moved manually; Maivelle never uploads them.',
          );
          await (files.export ?? exportArchive)(outputFile, (file) =>
            verify(file, password).then(() => {}),
          );
          progress(
            'Encrypted backup saved and read-back authentication passed. Keep its passphrase and original Vault master password separately.',
          );
        } finally {
          if (snapshot) await snapshot.closeAsync();
          await deleteOwnedDatabase(name);
        }
      });
    },

    async prepare(password: string, vaultMaster: string) {
      return exclusive(async () => {
        if (!state.selected) throw new Error('Choose a backup file first.');
        await service.discard();
        const id = toHex(await vaultCrypto.random(16));
        const name = `maivelle-restored-${id}.db`;
        const file = databaseFile(SQLite.defaultDatabaseDirectory, name);
        const referenceName = `maivelle-reference-${id}.db`;
        let stage;
        let reference;
        let valid = false;
        try {
          const output = fileWriter(file);
          try {
            await verify(new File(state.selected), password, output.write);
          } finally {
            output.close();
          }
          progress('Checking staged schema, records and Vault unlock capability…');
          stage = await SQLite.openDatabaseAsync(name, {
            useNewConnection: true,
          });
          reference = await SQLite.openDatabaseAsync(referenceName, {
            useNewConnection: true,
          });
          const sourceLedger = await stage.getAllAsync<{ version: number }>(
            'SELECT version FROM schema_migrations ORDER BY version',
          );
          if (![10, 11].includes(sourceLedger.length))
            throw new Error('Unsupported backup schema. Current data was not changed.');
          await initializeDatabase(reference, migrations.slice(0, sourceLedger.length));
          await validateSchema(stage, reference);
          await migrateRestored(stage);
          await initializeDatabase(reference);
          await validateSchema(stage, reference);
          const vault = await validateVault(stage, vaultMaster, vaultCrypto);
          const prefs = createSettingsRepository(stage);
          await prefs.read();
          // Device authentication/Keystore authorization never transfers with a backup.
          await prefs.write('appLock', false);
          await stage.execAsync('DELETE FROM medicine_notification_jobs;');
          const preview: Record<string, number> = {};
          const tables = [
            'notes',
            'tasks',
            'calendar_events',
            'medicines',
            'time_sessions',
            'financial_accounts',
            'transactions',
            'budgets',
            'vault_items',
          ];
          for (const table of tables)
            preview[table] = (await stage.getFirstAsync<{ count: number }>(
              `SELECT COUNT(*) AS count FROM ${table}`,
            ))!.count;
          preview.vaultVerified = Number(vault);
          await integrity(stage);
          await stage.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
          valid = true;
          state = { ...state, prepared: name, preview };
          emit();
          progress(
            'Staging verified. Confirm replacement to continue. Current records have not changed.',
          );
        } finally {
          if (stage) await stage.closeAsync();
          if (reference) await reference.closeAsync();
          await deleteOwnedDatabase(referenceName);
          if (!valid) await deleteOwnedDatabase(name);
        }
      });
    },
    async discard() {
      const prepared = state.prepared;
      state = { ...state, prepared: '', preview: null };
      emit();
      if (prepared) await deleteOwnedDatabase(prepared);
    },
    /** Call immediately before handing the already verified name to the database owner. */
    takePrepared() {
      if (busy || !state.prepared) throw new Error('Verify a backup first.');
      const name = state.prepared;
      state = { ...state, prepared: '', preview: null };
      emit();
      return name;
    },
    async storage() {
      const live = await liveDatabase();
      const control = await storageControl();
      const pointer = await control.read();
      const previous = pointer.previous
        ? databaseFile(SQLite.defaultDatabaseDirectory, pointer.previous)
        : null;
      return {
        databaseBytes: databaseFile(live.databasePath).size,
        walBytes: databaseFile(live.databasePath + '-wal').size || 0,
        freeBytes: Paths.availableDiskSpace,
        cache: cacheInformation(),
        recoveryBytes: previous?.exists ? previous.size : 0,
      };
    },
    async cleanup() {
      return exclusive(async () => {
        cleanBackupCache();
        progress(
          'Only Maivelle encrypted backup cache files were removed. User records, recovery databases, selected documents and Vault keys were preserved.',
        );
      });
    },
  };
  return service;
}
/** Lazy selected-owner facade. Explicit injected databases retain the legacy
sandbox contract; normal Settings always follows the application's selection.
Neither branch converts live storage or exports device-bound database keys. */
export function createBackupService(
  liveDatabase?: () => Promise<SQLite.SQLiteDatabase>,
  files: {
    pick?: typeof chooseBackup;
    export?: typeof exportArchive;
  } = {},
) {
  let delegate = null as ReturnType<typeof createLegacyBackupService> | null;
  let opening = null as Promise<NonNullable<typeof delegate>> | null;
  let state = {
    busy: false,
    message: '',
    selected: '',
    prepared: '',
    preview: null as Record<string, number> | null,
  };
  const listeners: Set<() => void> = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  function selected() {
    return (opening ??= (async () => {
      const storage = liveDatabase ? null : await getStorage();
      delegate = storage?.owner
        ? createEncryptedBackupService(storage.owner, files)
        : createLegacyBackupService(liveDatabase ?? getDatabase, files);
      const chosen = delegate;
      chosen.subscribe(() => {
        state = chosen.getState();
        emit();
      });
      state = delegate.getState();
      emit();
      return delegate;
    })().catch((error) => {
      opening = null;
      throw error;
    }));
  }
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getState: () => state,
    pick: async () => (await selected()).pick(),
    create: async (password: string) => (await selected()).create(password),
    prepare: async (password: string, master: string) =>
      (await selected()).prepare(password, master),
    discard: async () => (await selected()).discard(),
    takePrepared() {
      if (!delegate) throw new Error('Verify a backup first.');
      return delegate.takePrepared();
    },
    storage: async () => (await selected()).storage(),
    cleanup: async () => (await selected()).cleanup(),
  };
}
