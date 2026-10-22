export const ORIGINAL_DATABASE = 'maivelle-phase3-synthetic.db';

export function databaseName(name: unknown) {
  if (
    name !== ORIGINAL_DATABASE &&
    (typeof name !== 'string' || !/^maivelle-restored-[0-9a-f]{32}\.db$/.test(name))
  )
    throw new Error('Invalid storage generation.');
  return name as string;
}
/** Tiny separate, nonsensitive transactional pointer journal. Never exported. */
export function createStorageControl(db: import('../types.ts').Database) {
  return {
    async initialize() {
      await db.execAsync(`PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS storage_control(slot INTEGER PRIMARY KEY CHECK(slot=1),active TEXT NOT NULL,previous TEXT,pending INTEGER NOT NULL CHECK(pending IN (0,1)));`);
      await db.runAsync(
        'INSERT OR IGNORE INTO storage_control VALUES(1,?,NULL,0)',
        ORIGINAL_DATABASE,
      );
      const row = await this.read();
      // A process died before post-open verification/finalize: choose the untouched prior generation.
      if (row.pending) {
        if (!row.previous)
          throw new Error(
            'Interrupted restore journal has no recovery generation. No data was deleted.',
          );
        await this.select(row.previous, row.active, false);
      }
      return this.read();
    },
    async read() {
      const row = await db.getFirstAsync<{
        active: string;
        previous: string | null;
        pending: number;
      }>('SELECT active,previous,pending FROM storage_control WHERE slot=1');
      if (!row || ![0, 1].includes(row.pending))
        throw new Error('Storage journal is invalid. No data was reset.');
      return {
        active: databaseName(row.active),
        previous: row.previous === null ? null : databaseName(row.previous),
        pending: !!row.pending,
      };
    },

    async select(active: string, previous: string | null, pending: boolean) {
      databaseName(active);
      if (previous) databaseName(previous);
      await db.runAsync(
        'UPDATE storage_control SET active=?,previous=?,pending=? WHERE slot=1',
        active,
        previous,
        Number(pending),
      );
    },
  };
}
