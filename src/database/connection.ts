import { DatabaseError } from './errors.ts';
import { initializeDatabase } from './initialize.ts';
export const DEVELOPMENT_DATABASE_NAME = 'maivelle-phase3-synthetic.db';
/** One process-owned connection, shared initialization promise, no per-screen opens.
Native imports happen only after the development security gate. */
export function createConnectionManager({
  development,
  openDatabase,
  resolveName = async () => DEVELOPMENT_DATABASE_NAME,
}: {
  development: boolean;
  openDatabase: (name: string) => Promise<import('expo-sqlite').SQLiteDatabase>;
  resolveName?: () => Promise<string>;
}) {
  let pending: Promise<import('expo-sqlite').SQLiteDatabase> | null = null;
  return {
    async getDatabase() {
      if (!development) {
        throw new DatabaseError(
          'ENCRYPTION_REQUIRED',
          'Production storage is disabled until encrypted database key provisioning, recovery, and backup policies are implemented and verified.',
        );
      }
      if (!pending) {
        pending = (async () => {
          const db = await openDatabase(await resolveName());
          try {
            await initializeDatabase(db);
            return db;
          } catch (error) {
            await db.closeAsync().catch(() => {});
            throw error;
          }
        })().catch((error) => {
          pending = null;
          if (error instanceof DatabaseError) throw error;
          throw new DatabaseError(
            'CONNECTION',
            'Local storage could not open. Verify that the development app was rebuilt with expo-sqlite. No data was reset.',
            error,
          );
        });
      }
      return pending;
    },
    async close() {
      const current = pending;
      pending = null;
      if (current) await (await current).closeAsync();
    },
  };
}
const manager = createConnectionManager({
  development: typeof __DEV__ !== 'undefined' && __DEV__,
  resolveName: async () => (await storageControl()).read().then((row) => row.active),
  openDatabase: async (name) => {
    const SQLite = await import('expo-sqlite');
    return SQLite.openDatabaseAsync(name, { useNewConnection: true });
  },
});
/** Native selection is lazy: importing this module never opens storage or creates a key. */
let selectionPromise = null as Promise<
  ReturnType<typeof import('./storage/storageSelection.ts').createStorageSelection>
> | null;
function selectedStorage() {
  return (selectionPromise ??= (async () => {
    const { createProductionStorage } = await import('./storage/productionStorage.native.ts');
    const { createStorageSelection } = await import('./storage/storageSelection.ts');
    const { Directory } = await import('expo-file-system');
    const SQLite = await import('expo-sqlite');
    const { databaseFile } = await import('../features/settings/services/backupFiles.native.ts');
    const owner = createProductionStorage();
    return createStorageSelection({
      development: typeof __DEV__ !== 'undefined' && __DEV__,
      encrypted: owner,
      legacy: manager,
      async inspect() {
        const journal = await owner.inspect();
        const directory = new Directory(databaseFile(SQLite.defaultDatabaseDirectory).uri);
        const names = directory.exists ? directory.list().map((file) => file.name) : [];
        return {
          journal,
          encryptedArtifacts: names.some((name) =>
            /^maivelle-encrypted-.*\.db(?:-wal|-shm)?$/.test(name),
          ),
          legacyArtifacts: names.some((name) => /^maivelle-.*\.db(?:-wal|-shm)?$/.test(name)),
        };
      },
    });
  })().catch((error) => {
    selectionPromise = null;
    throw error;
  }));
}
export async function getStorage() {
  return (await selectedStorage()).selection();
}
export async function getDatabase() {
  return (await selectedStorage()).getDatabase();
}
export async function closeDatabase() {
  return (await selectedStorage()).close();
}

let controlPromise: Promise<
  ReturnType<typeof import('./storage/storageControl.ts').createStorageControl>
> | null = null;
export function storageControl() {
  if (typeof __DEV__ === 'undefined' || !__DEV__)
    throw new DatabaseError('ENCRYPTION_REQUIRED', 'Production storage remains disabled.');
  return (controlPromise ??= (async () => {
    const SQLite = await import('expo-sqlite');
    const { createStorageControl } = await import('./storage/storageControl.ts');
    const db = await SQLite.openDatabaseAsync('maivelle-storage-control.db', {
      useNewConnection: true,
    });
    const control = createStorageControl(db);
    await control.initialize();
    return control;
  })().catch((error) => {
    controlPromise = null;
    throw error;
  }));
}
