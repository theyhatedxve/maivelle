import { DatabaseError } from '../errors.ts';
/** Select once per application lifetime. Failure is never evidence of a fresh
installation. This function has no provisioning, deletion or key-write API. */
export function createStorageSelection(options: {
  development: boolean;
  inspect: () => Promise<{
    journal: import('./productionOwner.ts').Journal | null;
    encryptedArtifacts: boolean;
    legacyArtifacts: boolean;
  }>;
  encrypted: ReturnType<typeof import('./productionOwner.ts').createProductionOwner>;
  legacy: {
    getDatabase: () => Promise<import('expo-sqlite').SQLiteDatabase>;
    close: () => Promise<void>;
  };
}) {
  let selected: Promise<{
    mode: 'encrypted' | 'legacy';
    owner: typeof options.encrypted | null;
  }> | null = null;
  function selection() {
    return (selected ??= (async () => {
      const state = await options.inspect();
      if (state.journal) {
        if (!state.journal.active)
          throw new DatabaseError(
            'PROVISIONING_INCOMPLETE',
            'Encrypted provisioning was interrupted. Explicit recovery is required; files and keys were retained.',
          );
        return { mode: 'encrypted' as const, owner: options.encrypted };
      }
      if (state.encryptedArtifacts)
        throw new DatabaseError(
          'STORAGE_SELECTION_MISSING',
          'Encrypted files exist without a usable storage journal. No database was created.',
        );
      await options.encrypted.close();
      if (!options.development)
        throw new DatabaseError(
          'ENCRYPTION_REQUIRED',
          state.legacyArtifacts
            ? 'Existing plaintext storage requires an approved migration. No conversion was performed.'
            : 'New installation requires explicit encrypted provisioning. No database or key was created.',
        );
      return { mode: 'legacy' as const, owner: null };
    })().catch((error) => {
      selected = null;
      throw error;
    }));
  }
  return {
    selection,
    async getDatabase() {
      const storage = await selection();
      return storage.owner ? storage.owner.open() : options.legacy.getDatabase();
    },
    async close() {
      const storage = await selection();
      if (storage.owner) await storage.owner.close();
      else await options.legacy.close();
    },
  };
}
