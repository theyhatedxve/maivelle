import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { requireNativeModule, uuid } from 'expo';
import { createProductionStorage } from '../../database/storage/productionStorage.native.ts';
import { createStorageSelection } from '../../database/storage/storageSelection.ts';
import { createEncryptedBackupService } from '../../features/settings/services/encryptedBackupService.native.ts';
import { vaultCrypto } from '../../services/security/vaultCrypto.native.ts';
import { toHex } from '../../features/vault/services/vaultFormat.ts';
import { createVaultRepository } from '../../database/repositories/vaultRepository.ts';
import { createVaultService } from '../../features/vault/services/vaultService.ts';
import {
  seedPortableModules,
  portableRecords,
  verifyRestoredReminders,
} from './portableBackupFixture.ts';
import { databaseFile } from '../../features/settings/services/backupFiles.native.ts';
/** Explicit disposable owner only. Does not import the live connection/provider.
File callbacks substitute private test documents for Android's human picker. */
export async function runNativeStage13AChecks(progress: (value: string) => void) {
  if (!__DEV__) throw new Error('Development checks only.');
  const scope = `probe-${toHex(await vaultCrypto.random(16))}`;
  let owner = createProductionStorage(scope);
  const names: Set<string> = new Set();
  const archive = { file: null as import('expo-file-system').File | null };
  const options = {
    keychainService: `maivelle.database.${scope}.v1`,
    requireAuthentication: false,
  };
  const rows = [] as string[];
  function ensure(ok: unknown, label: string) {
    if (!ok) throw new Error('Stage 13A check failed: ' + label);
    rows.push('PASS: ' + label);
    progress(rows.join('\n'));
  }
  async function collect() {
    const j = await owner.inspect();
    if (j)
      for (const n of [j.active, j.pending, j.previous, ...(j.retained ?? [])]) if (n) names.add(n);
  }
  const password = 'Public Stage 13A backup fixture 2026';
  const master = 'Public Stage 13A Vault fixture 2026';
  try {
    try {
      await owner.provision(async () => {
        throw new Error('controlled first initialization interruption');
      });
    } catch {
      /* Verify durable intent below, not a presumed successful provision. */
    }
    await collect();
    ensure(
      !(await owner.inspect())?.active && !!(await owner.inspect())?.pending,
      'first provisioning interruption retains intent without selecting empty storage',
    );
    await owner.close();
    owner = createProductionStorage(scope);
    await owner.resumeFirst(async (db) => {
      if (
        (await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM schema_migrations',
        ))!.count !== 10
      )
        throw new Error('Incomplete expected first-install schema.');
    });
    ensure(
      !!(await owner.inspect())?.active,
      'explicit first recovery reopens and verifies the same protected key',
    );
    const selection = createStorageSelection({
      development: false,
      encrypted: owner,
      inspect: async () => ({
        journal: await owner.inspect(),
        encryptedArtifacts: true,
        legacyArtifacts: false,
      }),
      legacy: {
        async getDatabase() {
          throw new Error('Plaintext fallback forbidden.');
        },
        async close() {},
      },
    });
    const db = await selection.getDatabase();
    ensure(
      (await selection.selection()).mode === 'encrypted',
      'application storage selector resolves the keyed owner without plaintext fallback',
    );
    await db.runAsync(
      'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
      'public-stage13a-note',
      'Public Stage 13A note',
      'Fictional only',
      'a',
      'a',
    );
    await seedPortableModules(db, uuid.v4);
    const vault = createVaultService(createVaultRepository(db), vaultCrypto);
    await vault.refresh();
    await vault.setup(master);
    await vault.save({
      accountName: 'Public Stage 13A account',
      username: 'fictional',
      email: '',
      password: 'Public fictional secret 2026',
      website: '',
      notes: '',
      category: '',
      favorite: false,
    });
    vault.lock();
    const expected = JSON.stringify(await portableRecords(db));
    const backup = createEncryptedBackupService(owner, {
      pick: async () => archive.file?.uri ?? null,
      export: async (file, verify) => {
        archive.file = file;
        await verify(file);
        return file.uri;
      },
    });
    await backup.create(password);
    ensure(
      backup.getState().message.includes('read-back authentication passed'),
      'selected encrypted backup service exports and authenticates format 2 without raw database keys',
    );
    await backup.pick();
    let rejected = false;
    try {
      await backup.prepare('Public incorrect backup password', master);
    } catch {
      rejected = true;
    }
    ensure(
      rejected && !(await owner.inspect())?.pending,
      'wrong backup passphrase is rejected before creating a staging intent',
    );
    await backup.prepare(password, master);
    ensure(
      backup.getState().preview?.vaultVerified === 1 && backup.getState().preview?.notes === 1,
      'encrypted restore preview authenticates all records and original Vault master password',
    );
    await collect();
    await backup.discard();
    ensure(
      JSON.stringify(await portableRecords(await owner.open())) === expected &&
        !!(await owner.inspect())?.retained?.length,
      'canceled encrypted restore keeps active records and retains canceled generation and key',
    );
    await backup.prepare(password, master);
    await collect();
    const candidate = backup.takePrepared();
    await owner.activate(candidate);
    ensure(
      JSON.stringify(await portableRecords(await selection.getDatabase())) === expected,
      'confirmed keyed replacement restores exact eight-module and encrypted Vault records',
    );
    ensure(
      (await verifyRestoredReminders(await owner.open(), uuid.v4)) > 0,
      'restored reminders reconcile through separately owned recording adapter',
    );
    await owner.close();
    owner = createProductionStorage(scope);
    ensure(
      (await owner.open()).databasePath.endsWith(candidate),
      'encrypted selection and recovered records survive owner restart',
    );
    await collect();
    return rows;
  } finally {
    await collect();
    await owner.close();
    for (const name of names) {
      if (databaseFile(SQLite.defaultDatabaseDirectory, name).exists)
        await SQLite.deleteDatabaseAsync(name);
      await SecureStore.deleteItemAsync(name, options);
    }
    if (archive.file?.exists) archive.file.delete();
    const native = requireNativeModule('MaivelleStorage') as {
      acquire: (scope: string) => Promise<string>;
      release: (scope: string, token: string) => Promise<void>;
      removeProbeJournal: (scope: string, token: string) => Promise<void>;
    };
    const token = await native.acquire(scope);
    try {
      await native.removeProbeJournal(scope, token);
    } finally {
      await native.release(scope, token);
    }
  }
}
