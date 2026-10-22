import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { requireNativeModule, uuid } from 'expo';
import { FileMode, File, Paths } from 'expo-file-system';
import { createProductionStorage } from '../../database/storage/productionStorage.native.ts';
import { createProductionRecovery } from '../../database/backup/productionRecovery.ts';
import { databaseFile, fileWriter } from '../../features/settings/services/backupFiles.native.ts';
import { portableFileReader } from '../../database/backup/productionArchiveFiles.native.ts';
import { exportRecords, importRecords } from '../../database/backup/portableRecords.ts';
import { initializeDatabase } from '../../database/initialize.ts';
import { migrations } from '../../database/migrations/index.ts';
import { validateVault } from '../../features/settings/services/backupValidation.ts';
import { vaultCrypto } from '../../services/security/vaultCrypto.native.ts';
import { toHex } from '../../features/vault/services/vaultFormat.ts';
import { createVaultRepository } from '../../database/repositories/vaultRepository.ts';
import { createVaultService } from '../../features/vault/services/vaultService.ts';
import {
  seedPortableModules,
  portableRecords,
  verifyRestoredReminders,
} from './portableBackupFixture.ts';
/** No global connection imports, URLs or startup execution. Own key namespace,
journal and generated files only. Public fictional fixture values only. */
export async function runNativeProductionChecks(progress: (message: string) => void) {
  if (!__DEV__) throw new Error('Development-only encrypted production candidate checks.');
  const scope = `probe-${toHex(await vaultCrypto.random(16))}`;
  const legacyName = `maivelle-production-copy-${scope.slice(6)}.db`;
  const archive = new File(Paths.cache, `maivelle-production-${scope}.json`);
  let legacy: SQLite.SQLiteDatabase | undefined;
  const keyOptions = {
    keychainService: `maivelle.database.${scope}.v1`,
    requireAuthentication: false,
  };
  const native = requireNativeModule('MaivelleStorage') as {
    acquire: (scope: string) => Promise<string>;
    release: (scope: string, token: string) => Promise<void>;
    removeProbeJournal: (scope: string, token: string) => Promise<void>;
  };
  let owner = createProductionStorage(scope);
  const owned = new Set<string>();
  const results: string[] = [];
  const ensure = (ok: unknown, label: string) => {
    if (!ok) throw new Error('Production candidate check failed: ' + label);
    results.push('PASS: ' + label);
    progress(results.join('\n'));
  };
  async function retainNames() {
    const j = await owner.inspect();
    if (j) for (const n of [j.active, j.previous, j.pending]) if (n) owned.add(n);
  }
  const password = 'Public production backup fixture 2026';
  const master = 'Public production Vault fixture 2026';
  let ticks = 0;
  const timer = setInterval(() => {
    ticks++;
  }, 16);
  try {
    const source = await SQLite.openDatabaseAsync(legacyName, {
      useNewConnection: true,
    });
    legacy = source;
    await initializeDatabase(source, migrations.slice(0, 1));
    await source.runAsync(
      'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
      'public-production-note',
      'Public encrypted production fixture',
      'Fictional only',
      'a',
      'a',
    );
    await initializeDatabase(source);
    await seedPortableModules(source, () => uuid.v4().replaceAll('-', ''));
    const vault = createVaultService(createVaultRepository(source), vaultCrypto);
    await vault.refresh();
    await vault.setup(master);
    await vault.save({
      accountName: 'Public encrypted account',
      username: 'public',
      email: 'public@example.invalid',
      password: 'Fictional password only',
      website: 'https://example.invalid',
      notes: 'Fictional',
      category: '',
      favorite: false,
    });
    vault.lock();
    const before = JSON.stringify(await portableRecords(source));
    const ledger = JSON.stringify(
      await source.getAllAsync<import('../../database/rows.ts').MigrationLedgerRow>(
        'SELECT * FROM schema_migrations ORDER BY version',
      ),
    );
    await owner.provision(
      async (keyed) => importRecords(keyed, exportRecords(source)),
      async (keyed) => {
        await validateVault(keyed, master, vaultCrypto);
      },
    );
    await retainNames();
    const j =
      (await owner.inspect()) as import('../../database/storage/productionOwner.ts').Journal;
    const name = j.active as string;
    const db = await owner.open();
    ensure(
      JSON.stringify(await portableRecords(db)) === before &&
        JSON.stringify(await portableRecords(source)) === before &&
        JSON.stringify(
          await db.getAllAsync<import('../../database/rows.ts').MigrationLedgerRow>(
            'SELECT * FROM schema_migrations ORDER BY version',
          ),
        ) === ledger,
      'disposable plaintext upgrade 1 to 10 converts into an independently keyed generation without changing source records or ledger',
    );
    await source.closeAsync();
    legacy = undefined;
    const other = createProductionStorage(scope);
    let blocked = false;
    try {
      await other.open();
    } catch {
      blocked = true;
    }
    ensure(blocked, 'native file lease rejects a competing owner');
    const recovery = createProductionRecovery(owner, vaultCrypto);
    /** Small disposable archive ONLY; production IO uses bounded line/file streams. */
    const lines: string[] = [];
    const output = fileWriter(archive);
    try {
      await recovery.export(async (line) => {
        lines.push(line);
        await output.line(line);
      }, password);
    } finally {
      output.close();
    }
    ensure(
      !lines.join('').includes('Fictional password only'),
      'portable version 2 exports authenticated ciphertext without plaintext fixture secret',
    );
    const reader = portableFileReader(archive);
    try {
      await recovery.authenticate(reader.nextLine, password);
    } finally {
      reader.close();
    }
    ensure(true, 'bounded private-file portable backup read-back authentication passes');
    let i = 0;
    blocked = false;
    try {
      await recovery.authenticate(
        async () => lines[i++] ?? null,
        'Wrong public backup passphrase 2026',
      );
    } catch {
      blocked = true;
    }
    ensure(blocked, 'incorrect portable backup passphrase is rejected');
    const corrupt = [...lines];
    const damaged = JSON.parse(corrupt[1]);
    damaged.tag = (damaged.tag[0] === '0' ? '1' : '0') + damaged.tag.slice(1);
    corrupt[1] = JSON.stringify(damaged);
    i = 0;
    blocked = false;
    try {
      await recovery.authenticate(async () => corrupt[i++] ?? null, password);
    } catch {
      blocked = true;
    }
    ensure(blocked, 'corrupted portable authentication tag is rejected before replacement');
    await owner.close();
    const input = databaseFile(SQLite.defaultDatabaseDirectory, name).open(FileMode.ReadOnly);
    const header = await input.readBytes(16);
    input.close();
    ensure(
      new TextDecoder().decode(header) !== 'SQLite format 3\0',
      'production candidate file has an encrypted SQLCipher header',
    );
    owner = createProductionStorage(scope);
    ensure(
      JSON.stringify(await portableRecords(await owner.open())) === before,
      'device-bound key reopens all eight modules and encrypted Vault rows',
    );
    await owner.close();
    const record = await SecureStore.getItemAsync(name, keyOptions);
    if (!record) throw new Error('Probe key record missing.');
    try {
      await SecureStore.deleteItemAsync(name, keyOptions);
      owner = createProductionStorage(scope);
      blocked = false;
      try {
        await owner.open();
      } catch {
        blocked = true;
      }
      ensure(blocked, 'missing protected key refuses open without creating replacement data');
      await owner.close();
      const wrong = JSON.parse(record);
      const nested = JSON.parse(wrong.record);
      nested.key = '00'.repeat(32);
      wrong.record = JSON.stringify(nested);
      await SecureStore.setItemAsync(name, JSON.stringify(wrong), keyOptions);
      owner = createProductionStorage(scope);
      blocked = false;
      try {
        await owner.open();
      } catch {
        blocked = true;
      }
      ensure(blocked, 'wrong protected key refuses decryption and preserves existing generation');
      await owner.close();
    } finally {
      await SecureStore.setItemAsync(name, record, keyOptions);
    }
    owner = createProductionStorage(scope);
    const restoredRecovery = createProductionRecovery(owner, vaultCrypto);
    i = 0;
    await restoredRecovery.restore(async () => lines[i++] ?? null, password, master);
    await retainNames();
    const restored = await owner.open();
    ensure(
      JSON.stringify(await portableRecords(restored)) === before,
      'portable recovery rekeys a new generation and preserves exact eight-module and Vault records',
    );
    const newJournal =
      (await owner.inspect()) as import('../../database/storage/productionOwner.ts').Journal;
    ensure(
      newJournal.active !== name && newJournal.previous === name,
      'verified replacement retains untouched previous encrypted generation and its key',
    );
    ensure(
      (await verifyRestoredReminders(restored, () => uuid.v4().replaceAll('-', ''))) > 0,
      'recovered notification identifiers are rebuilt with a recording adapter',
    );
    await owner.close();
    owner = createProductionStorage(scope);
    ensure(
      (await owner.open()).databasePath.endsWith(newJournal.active as string),
      'new encrypted generation reopens through durable selection journal',
    );
    ensure(ticks > 0, 'native KDF work yields to JavaScript timers during encrypted recovery');
    return results;
  } finally {
    clearInterval(timer);
    if (legacy) await legacy.closeAsync();
    await retainNames();
    await owner.close();
    for (const name of owned) {
      if (!/^maivelle-encrypted-[0-9a-f]{32}\.db$/.test(name))
        throw new Error('Unsafe probe cleanup refused.');
      if (databaseFile(SQLite.defaultDatabaseDirectory, name).exists)
        await SQLite.deleteDatabaseAsync(name);
      await SecureStore.deleteItemAsync(name, keyOptions);
    }
    if (databaseFile(SQLite.defaultDatabaseDirectory, legacyName).exists)
      await SQLite.deleteDatabaseAsync(legacyName);
    if (archive.exists) archive.delete();
    const token = await native.acquire(scope);
    try {
      await native.removeProbeJournal(scope, token);
    } finally {
      await native.release(scope, token);
    }
  }
}
