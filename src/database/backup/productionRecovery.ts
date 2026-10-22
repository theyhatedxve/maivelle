import { exportRecords, importRecords } from './portableRecords.ts';
import { encryptPortable, decryptPortable } from './portableArchive.ts';
import { validateVault } from '../../features/settings/services/backupValidation.ts';
import { createSettingsRepository } from '../repositories/settingsRepository.ts';
/** Portable recovery for the selected encrypted owner. File callbacks must be bounded private/SAF streams.
Callers must pause/drain consumers and obtain replacement confirmation first. */
export function createProductionRecovery(
  owner: ReturnType<typeof import('../storage/productionOwner.ts').createProductionOwner>,
  crypto: import('../../features/vault/services/types.ts').VaultCrypto,
) {
  return {
    /** Stage/verify before the Settings form can offer explicit replacement.
Device keys are generated for the destination, never read from the archive. */
    async prepare(next: () => Promise<string | null>, password: string, vaultMaster: string) {
      const preview = {} as Record<string, number>;
      const name = await owner.stage(
        async (db) => {
          await importRecords(db, decryptPortable(next, password, crypto));
          await createSettingsRepository(db).write('appLock', false);
        },
        async (db) => {
          preview.vaultVerified = Number(await validateVault(db, vaultMaster, crypto));
          for (const table of [
            'notes',
            'tasks',
            'calendar_events',
            'medicines',
            'time_sessions',
            'financial_accounts',
            'transactions',
            'budgets',
            'vault_items',
          ])
            preview[table] = (await db.getFirstAsync<{ count: number }>(
              `SELECT COUNT(*) AS count FROM ${table}`,
            ))!.count;
        },
      );
      return { name, preview };
    },

    async export(write: (line: string) => Promise<void>, password: string) {
      return owner.snapshot((db) => encryptPortable(exportRecords(db), write, password, crypto));
    },
    /** Read-back verification consumes ALL authenticated frames, including footer. */
    async authenticate(next: () => Promise<string | null>, password: string) {
      for await (const record of decryptPortable(next, password, crypto)) {
        // Only existence is observed. No plaintext is retained outside this loop.
        if (!record || typeof record !== 'object') throw new Error('Invalid portable record.');
      }
    },
    /** This method changes ONLY the supplied owner. Production callers must also
verify preview/explicit confirmation and finish notification reconciliation.
A missing key in an old generation is not fixed by creating a new one here. */
    async restore(next: () => Promise<string | null>, password: string, vaultMaster: string) {
      await owner.replace(
        async (db) => {
          await importRecords(db, decryptPortable(next, password, crypto));
          // Device authentication is not transferable authorization.
          await createSettingsRepository(db).write('appLock', false);
        },
        async (db) => {
          await validateVault(db, vaultMaster, crypto);
        },
      );
    },
  };
}
