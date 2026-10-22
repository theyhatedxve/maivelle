import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import { requireNativeModule } from 'expo';
import { createProductionStorage } from '../../database/storage/productionStorage.native.ts';
import { createProductionRecovery } from '../../database/backup/productionRecovery.ts';
import { vaultCrypto } from '../../services/security/vaultCrypto.native.ts';
import { toHex } from '../../features/vault/services/vaultFormat.ts';
import { databaseFile } from '../../features/settings/services/backupFiles.native.ts';
// Nonsensitive test control only. Never contains a database key or app records.
const control = () => new File(Paths.cache, 'maivelle-production-interruption.json');
const stages = ['first', 'replace', 'published'];
function check(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}
async function scope() {
  return `probe-${toHex(await vaultCrypto.random(16))}`;
}
async function seed(db: SQLite.SQLiteDatabase, title: string) {
  await db.runAsync(
    'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
    'public-interruption-note',
    title,
    'Fictional interruption fixture',
    'a',
    'a',
  );
}
/** Explicitly pauses a disposable owner until the host kills the background app
process. No expensive JS work, timeout, startup effect or live owner access. */
export async function prepareProductionInterruption(
  stage: string,
  progress: (text: string) => void,
) {
  check(__DEV__ && stages.includes(stage), 'Development interruption stage required.');
  check(!control().exists, 'An interruption fixture already needs verification.');
  const selected = await scope();
  const owner = createProductionStorage(selected);
  const marker = { version: 1, scope: selected, stage, ready: false };
  control().write(JSON.stringify(marker));
  const pause = async () => {
    control().write(JSON.stringify({ ...marker, ready: true }));
    progress(`READY FOR PROCESS DEATH: ${stage}. Disposable owner only.`);
    await new Promise(() => {});
  };
  if (stage === 'first') {
    await owner.provision(async (db) => {
      await seed(db, 'Unpublished');
      await pause();
    });
  } else {
    await owner.provision((db) => seed(db, 'Original'));
    await owner.replace(
      async (db) => {
        await seed(db, 'Replacement');
        if (stage === 'replace') await pause();
      },
      async () => {},
    );
    await pause();
  }
}
/** Cleanup is limited to exactly the journal-owned random probe generations.
Kept separate from failed verification so evidence is retained on failure. */
async function cleanup(selected: string, owner: ReturnType<typeof createProductionStorage>) {
  const journal = await owner.inspect();
  await owner.close();
  for (const name of [journal?.active, journal?.previous, journal?.pending]) {
    if (!name) continue;
    check(/^maivelle-encrypted-[0-9a-f]{32}\.db$/.test(name), 'Unsafe fixture cleanup refused.');
    if (databaseFile(SQLite.defaultDatabaseDirectory, name).exists)
      await SQLite.deleteDatabaseAsync(name);
    await SecureStore.deleteItemAsync(name, {
      keychainService: `maivelle.database.${selected}.v1`,
      requireAuthentication: false,
    });
  }
  const native = requireNativeModule('MaivelleStorage');
  const token = await native.acquire(selected);
  try {
    await native.removeProbeJournal(selected, token);
  } finally {
    await native.release(selected, token);
  }
}
/** Invoke ONLY after a real process restart. The host records old/new PID. */
export async function verifyProductionInterruption(): Promise<string> {
  check(__DEV__ && control().exists, 'No disposable interruption checkpoint exists.');
  const marker = JSON.parse(await control().text());
  check(
    marker.version === 1 &&
      /^probe-[0-9a-f]{32}$/.test(marker.scope) &&
      stages.includes(marker.stage) &&
      marker.ready === true,
    'Invalid interruption checkpoint; retained.',
  );
  const owner = createProductionStorage(marker.scope);
  try {
    const journal = await owner.inspect();
    check(journal, 'Durable journal was lost.');
    if (marker.stage === 'first') {
      check(
        !journal?.active && journal?.pending,
        'Unpublished first generation was incorrectly selected.',
      );
      let refused = false;
      try {
        await owner.open();
      } catch {
        refused = true;
      }
      check(refused, 'Interrupted first provisioning must require explicit recovery.');
    } else {
      check(
        journal?.active && (marker.stage === 'replace' ? journal.pending : journal.previous),
        'Cutover journal was not preserved.',
      );
      const db = await owner.open();
      const note = await db.getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
        'SELECT title FROM notes WHERE id=?',
        'public-interruption-note',
      );
      check(
        note?.title === (marker.stage === 'replace' ? 'Original' : 'Replacement'),
        'Wrong generation selected after process death.',
      );
      if (marker.stage === 'replace') {
        let refused = false;
        try {
          await owner.replace(
            async () => {},
            async () => {},
          );
        } catch {
          refused = true;
        }
        check(refused, 'Pending candidate must not be overwritten automatically.');
      }
    }
    for (const name of [journal?.active, journal?.previous, journal?.pending]) {
      if (!name) continue;
      check(databaseFile(SQLite.defaultDatabaseDirectory, name).exists, 'Owned database was lost.');
      check(
        await SecureStore.getItemAsync(name, {
          keychainService: `maivelle.database.${marker.scope}.v1`,
          requireAuthentication: false,
        }),
        'Owned protected key was lost.',
      );
    }
    await cleanup(marker.scope, owner);
    control().delete();
    return `PASS: actual process death ${marker.stage}; durable selection, key/file retention, native lease reacquisition and probe cleanup`;
  } catch (error) {
    await owner.close();
    throw error;
  }
}
/** Explicit portable recovery after a device-bound key is deleted. Test keys only. */
export async function runProductionKeyLossCheck() {
  check(__DEV__, 'Development-only key-loss check.');
  const selected = await scope();
  const owner = createProductionStorage(selected);
  let oldName;
  try {
    await owner.provision((db) => seed(db, 'Portable recovery'));
    oldName = (await owner.inspect())?.active;
    check(oldName, 'Fixture generation missing.');
    const recovery = createProductionRecovery(owner, vaultCrypto);
    const lines = [] as string[];
    await recovery.export(async (line) => {
      lines.push(line);
    }, 'Public recovery fixture passphrase 2026');
    await owner.close();
    await SecureStore.deleteItemAsync(oldName as string, {
      keychainService: `maivelle.database.${selected}.v1`,
      requireAuthentication: false,
    });
    let refused = false;
    try {
      await owner.open();
    } catch {
      refused = true;
    }
    check(refused, 'Key loss must refuse ordinary open.');
    let index = 0;
    await recovery.restore(
      async () => lines[index++] ?? null,
      'Public recovery fixture passphrase 2026',
      '',
    );
    const db = await owner.open();
    check(
      (
        await db.getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
          'SELECT title FROM notes WHERE id=?',
          'public-interruption-note',
        )
      )?.title === 'Portable recovery',
      'Portable recovery lost fixture data.',
    );
    check(
      (await owner.inspect())?.previous === oldName &&
        databaseFile(SQLite.defaultDatabaseDirectory, oldName as string).exists,
      'Unavailable old generation must be retained.',
    );
    return 'PASS: lost device key refuses open; explicit passphrase archive recovery creates a new keyed generation without resetting the retained source';
  } finally {
    await cleanup(selected, owner);
  }
}
