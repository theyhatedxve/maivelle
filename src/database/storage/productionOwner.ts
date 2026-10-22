export type Journal = {
  version: 1 | 2;
  policy: string;
  active: string | null;
  previous: string | null;
  pending: string | null;
  retained?: string[];
};
/** Durable selection contains no keys or user records. The native lease must be
 * held for the whole owner lifetime, including all writer/snapshot handles.
 * Selection never provisions or repairs storage as a side effect of opening it.
 */
export const CIPHER_POLICY = 'sqlcipher4-raw256-v1';

export function encryptedGeneration(value: unknown) {
  if (typeof value !== 'string' || !/^maivelle-encrypted-[0-9a-f]{32}\.db$/.test(value))
    throw new Error('Invalid encrypted storage generation.');
  return value;
}

export function productionJournal(raw: string | null): Journal | null {
  if (raw === null) return null;
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    throw new Error('Storage journal is damaged. No data was reset.');
  }
  if (
    !j ||
    ![1, 2].includes(j.version) ||
    Object.keys(j).sort().join(',') !==
      (j.version === 1
        ? 'active,pending,policy,previous,version'
        : 'active,pending,policy,previous,retained,version') ||
    j.policy !== CIPHER_POLICY
  )
    throw new Error('Unsupported storage journal. No data was reset.');
  for (const key of ['active', 'previous', 'pending'])
    if (j[key] !== null) encryptedGeneration(j[key]);
  if (j.version === 2) {
    // Stay below the native journal's 8192-byte limit; exhausting retention is
    // a maintenance/review gate, never permission to silently erase generations.
    if (!Array.isArray(j.retained) || j.retained.length > 64)
      throw new Error('Invalid retained storage history.');
    j.retained.forEach(encryptedGeneration);
    const names = [...j.retained, j.active, j.previous, j.pending].filter(Boolean);
    if (new Set(names).size !== names.length)
      throw new Error('Duplicate retained storage generation.');
  }
  if (
    (!j.active && (!j.pending || j.previous)) ||
    new Set([j.active, j.previous, j.pending].filter(Boolean)).size !==
      [j.active, j.previous, j.pending].filter(Boolean).length
  )
    throw new Error('Inconsistent storage journal. No data was reset.');
  return j;
}
/** All methods must run under one native process/file lease. No automatic first-use
provisioning and no deletion or key replacement, including on recovery failure. */
export function createProductionOwner(io: {
  acquire: () => Promise<void>;
  release: () => Promise<void>;
  read: () => Promise<string | null>;
  write: (raw: string) => Promise<void>;
  freshName: () => Promise<string>;
  factory: Pick<
    ReturnType<typeof import('./encryptedConnection.ts').createEncryptedDatabaseFactory>,
    'open' | 'provision'
  > & {
    recoverProvision?: (name: string) => Promise<import('expo-sqlite').SQLiteDatabase>;
  };
  verify: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>;
  assertNewInstallation?: () => Promise<void>;
}) {
  let leased = false;
  let busy = false;
  let current: import('expo-sqlite').SQLiteDatabase | null = null;
  let prepared = ''; // Confirmation capability is deliberately not restored after a restart.
  async function exclusive(action: () => Promise<unknown>) {
    if (busy) throw new Error('Encrypted storage operation already running.');
    busy = true;
    try {
      if (!leased) {
        await io.acquire();
        leased = true;
      }
      return await action();
    } finally {
      busy = false;
    }
  }
  async function commit(j: Journal) {
    const raw = JSON.stringify(j);
    productionJournal(raw);
    await io.write(raw);
    if ((await io.read()) !== raw)
      throw new Error('Storage journal read-back failed. Restart without clearing data.');
  }
  async function closeCurrent() {
    if (current) {
      await current.closeAsync();
      current = null;
    }
  }
  async function verifiedOpen(name: string) {
    const db = await io.factory.open(name);
    try {
      await io.verify(db);
      return db;
    } catch {
      await db.closeAsync();
      throw new Error('Encrypted generation verification failed. Files and keys retained.');
    }
  }
  return {
    /** Explicit interrupted FIRST-install recovery only. Reuses the recorded key;
the caller must verify the intended content, not merely an empty schema.
Missing/invalid keys remain fatal. Never used for active-generation repair. */
    async resumeFirst(verify: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>) {
      return exclusive(async () => {
        const j = productionJournal(await io.read());
        if (!j || j.active || !j.pending || typeof verify !== 'function')
          throw new Error('Explicit first-provisioning verification is required.');
        const db = io.factory.recoverProvision
          ? await io.factory.recoverProvision(j.pending)
          : await verifiedOpen(j.pending);
        try {
          await io.verify(db);
          await verify(db);
        } finally {
          await db.closeAsync();
        }
        const reopened = await verifiedOpen(j.pending);
        try {
          await verify(reopened);
          await commit({ ...j, active: j.pending, pending: null });
          current = reopened;
        } catch (error) {
          await reopened.closeAsync();
          throw error;
        }
      });
    },
    /** Stage authenticated records without changing the selected generation. */
    async stage(
      prepare: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>,
      verify: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>,
    ) {
      return exclusive(async () => {
        const j = productionJournal(await io.read());
        if (!j?.active || j.pending)
          throw new Error('A prior candidate needs explicit recovery before staging.');
        const candidate = encryptedGeneration(await io.freshName());
        await commit({ ...j, pending: candidate });
        const db = await io.factory.provision(candidate);
        try {
          await prepare(db);
          await io.verify(db);
          await verify(db);
        } finally {
          await db.closeAsync();
        }
        const reopened = await verifiedOpen(candidate);
        try {
          await verify(reopened);
        } finally {
          await reopened.closeAsync();
        }
        prepared = candidate;
        return candidate;
      }) as Promise<string>;
    },
    /** Caller must pause and drain all consumers before confirmed activation. */
    async activate(name: string) {
      return exclusive(async () => {
        const j = productionJournal(await io.read());
        if (!j?.active || !prepared || name !== prepared || name !== j.pending)
          throw new Error('Restore must be verified again in this session.');
        const db = await verifiedOpen(name);
        try {
          await closeCurrent();
          await commit({
            ...j,
            active: name,
            previous: j.active,
            pending: null,
            ...(j.version === 2 || j.previous
              ? {
                  version: 2,
                  retained: [...(j.retained ?? []), ...(j.previous ? [j.previous] : [])],
                }
              : {}),
          });
          current = db;
          prepared = '';
        } catch (error) {
          await db.closeAsync();
          throw error;
        }
      });
    },
    /** Explicit cancellation keeps every abandoned candidate and key for recovery.
     * It never deletes files, overwrites keys or abandons a first-install intent. */
    async discardPending() {
      return exclusive(async () => {
        const j = productionJournal(await io.read());
        if (!j?.active) throw new Error('First provisioning requires explicit recovery.');
        if (j.pending)
          await commit({
            ...j,
            version: 2,
            pending: null,
            retained: [...(j.retained ?? []), j.pending],
          });
        prepared = '';
      });
    },
    /** Return a handle only while this owner holds its lease. Callers must drain
     * consumers/writers before close/replace (same contract as DatabaseProvider). */
    async open() {
      return (await exclusive(async () => {
        if (current) return current;
        const j = productionJournal(await io.read());
        if (!j?.active)
          throw new Error(
            'Encrypted storage is not provisioned or first provisioning was interrupted. Explicit recovery is required.',
          );
        // An unfinished candidate never becomes active merely because it exists.
        current = await verifiedOpen(j.active);
        return current;
      })) as import('expo-sqlite').SQLiteDatabase;
    },
    /** Explicit new installation only. An absent journal is not proof that old
app data is absent: native adapter checks legacy DBs before this operation.
Optional preparation imports an explicitly supplied isolated recovery source
BEFORE first publication; it does not authorize bypassing the legacy guard. */
    async provision(
      prepare: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void> = async () => {},
      verify: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void> = async () => {},
    ) {
      return exclusive(async () => {
        if (current || (await io.read()) !== null)
          throw new Error('Storage already exists or needs recovery. Provisioning refused.');
        await io.assertNewInstallation?.();
        const candidate = encryptedGeneration(await io.freshName());
        const j = {
          version: 1,
          policy: CIPHER_POLICY,
          active: null,
          previous: null,
          pending: candidate,
        } as Journal;
        await commit(j); // Persist intent BEFORE publishing protected key material.
        const db = await io.factory.provision(candidate);
        try {
          await prepare(db);
          await io.verify(db);
          await verify(db);
        } finally {
          await db.closeAsync();
        }
        const reopened = await verifiedOpen(candidate);
        try {
          await verify(reopened);
          await commit({ ...j, active: candidate, pending: null });
        } catch (error) {
          await reopened.closeAsync();
          throw error;
        }
        current = reopened;
      });
    },
    /** Build an independently keyed generation; prepare/verify must NOT access or
mutate the live application owner. A failed candidate is retained in journal. */
    async replace(
      prepare: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>,
      verify: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>,
    ) {
      return exclusive(async () => {
        const j = productionJournal(await io.read());
        if (!j?.active || j.pending)
          throw new Error('Storage is unprovisioned or a prior candidate needs explicit recovery.');
        const candidate = encryptedGeneration(await io.freshName());
        await commit({ ...j, pending: candidate });
        const db = await io.factory.provision(candidate);
        try {
          await prepare(db);
          await io.verify(db);
          await verify(db);
        } finally {
          await db.closeAsync();
        }
        const reopened = await verifiedOpen(candidate);
        try {
          await verify(reopened);
          await closeCurrent();
          // Atomic selection is LAST. A crash before publication keeps old active.
          await commit({
            ...j,
            active: candidate,
            previous: j.active,
            pending: null,
            ...(j.version === 2 || j.previous
              ? {
                  version: 2,
                  retained: [...(j.retained ?? []), ...(j.previous ? [j.previous] : [])],
                }
              : {}),
          });
          current = reopened;
        } catch (error) {
          await reopened.closeAsync();
          throw error;
        }
      });
    },
    async inspect() {
      return (await exclusive(async () => productionJournal(await io.read()))) as Journal | null;
    },
    /** A dedicated read handle pins a snapshot without joining the UI connection's
writes. The owner lease prevents generation replacement until it closes. */
    async snapshot<T>(action: (db: import('expo-sqlite').SQLiteDatabase) => Promise<T>) {
      return exclusive(async () => {
        const j = productionJournal(await io.read());
        if (!j?.active) throw new Error('Encrypted storage is not provisioned.');
        const db = await verifiedOpen(j.active);
        try {
          return await action(db);
        } finally {
          await db.closeAsync();
        }
      }) as Promise<T>;
    },
    async close() {
      return exclusive(async () => {
        prepared = '';
        await closeCurrent();
        if (leased) {
          await io.release();
          leased = false;
        }
      });
    },
  };
}
