import { DatabaseError } from './errors.js';
import { applyMigrations } from './migrations/migrate.js';
import { migrations } from './migrations/index.js';

/** @param {import('./types.js').Database} db @param {import('./types.js').Migration[]} [plan] */
export async function initializeDatabase(db, plan = migrations) {
  try {
    await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    /** @type {{foreign_keys: number} | null} */
    const foreignKeys = await db.getFirstAsync('PRAGMA foreign_keys');
    if (foreignKeys?.foreign_keys !== 1) throw new DatabaseError('FOREIGN_KEYS', 'Foreign-key enforcement could not be enabled.');
    /** @type {{journal_mode: string} | null} */
    const journal = await db.getFirstAsync('PRAGMA journal_mode = WAL');
    // In-memory databases use MEMORY; a disk database must support WAL here.
    const journalMode = journal?.journal_mode.toLowerCase();
    if (journalMode !== 'wal' && journalMode !== 'memory') {
      throw new DatabaseError('JOURNAL_MODE', 'The database could not enable a supported journal mode.');
    }
    const version = await applyMigrations(db, plan);
    return { version, journalMode, foreignKeys: true };
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('INITIALIZATION', 'Local storage could not initialize. Existing data was not reset.', error);
  }
}
