/** Each SQLite connection has its own FK policy. Expo SDK 58's exclusive helper
opens a fresh connection and begins before the callback, too late for PRAGMA
foreign_keys. Configure our separately owned writer BEFORE BEGIN instead. */
export async function configuredTransaction(
  open: () => Promise<import('expo-sqlite').SQLiteDatabase>,
  action: (tx: import('expo-sqlite').SQLiteDatabase) => Promise<void>,
) {
  const tx = await open();
  let began = false;
  try {
    await tx.execAsync('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    if (
      (await tx.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys !== 1
    )
      throw new Error('Transaction foreign-key enforcement could not start.');
    await tx.execAsync('BEGIN IMMEDIATE');
    began = true;
    await action(tx);
    await tx.execAsync('COMMIT');
    began = false;
  } catch (error) {
    if (began) {
      try {
        await tx.execAsync('ROLLBACK');
      } catch {
        throw new Error(
          'Transaction rollback failed. Restart Maivelle and investigate without clearing data.',
          { cause: error },
        );
      }
    }
    throw error;
  } finally {
    await tx.closeAsync();
  }
}
const installed: WeakSet<object> = new WeakSet();
/** Only native Expo handles need replacement; the real host adapter already
transacts on its configured connection. No module/native implementation is patched. */
export function configureNativeTransactions(
  candidate: import('./types.ts').Database,
  openWriter?: () => Promise<import('expo-sqlite').SQLiteDatabase>,
) {
  if (!('databasePath' in candidate) || (installed.has(candidate) && !openWriter)) return;
  const db = candidate as import('expo-sqlite').SQLiteDatabase;
  const slash = db.databasePath.lastIndexOf('/');
  if (slash < 0) throw new Error('Unsupported transaction database path.');
  if (!openWriter && /^maivelle-encrypted-/.test(db.databasePath.slice(slash + 1)))
    throw new Error('Encrypted writers require the protected-key connection factory.');
  db.withExclusiveTransactionAsync = (action) =>
    configuredTransaction(
      openWriter ??
        (async () => {
          const SQLite = await import('expo-sqlite');
          return SQLite.openDatabaseAsync(
            db.databasePath.slice(slash + 1),
            { ...db.options, useNewConnection: true },
            db.databasePath.slice(0, slash),
          );
        }),
      action,
    );
  installed.add(db);
}
