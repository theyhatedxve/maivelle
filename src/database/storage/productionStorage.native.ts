import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { Directory } from 'expo-file-system';
import { requireNativeModule } from 'expo';
import { vaultCrypto } from '../../services/security/vaultCrypto.native.ts';
import { toHex } from '../../features/vault/services/vaultFormat.ts';
import { databaseFile } from '../../features/settings/services/backupFiles.native.ts';
import { integrity } from '../../features/settings/services/backupValidation.ts';
import { createEncryptedDatabaseFactory } from './encryptedConnection.ts';
import { createProductionOwner, CIPHER_POLICY, encryptedGeneration } from './productionOwner.ts';
/** Selected encrypted runtime. Native
lease covers the whole runtime, not just provisioning. No automatic key creation. */
export function createProductionStorage(scope: 'production' | string = 'production') {
  if (scope !== 'production' && (!__DEV__ || !/^probe-[0-9a-f]{32}$/.test(scope)))
    throw new Error('Invalid encrypted storage owner.');
  const native = requireNativeModule('MaivelleStorage') as {
    acquire: (scope: string) => Promise<string>;
    release: (scope: string, token: string) => Promise<void>;
    readJournal: (scope: string, token: string) => Promise<string | null>;
    writeJournal: (scope: string, token: string, value: string) => Promise<void>;
  };
  const options = {
    keychainService: `maivelle.database.${scope}.v1`,
    requireAuthentication: false,
  };
  let token = '';
  const requireLease = () => {
    if (!token) throw new Error('Encrypted storage lease is not held.');
  };
  const factory = createEncryptedDatabaseFactory({
    readRecord: async (name) => {
      requireLease();
      encryptedGeneration(name);
      try {
        const raw = await SecureStore.getItemAsync(name, options);
        if (raw === null) return null;
        const value = JSON.parse(raw);
        if (
          value.version !== 1 ||
          value.policy !== CIPHER_POLICY ||
          value.database !== name ||
          Object.keys(value).sort().join(',') !== 'database,policy,record,version' ||
          typeof value.record !== 'string'
        )
          throw new Error();
        return value.record;
      } catch {
        throw new Error(
          'Protected database key is unavailable or invalid. Files and keys were retained.',
        );
      }
    },
    writeRecord: async (name, record) => {
      requireLease();
      encryptedGeneration(name);
      if ((await SecureStore.getItemAsync(name, options)) !== null)
        throw new Error('Protected key already exists.');
      const raw = JSON.stringify({
        version: 1,
        policy: CIPHER_POLICY,
        database: name,
        record,
      });
      try {
        await SecureStore.setItemAsync(name, raw, options);
        if ((await SecureStore.getItemAsync(name, options)) !== raw) throw new Error();
      } catch {
        throw new Error('Protected key publication failed. Recovery artifacts were retained.');
      }
    },
    random: () => vaultCrypto.random(32),
    fileExists: (name) => {
      requireLease();
      return databaseFile(SQLite.defaultDatabaseDirectory, encryptedGeneration(name)).exists;
    },
    openDatabase: (name) => {
      requireLease();
      return SQLite.openDatabaseAsync(encryptedGeneration(name), {
        useNewConnection: true,
      });
    },
    keyDatabase: async (db, key) => {
      requireLease();
      if (key.length !== 32) throw new Error('Invalid database key size.');
      // SQLCipher PRAGMA cannot bind: only verified 32-byte hex is interpolated.
      await db.execAsync(`PRAGMA key = "x'${toHex(key)}'"`);
      await db.execAsync('PRAGMA cipher_compatibility=4;');
      const version = await db.getFirstAsync('PRAGMA cipher_version');
      if (!version || !String(Object.values(version)[0]).startsWith('4.'))
        throw new Error('Required SQLCipher policy is unavailable.');
      await db.execAsync('PRAGMA cipher_memory_security=ON; PRAGMA synchronous=FULL;');
    },
  });
  const owner = createProductionOwner({
    acquire: async () => {
      token = await native.acquire(scope);
    },
    release: async () => {
      await native.release(scope, token);
      token = '';
    },
    read: async () => {
      requireLease();
      return native.readJournal(scope, token);
    },
    write: async (value) => {
      requireLease();
      await native.writeJournal(scope, token, value);
    },
    freshName: async () => `maivelle-encrypted-${toHex(await vaultCrypto.random(16))}.db`,
    factory,
    verify: async (db) => {
      const status = await db.getFirstAsync('PRAGMA cipher_status');
      const errors = await db.getAllAsync('PRAGMA cipher_integrity_check');
      // Installed SQLCipher 4.17 reports this scalar as TEXT; some drivers use INTEGER.
      const keyed = status && [1, '1'].includes(Object.values(status)[0]);
      if (!keyed || errors.length)
        throw new Error('Encrypted page authentication failed. Files and keys retained.');
      await integrity(db);
    },
    async assertNewInstallation() {
      // Explicit NEW INSTALL only. Never mistake an absent production journal for
      // permission to abandon a legacy database or recovery generation.
      if (scope === 'production') {
        const directory = new Directory(databaseFile(SQLite.defaultDatabaseDirectory).uri);
        if (
          directory.exists &&
          directory.list().some((file) => /^maivelle-.*\.db(?:-wal|-shm)?$/.test(file.name))
        )
          throw new Error(
            'Existing Maivelle storage requires an explicitly approved migration. New-install provisioning refused.',
          );
      }
    },
  });
  return owner;
}
