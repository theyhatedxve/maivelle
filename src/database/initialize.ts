import { DatabaseError } from './errors.ts';
import { applyMigrations } from './migrations/migrate.ts';
import { migrations } from './migrations/index.ts';
import { configureNativeTransactions } from './transactions.ts';

export async function initializeDatabase(
  db: import('./types.ts').Database,
  plan: import('./types.ts').Migration[] = migrations,
) {
  try {
    await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

    const foreignKeys: {
      foreign_keys: number;
    } | null = (await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))!;
    if (foreignKeys?.foreign_keys !== 1)
      throw new DatabaseError('FOREIGN_KEYS', 'Foreign-key enforcement could not be enabled.');

    const journal: {
      journal_mode: string;
    } | null = await db.getFirstAsync('PRAGMA journal_mode = WAL');
    // In-memory databases use MEMORY; a disk database must support WAL here.
    const journalMode = journal?.journal_mode.toLowerCase();
    if (journalMode !== 'wal' && journalMode !== 'memory') {
      throw new DatabaseError(
        'JOURNAL_MODE',
        'The database could not enable a supported journal mode.',
      );
    }
    const version = await applyMigrations(db, plan);
    configureNativeTransactions(db);
    return { version, journalMode, foreignKeys: true };
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(
      'INITIALIZATION',
      'Local storage could not initialize. Existing data was not reset.',
      error,
    );
  }
}
