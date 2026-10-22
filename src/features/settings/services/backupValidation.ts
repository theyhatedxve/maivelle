import { initializeDatabase } from '../../../database/initialize.ts';
import { migrations } from '../../../database/migrations/index.ts';
import { createVaultRepository } from '../../../database/repositories/vaultRepository.ts';
import { createVaultService } from '../../vault/services/vaultService.ts';

export async function integrity(db: import('../../../database/types.ts').Database) {
  const rows = await db.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check');
  if (
    rows.length !== 1 ||
    Object.values(rows[0])[0] !== 'ok' ||
    (await db.getAllAsync('PRAGMA foreign_key_check')).length
  )
    throw new Error('Restored database failed integrity validation.');
}
/** Compare every application table/index/trigger/view with a fresh known schema, including trigger SQL. */
export async function validateSchema(
  db: import('../../../database/types.ts').Database,
  reference: import('../../../database/types.ts').Database,
) {
  const query =
    "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name";
  if (
    JSON.stringify(await db.getAllAsync(query)) !==
    JSON.stringify(await reference.getAllAsync(query))
  )
    throw new Error(
      'Backup schema differs from the supported Maivelle schema. No live records were changed.',
    );
}

export async function validateVault(
  db: import('expo-sqlite').SQLiteDatabase,
  master: string,
  crypto: import('../../vault/services/types.ts').VaultCrypto,
) {
  const repo = createVaultRepository(db);
  if (!(await repo.metadata())) return false;
  const service = createVaultService(repo, crypto);
  try {
    await service.refresh();
    await service.unlock(master);
    await service.list();
    return true;
  } finally {
    service.lock();
  }
}
/** Restore reviewed schema 10 or 11 into staging, then apply pending migrations. */
export async function migrateRestored(db: import('../../../database/types.ts').Database) {
  const ledger = await db.getAllAsync<import('../../../database/rows.ts').MigrationLedgerRow>(
    'SELECT version,name,sql FROM schema_migrations ORDER BY version',
  );
  if (
    ![10, 11].includes(ledger.length) ||
    ledger.some(
      (row, i) =>
        row.version !== migrations[i]?.version ||
        row.name !== migrations[i]?.name ||
        row.sql !== migrations[i]?.sql,
    )
  )
    throw new Error('Unsupported backup migration history.');
  await initializeDatabase(db);
  await integrity(db);
}
