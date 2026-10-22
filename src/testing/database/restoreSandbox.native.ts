import * as SQLite from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { File } from 'expo-file-system';
import { uuid } from 'expo';
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
  exportArchive,
  archiveDirectory,
  lineReader,
  fileWriter,
} from '../../features/settings/services/backupFiles.native.ts';
import { integrity, validateVault } from '../../features/settings/services/backupValidation.ts';
import { seedPortableModules, portableRecords } from './portableBackupFixture.ts';
import { createMedicineRepository } from '../../database/repositories/medicineRepository.ts';
import { createMedicineService } from '../../features/medicine/services/medicineService.ts';
import {
  createMedicineReconciler,
  MEDICINE_OWNER,
} from '../../services/notifications/medicineReconciler.ts';
import {
  localNotificationAdapter,
  MEDICINE_CHANNEL,
} from '../../services/notifications/localNotifications.ts';
import { localToday, addDays } from '../../features/calendar/services/calendarDates.ts';
export const PUBLIC_BACKUP_PASSWORD = 'PublicPhase13UiBackup2026';
export const PUBLIC_MASTER_PASSWORD = 'PublicPhase13UiVault2026';
/** Explicit development action. Own journal/manager only; never touches the global storage pointer. */
export async function createRestoreSandbox(progress: (message: string) => void) {
  if (!__DEV__) throw new Error('Development-only sandbox');
  const id = toHex(await vaultCrypto.random(16));
  const source = `maivelle-phase13-ui-${id}.db`;
  const journalName = `maivelle-phase13-ui-control-${id}.db`;
  const owned = new Set([source, journalName]);
  const archives = new Set<string>();
  const allowedStages = new Set<string>();
  const nativeRequests = new Set<string>();
  const owner = `maivelle-phase13-ui:${id}`;
  const journal = await SQLite.openDatabaseAsync(journalName, {
    useNewConnection: true,
  });
  const control = createStorageControl(journal);
  await control.initialize();
  const manager = createConnectionManager({
    development: true,
    resolveName: async () => {
      const current = (await control.read()).active;
      if (current === ORIGINAL_DATABASE) return source;
      if (!owned.has(current)) throw new Error('Sandbox rejected a database outside its ownership');
      return current;
    },
    openDatabase: (name) => SQLite.openDatabaseAsync(name, { useNewConnection: true }),
  });
  const listeners: Set<() => void> = new Set();
  let state = {
    generation: 0,
    message: 'Preparing fictional records',
    failNext: false,
    closed: false,
  };
  const publish = (message: string) => {
    state = { ...state, message };
    listeners.forEach((fn) => fn());
  };
  let expected;

  let preferences: Awaited<ReturnType<ReturnType<typeof createSettingsRepository>['read']>>;
  try {
    const db = await manager.getDatabase();
    await db.runAsync(
      'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
      'public-ui-note',
      'Public UI original note',
      'Fictional only',
      'a',
      'a',
    );
    await seedPortableModules(db, uuid.v4);
    const vault = createVaultService(createVaultRepository(db), vaultCrypto);
    progress('Creating isolated fictional Vault through the native background KDF');
    await vault.refresh();
    await vault.setup(PUBLIC_MASTER_PASSWORD);
    await vault.save({
      accountName: 'Public UI fictional account',
      username: 'synthetic',
      email: 'fixture@example.invalid',
      password: 'PublicUiOnly294',
      website: '',
      notes: 'Fictional only',
      category: 'Fixture',
      favorite: false,
    });
    vault.lock();
    expected = JSON.stringify(await portableRecords(db));
    preferences = await createSettingsRepository(db).read();
  } catch (error) {
    await manager.close();
    await journal.closeAsync();
    for (const name of owned)
      if (databaseFile(SQLite.defaultDatabaseDirectory, name).exists)
        await SQLite.deleteDatabaseAsync(name);
    throw error;
  }
  const backup = createBackupService(manager.getDatabase, {
    export: async (file, verify) => {
      archives.add(file.uri);
      return exportArchive(file, verify); // Actual Android folder chooser and read-back verification.
    },
  });
  const unsubscribe = backup.subscribe(() => {
    const name = backup.getState().prepared;
    if (name) {
      allowedStages.add(name);
      owned.add(name);
    }
  });
  async function reconcileNative() {
    const current = await manager.getDatabase();
    const repo = createMedicineRepository(current, uuid.v4);
    const medicine = createMedicineService(repo);
    const today = localToday(new Date());
    const doses = await medicine.doses(today, addDays(today, 2));
    const permissions = await localNotificationAdapter.permissions();
    if (!permissions.granted)
      throw new Error(
        'Sandbox restore succeeded, but Android notification permission is unavailable',
      );
    const reconciler = createMedicineReconciler(repo, {
      permissions: async () => permissions,
      pending: async () =>
        (await Notifications.getAllScheduledNotificationsAsync())
          .filter((row) => row.content.data?.owner === owner)
          .map((row) => ({
            id: row.identifier,
            owner: MEDICINE_OWNER,
            occurrenceId: row.content.data?.occurrenceId,
            scheduledAt: row.content.data?.scheduledAt,
            delivery: row.content.data?.delivery,
          })),
      cancel: async (key) => {
        if (!nativeRequests.has(key))
          throw new Error('Sandbox refused cancellation outside its requests');
        await Notifications.cancelScheduledNotificationAsync(key);
        nativeRequests.delete(key);
      },
      schedule: async (dose, key, delivery) => {
        nativeRequests.add(key);
        return Notifications.scheduleNotificationAsync({
          identifier: key,
          content: {
            title: 'Maivelle QA fictional reminder',
            body: 'Disposable backup/restore verification only.',
            data: {
              owner,
              occurrenceId: dose.id,
              scheduledAt: dose.scheduledAt,
              delivery,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(dose.scheduledAt),
            channelId: MEDICINE_CHANNEL,
            delivery,
          },
        });
      },
    });
    await reconciler.reconcile(doses, new Date());
    const count = (await Notifications.getAllScheduledNotificationsAsync()).filter(
      (row) => row.content.data?.owner === owner,
    ).length;
    if (!count || (await repo.jobs()).length !== count)
      throw new Error('Sandbox native notification reconciliation did not match its ledger');
    return count;
  }
  publish('Sandbox ready. Live application records and keys are outside this owner.');
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getState: () => state,
    settings: () => ({
      backup,
      preferences,
      save: async (key: string, value: unknown) => {
        await createSettingsRepository(await manager.getDatabase()).write(key, value);
        preferences = await createSettingsRepository(await manager.getDatabase()).read();
        publish('Sandbox preference saved');
      },
    }),
    async changeMarker() {
      await (
        await manager.getDatabase()
      ).runAsync('UPDATE notes SET title=? WHERE id=?', 'Public UI later edit', 'public-ui-note');
      publish('Disposable marker changed after backup');
    },
    async exportCorruptedFixture() {
      const original = [...archives].find((uri) => new File(uri).name.startsWith('backup-'));
      if (!original) throw new Error('Create the disposable backup first');
      const damaged = new File(archiveDirectory, `corrupt-ui-${id}.json`);
      if (damaged.exists) throw new Error('Corrupted fixture already created');
      archives.add(damaged.uri);
      const input = lineReader(new File(original));
      const output = fileWriter(damaged);
      try {
        let position = 0;
        for (let line = await input.nextLine(); line !== null; line = await input.nextLine()) {
          if (position === 1) {
            const value = JSON.parse(line);
            value.tag = (value.tag[0] === '0' ? '1' : '0') + value.tag.slice(1);
            line = JSON.stringify(value);
          }
          await output.line(line);
          position++;
        }
      } finally {
        input.close();
        output.close();
      }
      // Intentionally invalid diagnostic artifact. Never substitute this no-op verifier in production exports.
      await exportArchive(damaged, async () => {});
      publish(
        'Deliberately corrupted fixture exported; select the newest file to verify rejection',
      );
    },
    failNext() {
      state = { ...state, failNext: true };
      publish('Next isolated cutover will fail verification to test rollback');
    },
    async replaceDatabase(candidate: string) {
      if (!allowedStages.has(candidate) || !owned.has(candidate))
        throw new Error('Sandbox rejected unowned staging');
      allowedStages.delete(candidate);
      const before = (await (
        await manager.getDatabase()
      ).getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
        'SELECT title FROM notes WHERE id=?',
        'public-ui-note',
      ))!.title;
      const injected = state.failNext;
      state = { ...state, failNext: false };
      try {
        await cutoverDatabase(
          {
            control,
            close: manager.close,
            open: manager.getDatabase,
            verify: async () => {
              const current = await manager.getDatabase();
              await integrity(current);
              if (injected) throw new Error('Public simulated sandbox verification interruption');
              if (JSON.stringify(await portableRecords(current)) !== expected)
                throw new Error('Sandbox restored records differ');
              if (!(await validateVault(current, PUBLIC_MASTER_PASSWORD, vaultCrypto)))
                throw new Error('Sandbox Vault recovery missing');
            },
          },
          candidate,
        );
      } catch (error) {
        const after = (await (
          await manager.getDatabase()
        ).getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
          'SELECT title FROM notes WHERE id=?',
          'public-ui-note',
        ))!.title;
        if (before !== after) throw new Error('Sandbox rollback changed its previous marker');
        publish('PASS: isolated rollback retains the later marker and original generation');
        throw error;
      }
      preferences = await createSettingsRepository(await manager.getDatabase()).read();
      const notifications = await reconcileNative();
      state = { ...state, generation: state.generation + 1 };
      publish(
        `PASS: all eight modules and Vault recovered; forms remounted; ${notifications} isolated native reminder requests verified`,
      );
    },
    async verifyCurrent() {
      const current = await manager.getDatabase();
      await integrity(current);
      const note = await current.getFirstAsync<
        Pick<import('../../database/rows.ts').NotesRow, 'title'>
      >('SELECT title FROM notes WHERE id=?', 'public-ui-note');
      if (!note) throw new Error('Expected disposable Note is missing.');
      publish(
        `Sandbox marker: ${note.title === 'Public UI original note' ? 'snapshot original' : note.title === 'Public UI later edit' ? 'later edit' : 'unexpected'}; integrity passed`,
      );
    },
    async cleanup() {
      if (backup.getState().busy) throw new Error('Wait for the sandbox operation to finish');
      await backup.discard();
      unsubscribe();
      for (const request of nativeRequests)
        await Notifications.cancelScheduledNotificationAsync(request);
      nativeRequests.clear();
      await manager.close();
      await journal.closeAsync();
      for (const name of owned)
        if (databaseFile(SQLite.defaultDatabaseDirectory, name).exists)
          await SQLite.deleteDatabaseAsync(name);
      for (const uri of archives) {
        const file = new File(uri);
        if (file.exists) file.delete();
      }
      state = { ...state, closed: true };
      publish('Sandbox cleaned; application data and external exported documents retained');
    },
  };
}
