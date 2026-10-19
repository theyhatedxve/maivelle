import { DatabaseError } from './errors.js';
import { initializeDatabase } from './initialize.js';

export const DEVELOPMENT_DATABASE_NAME = 'maivelle-phase3-synthetic.db';

/**
 * One process-owned connection, shared initialization promise, no per-screen opens.
 * Native imports happen only after the development security gate.
 * @param {{development: boolean, openDatabase: (name: string) => Promise<import('expo-sqlite').SQLiteDatabase>}} options
 */
export function createConnectionManager({ development, openDatabase }) {
  /** @type {Promise<import('expo-sqlite').SQLiteDatabase> | null} */
  let pending = null;
  return {
    async getDatabase() {
      if (!development) {
        throw new DatabaseError('ENCRYPTION_REQUIRED', 'Production storage is disabled until encrypted database key provisioning, recovery, and backup policies are implemented and verified.');
      }
      if (!pending) {
        pending = (async () => {
          const db = await openDatabase(DEVELOPMENT_DATABASE_NAME);
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
          throw new DatabaseError('CONNECTION', 'Local storage could not open. Verify that the development app was rebuilt with expo-sqlite. No data was reset.', error);
        });
      }
      return pending;
    },
  };
}

const manager = createConnectionManager({
  development: typeof __DEV__ !== 'undefined' && __DEV__,
  openDatabase: async (name) => {
    const SQLite = await import('expo-sqlite');
    return SQLite.openDatabaseAsync(name, { useNewConnection: true });
  },
});

export const getDatabase = manager.getDatabase;
