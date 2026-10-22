import { File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { createProductionRecovery } from '../../../database/backup/productionRecovery.ts';
import { portableFileReader } from '../../../database/backup/productionArchiveFiles.native.ts';
import { vaultCrypto } from '../../../services/security/vaultCrypto.native.ts';
import { masterPassword, toHex } from '../../vault/services/vaultFormat.ts';
import {
  archiveDirectory,
  ensureArchiveDirectory,
  fileWriter,
  exportArchive,
  chooseBackup,
  databaseFile,
  cacheInformation,
  cleanBackupCache,
} from './backupFiles.native.ts';
/** Same Settings form contract as the legacy format-1 service. Only ciphertext
archive files are written; no unkeyed snapshot or staging database is opened. */
export function createEncryptedBackupService(
  owner: ReturnType<
    typeof import('../../../database/storage/productionOwner.ts').createProductionOwner
  >,
  files: {
    pick?: typeof chooseBackup;
    export?: typeof exportArchive;
  } = {},
) {
  const recovery = createProductionRecovery(owner, vaultCrypto);
  let state = {
    busy: false,
    message: '',
    selected: '',
    prepared: '',
    preview: null as Record<string, number> | null,
  };
  const listeners: Set<() => void> = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  const message = (value: string) => {
    state = { ...state, message: value };
    emit();
  };
  async function exclusive(action: () => Promise<void>) {
    if (state.busy) throw new Error('A backup operation is already running.');
    state = { ...state, busy: true };
    emit();
    try {
      await action();
    } catch (error) {
      // Native errors can contain SQL. Do not publish them into UI/logs.
      message(
        'Encrypted backup operation failed. Existing records and protected keys were retained. Check passphrases, format and available storage.',
      );
      throw new Error(state.message, { cause: error });
    } finally {
      state = { ...state, busy: false };
      emit();
    }
  }
  async function authenticate(file: File, password: string) {
    const reader = portableFileReader(file);
    try {
      await recovery.authenticate(reader.nextLine, password);
    } finally {
      reader.close();
    }
  }
  const service = {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getState: () => state,
    async pick() {
      return exclusive(async () => {
        const uri = await (files.pick ?? chooseBackup)();
        if (!uri) return;
        await service.discard();
        state = { ...state, selected: uri };
        emit();
        message(
          'Portable encrypted file selected. Enter its backup passphrase and original Vault master password.',
        );
      });
    },
    async create(password: string) {
      return exclusive(async () => {
        masterPassword(password).fill(0);
        if (Paths.availableDiskSpace < 8 * 1024 * 1024)
          throw new Error('Insufficient working storage.');
        ensureArchiveDirectory();
        const file = new File(
          archiveDirectory,
          `backup-${toHex(await vaultCrypto.random(16))}.json`,
        );
        const output = fileWriter(file);
        try {
          message('Exporting a consistent encrypted portable record stream…');
          await recovery.export(output.line, password);
        } catch (error) {
          output.close();
          if (file.exists) file.delete();
          throw error;
        }
        output.close();
        await authenticate(file, password);
        await (files.export ?? exportArchive)(file, (destination) =>
          authenticate(destination, password),
        );
        message(
          'Encrypted backup saved and read-back authentication passed. Keep both passwords separately.',
        );
      });
    },
    async prepare(password: string, vaultMaster: string) {
      return exclusive(async () => {
        if (!state.selected) throw new Error('Choose a backup first.');
        await service.discard();
        // Authenticate the complete input before publishing a candidate intent.
        const file = new File(state.selected);
        await authenticate(file, password);
        if (Paths.availableDiskSpace < Math.max(8 * 1024 * 1024, file.size * 3))
          throw new Error('Insufficient staging and rollback storage.');
        const before = await owner.inspect();
        if (before?.pending) throw new Error('An earlier candidate requires explicit recovery.');
        const reader = portableFileReader(file);
        try {
          const prepared = await recovery.prepare(reader.nextLine, password, vaultMaster);
          state = { ...state, prepared: prepared.name, preview: prepared.preview };
          emit();
          message(
            'Encrypted staging verified. Confirm replacement to continue. Current records have not changed.',
          );
        } catch (error) {
          // Abandon only this operation's failed candidate. Preserve its file and key.
          await owner.discardPending();
          throw error;
        } finally {
          reader.close();
        }
      });
    },
    async discard() {
      if (state.prepared) await owner.discardPending();
      state = { ...state, prepared: '', preview: null };
      emit();
    },
    takePrepared() {
      if (state.busy || !state.prepared) throw new Error('Verify a backup first.');
      const name = state.prepared;
      state = { ...state, prepared: '', preview: null };
      emit();
      return name;
    },
    async storage() {
      const j = await owner.inspect();
      const db = j?.active ? databaseFile(SQLite.defaultDatabaseDirectory, j.active) : null;
      const previous = j?.previous
        ? databaseFile(SQLite.defaultDatabaseDirectory, j.previous)
        : null;
      return {
        databaseBytes: db?.size ?? 0,
        walBytes: db ? databaseFile(db.uri + '-wal').size || 0 : 0,
        freeBytes: Paths.availableDiskSpace,
        cache: cacheInformation(),
        recoveryBytes: previous?.exists ? previous.size : 0,
      };
    },
    async cleanup() {
      return exclusive(async () => {
        cleanBackupCache();
        message(
          'Only encrypted backup cache was cleared. Database generations, protected keys and selected documents were preserved.',
        );
      });
    },
  };
  return service;
}
