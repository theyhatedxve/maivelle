import { envelope, header, validId, MAX_ITEMS } from '../../features/vault/services/vaultFormat.ts';
export type Metadata = import('../../features/vault/services/types.ts').Metadata;
export type ItemRow = import('../../features/vault/services/types.ts').ItemRow;

export function createVaultRepository(db: import('expo-sqlite').SQLiteDatabase) {
  // Shared queue per repository; every multi-row write is atomic on an exclusive handle.
  let queue = Promise.resolve();

  function transaction<T>(action: (tx: import('expo-sqlite').SQLiteDatabase) => Promise<T>) {
    const run = queue.then(async () => {
      const result: T[] = [];
      await db.withExclusiveTransactionAsync(async (tx) => {
        result.push(await action(tx));
        if ((await tx.getAllAsync('PRAGMA foreign_key_check')).length)
          throw new Error('Vault references failed validation.');
      });
      return result[0];
    });
    queue = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  async function assertCurrent(tx: import('expo-sqlite').SQLiteDatabase, meta: Metadata) {
    const row = await tx.getFirstAsync<
      Pick<import('../rows.ts').VaultMetadataRow, 'id' | 'revision'>
    >('SELECT id,revision FROM vault_metadata WHERE slot=1');
    if (!row || row.id !== meta.id || row.revision !== meta.revision)
      throw new Error('Vault changed. Lock and unlock it again.');
  }
  return {
    /** Aggregate only: no credential payload or key is read for the dashboard. */
    async countItems() {
      const row = await db.getFirstAsync<{ total: number }>(
        'SELECT COUNT(*) AS total FROM vault_items',
      );
      if (!row || !Number.isSafeInteger(row.total))
        throw new Error('Vault item count is unavailable.');
      return row.total;
    },
    async metadata(): Promise<Metadata | null> {
      const row = await db.getFirstAsync<import('../rows.ts').VaultMetadataRow>(
        'SELECT * FROM vault_metadata WHERE slot=1',
      );
      if (!row) return null;
      const h = header(JSON.parse(row.header));
      if (
        row.id !== h.id ||
        row.revision !== h.revision ||
        row.created_at !== h.createdAt ||
        row.updated_at !== h.updatedAt
      )
        throw new Error('Vault metadata is damaged. No data was reset.');
      return {
        id: h.id,
        revision: h.revision,
        header: h,
        wrapped: envelope(JSON.parse(row.wrapped_key)),
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      };
    },

    async setup(meta: Metadata, items: ItemRow[] = []) {
      return transaction(async (tx) => {
        if (
          await tx.getFirstAsync<Pick<import('../rows.ts').VaultMetadataRow, 'slot'>>(
            'SELECT slot FROM vault_metadata',
          )
        )
          throw new Error('A Vault already exists. Unlock it instead.');
        header(meta.header);
        envelope(meta.wrapped);
        await tx.runAsync(
          'INSERT INTO vault_metadata VALUES (1,?,?,?,?,?,?)',
          meta.id,
          meta.revision,
          JSON.stringify(meta.header),
          JSON.stringify(meta.wrapped),
          meta.createdAt,
          meta.updatedAt,
        );
        await tx.runAsync('INSERT INTO vault_settings (vault_id) VALUES (?)', meta.id);
        for (const item of items) await insert(tx, item);
      });
    },

    async rewrap(previous: Metadata, next: Metadata) {
      await transaction(async (tx) => {
        await assertCurrent(tx, previous);
        header(next.header);
        envelope(next.wrapped);
        if (
          next.id !== previous.id ||
          next.createdAt !== previous.createdAt ||
          next.revision !== previous.revision + 1
        )
          throw new Error('Invalid Vault key revision.');
        await tx.runAsync(
          'UPDATE vault_metadata SET revision=?,header=?,wrapped_key=?,updated_at=? WHERE slot=1',
          next.revision,
          JSON.stringify(next.header),
          JSON.stringify(next.wrapped),
          next.updatedAt,
        );
      });
    },

    async items(meta: Metadata): Promise<ItemRow[]> {
      const rows = await db.getAllAsync<import('../rows.ts').VaultItemsRow>(
        'SELECT * FROM vault_items WHERE vault_id=? ORDER BY id LIMIT ?',
        meta.id,
        MAX_ITEMS + 1,
      );
      if (rows.length > MAX_ITEMS) throw new Error('Vault item limit exceeded.');
      return rows.map((row) => ({
        id: validId(row.id),
        vaultId: validId(row.vault_id),
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        envelope: envelope(JSON.parse(row.envelope)),
      }));
    },

    async save(meta: Metadata, row: ItemRow, previousRevision: number | null) {
      await transaction(async (tx) => {
        await assertCurrent(tx, meta);
        if (row.vaultId !== meta.id) throw new Error('Invalid Vault item owner.');
        if (previousRevision === null) {
          const count = (await tx.getFirstAsync<{ total: number }>(
            'SELECT count(*) AS total FROM vault_items WHERE vault_id=?',
            meta.id,
          ))!;
          if (count.total >= MAX_ITEMS) throw new Error('Vault supports up to 500 credentials.');
          await insert(tx, row);
        } else {
          const result = await tx.runAsync(
            'UPDATE vault_items SET revision=?,nonce=?,envelope=?,updated_at=? WHERE id=? AND vault_id=? AND revision=? AND created_at=?',
            row.revision,
            row.envelope.nonce,
            JSON.stringify(row.envelope),
            row.updatedAt,
            row.id,
            meta.id,
            previousRevision,
            row.createdAt,
          );
          if (result.changes !== 1)
            throw new Error('Credential changed or was removed. Reload before editing.');
        }
      });
    },

    async remove(meta: Metadata, id: string, revision: number) {
      validId(id);
      await transaction(async (tx) => {
        await assertCurrent(tx, meta);
        const result = await tx.runAsync(
          'DELETE FROM vault_items WHERE vault_id=? AND id=? AND revision=?',
          meta.id,
          id,
          revision,
        );
        if (result.changes !== 1) throw new Error('Credential changed or was removed.');
      });
    },

    async timeout(id: string) {
      const row = await db.getFirstAsync<{ seconds: number }>(
        'SELECT inactivity_seconds AS seconds FROM vault_settings WHERE vault_id=?',
        id,
      );
      return row?.seconds === 300 ? 300 : 60;
    },

    async setTimeout(id: string, seconds: number) {
      if (![60, 300].includes(seconds)) throw new Error('Unsupported inactivity timeout.');
      await db.runAsync(
        'UPDATE vault_settings SET inactivity_seconds=? WHERE vault_id=?',
        seconds,
        validId(id),
      );
    },
  };
}

async function insert(tx: import('expo-sqlite').SQLiteDatabase, row: ItemRow) {
  validId(row.id);
  validId(row.vaultId);
  envelope(row.envelope);
  await tx.runAsync(
    'INSERT INTO vault_items VALUES (?,?,?,?,?,?,?)',
    row.id,
    row.vaultId,
    row.revision,
    row.envelope.nonce,
    JSON.stringify(row.envelope),
    row.createdAt,
    row.updatedAt,
  );
}
