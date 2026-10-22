import * as SQLite from 'expo-sqlite';
import { File, FileMode } from 'expo-file-system';
import { uuid } from 'expo';
import {
  seedPortableModules,
  portableRecords,
  verifyRestoredReminders,
} from '../database/portableBackupFixture.ts';
import { initializeDatabase } from '../../database/initialize.ts';
import { createConnectionManager } from '../../database/connection.ts';
import { createStorageControl, ORIGINAL_DATABASE } from '../../database/storage/storageControl.ts';
import { cutoverDatabase } from '../../database/storage/cutover.ts';
import { createSettingsRepository } from '../../database/repositories/settingsRepository.ts';
import { createVaultRepository } from '../../database/repositories/vaultRepository.ts';
import { createVaultService } from '../../features/vault/services/vaultService.ts';
import { vaultCrypto } from '../../services/security/vaultCrypto.native.ts';
import { toHex } from '../../features/vault/services/vaultFormat.ts';
import { createBackupService } from '../../features/settings/services/backupService.native.ts';
import {
  databaseFile,
  lineReader,
  fileWriter,
  archiveDirectory,
} from '../../features/settings/services/backupFiles.native.ts';
import { integrity, migrateRestored } from '../../features/settings/services/backupValidation.ts';
/** Isolated fictional databases only; no production pointer or user Vault is replaced. */
export async function runNativeSettingsChecks(progress: (message: string) => void) {
  if (!__DEV__) throw new Error('Development-only diagnostics.');
  const id = toHex(await vaultCrypto.random(16));
  const name = `maivelle-phase12-fixture-${id}.db`;
  const controlName = `maivelle-phase12-control-${id}.db`;
  const cleanup: string[] = [name, controlName];
  const opened: SQLite.SQLiteDatabase[] = [];
  const results: string[] = [];
  let archive = '';
  let selected = '';
  const corruptedFiles: File[] = [];
  const password = 'PublicPhase12BackupFixture2026';
  const master = 'PublicPhase12MasterFixture2026';

  function check(value: boolean, label: string) {
    if (!value) throw new Error(`Phase 12 check failed: ${label}`);
    results.push('PASS: ' + label);
    progress(results.join('\n'));
  }

  async function rejects(action: () => Promise<unknown>, label: string) {
    let rejected = false;
    try {
      await action();
    } catch {
      rejected = true;
    }
    check(rejected, label);
  }
  let manager: ReturnType<typeof createConnectionManager> | undefined;
  try {
    let db = await SQLite.openDatabaseAsync(name, { useNewConnection: true });
    opened.push(db);
    await initializeDatabase(db);
    let prefs = createSettingsRepository(db);
    await prefs.write('appearance', 'dark');
    await prefs.write('medicineReminders', false);
    await prefs.write('appLock', true);
    await db.runAsync(
      'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
      'phase12-preserved',
      'Public phase12 original Note',
      'Fictional only',
      '2026-01-01',
      '2026-01-01',
    );
    const vault = createVaultService(createVaultRepository(db), vaultCrypto);
    await vault.refresh();
    await vault.setup(master);
    const credential = await vault.save({
      accountName: 'Public phase12 fictional account',
      username: 'synthetic',
      email: 'fixture@example.invalid',
      password: 'PublicPhase12Only294',
      website: '',
      notes: '',
      category: 'Fixture',
      favorite: false,
    });
    vault.lock();
    await seedPortableModules(db, uuid.v4);
    const originalRecords = await portableRecords(db);
    await verifyRestoredReminders(db, uuid.v4);
    await db.closeAsync();
    opened.splice(opened.indexOf(db), 1);
    db = await SQLite.openDatabaseAsync(name, { useNewConnection: true });
    opened.push(db);
    await initializeDatabase(db);
    prefs = createSettingsRepository(db);
    check(
      (await prefs.read()).appearance === 'dark' && !(await prefs.read()).medicineReminders,
      'native preference restart persistence',
    );
    const backup = createBackupService(async () => db, {
      pick: async () => selected,
      export: async (file, verify) => {
        archive = file.uri;
        selected = archive;
        await verify(file);
        return file.uri;
      },
    });
    progress('Running bounded native snapshot encryption and authenticated read-back…');
    await backup.create(password);
    const file = new File(archive);
    const reader = file.open(FileMode.ReadOnly);
    const sample = await reader.readBytes(4096);
    reader.close();
    check(
      !new TextDecoder().decode(sample).includes('PublicPhase12Only294'),
      'encrypted snapshot output contains no fictional credential plaintext',
    );
    await db.runAsync(
      'UPDATE notes SET title=? WHERE id=?',
      'Public live change after snapshot',
      'phase12-preserved',
    );
    await backup.pick();
    await rejects(
      () => backup.prepare('Wrong public backup passphrase', master),
      'wrong backup passphrase preserves live data',
    );
    for (const kind of ['tag', 'associated-header']) {
      const corrupt = new File(archiveDirectory, `corrupt-${id}-${kind}.json`);
      corruptedFiles.push(corrupt);
      const input = lineReader(new File(archive));
      const output = fileWriter(corrupt);
      try {
        let position = 0;
        for (let line = await input.nextLine(); line !== null; line = await input.nextLine()) {
          if (
            (kind === 'tag' && position === 1) ||
            (kind === 'associated-header' && position === 0)
          ) {
            const value = JSON.parse(line);
            const field = kind === 'tag' ? 'tag' : 'id';
            value[field] = (value[field][0] === '0' ? '1' : '0') + value[field].slice(1);
            line = JSON.stringify(value);
          }
          await output.line(line);
          position++;
        }
      } finally {
        input.close();
        output.close();
      }
      selected = corrupt.uri;
      await backup.pick();
      await rejects(
        () => backup.prepare(password, master),
        `native ${kind} tampering rejected before cutover`,
      );
    }
    selected = archive;
    await backup.pick();
    await rejects(
      () => backup.prepare(password, 'Wrong public master passphrase'),
      'Vault verification fails closed before cutover',
    );
    check(
      (await db.getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
        'SELECT title FROM notes WHERE id=?',
        'phase12-preserved',
      ))!.title === 'Public live change after snapshot',
      'failed staging leaves existing records unchanged',
    );
    await backup.prepare(password, master);
    const candidate = backup.takePrepared();
    cleanup.push(candidate);
    let stage = await SQLite.openDatabaseAsync(candidate, {
      useNewConnection: true,
    });
    opened.push(stage);
    await migrateRestored(stage);
    await migrateRestored(stage);
    check(
      (await stage.getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
        'SELECT title FROM notes WHERE id=?',
        'phase12-preserved',
      ))!.title === 'Public phase12 original Note',
      'authenticated staging restores snapshot records and migration idempotency',
    );
    check(
      !(await createSettingsRepository(stage).read()).appLock,
      'device app authorization is not transferred',
    );
    check(
      JSON.stringify(await portableRecords(stage)) === JSON.stringify(originalRecords),
      'all eight modules retain exact fixture records, stable IDs and timestamps',
    );
    const restored = createVaultService(createVaultRepository(stage), vaultCrypto);
    await restored.refresh();
    await restored.unlock(master);
    check(
      (await restored.get(credential))?.password === 'PublicPhase12Only294',
      'portable encrypted Vault unlock survives native restore',
    );
    restored.lock();
    check(
      (
        await stage.getAllAsync<import('../../database/rows.ts').MedicineNotificationJobsRow>(
          'SELECT * FROM medicine_notification_jobs',
        )
      ).length === 0,
      'notification identifiers excluded for fresh reconciliation',
    );
    check(
      (await verifyRestoredReminders(stage, uuid.v4)) > 0,
      'restored medicine schedules rebuild requests with recording adapter, no OS alarms',
    );
    await stage.closeAsync();
    opened.splice(opened.indexOf(stage), 1);
    const journal = await SQLite.openDatabaseAsync(controlName, {
      useNewConnection: true,
    });
    opened.push(journal);
    const control = createStorageControl(journal);
    await control.initialize();
    await db.closeAsync();
    opened.splice(opened.indexOf(db), 1);
    manager = createConnectionManager({
      development: true,
      resolveName: async () => (await control.read()).active,
      openDatabase: async (active) =>
        SQLite.openDatabaseAsync(active === ORIGINAL_DATABASE ? name : active, {
          useNewConnection: true,
        }),
    });
    await manager.getDatabase();
    const io = {
      control,
      close: manager.close,
      open: manager.getDatabase,
      verify: async () => {
        if (!manager) throw new Error('Diagnostic manager unavailable.');
        await integrity(await manager.getDatabase());
      },
    };
    await rejects(
      () =>
        cutoverDatabase(
          {
            ...io,
            verify: async () => {
              throw new Error('Public simulated verification interruption');
            },
          },
          candidate,
        ),
      'failed cutover reopens untouched previous database',
    );
    check(
      (await (
        await manager.getDatabase()
      ).getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
        'SELECT title FROM notes WHERE id=?',
        'phase12-preserved',
      ))!.title === 'Public live change after snapshot',
      'rollback preserves post-backup live records',
    );
    await manager.close();
    await control.select(candidate, ORIGINAL_DATABASE, true);
    await control.initialize();
    check(
      (await control.read()).active === ORIGINAL_DATABASE,
      'interrupted pointer journal selects prior generation on startup',
    );
    await cutoverDatabase(io, candidate);
    check(
      !(await control.read()).pending && (await control.read()).previous === ORIGINAL_DATABASE,
      'verified cutover retains recovery generation',
    );
    check(
      (await (
        await manager.getDatabase()
      ).getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
        'SELECT title FROM notes WHERE id=?',
        'phase12-preserved',
      ))!.title === 'Public phase12 original Note',
      'native connection closure and reopen select staged records',
    );
    return results;
  } finally {
    if (manager) await manager.close();
    for (const db of opened) await db.closeAsync();
    for (const owned of cleanup)
      if (databaseFile(SQLite.defaultDatabaseDirectory, owned).exists)
        await SQLite.deleteDatabaseAsync(owned);
    if (archive) {
      const file = new File(archive);
      if (file.exists) file.delete();
    }
    for (const file of corruptedFiles) if (file.exists) file.delete();
  }
}
