import { createVaultRepository } from '../../database/repositories/vaultRepository.ts';
import { initializeDatabase } from '../../database/initialize.ts';
import { migrations } from '../../database/migrations/index.ts';
import { vaultCrypto } from '../../services/security/vaultCrypto.native.ts';
import { createVaultService } from '../../features/vault/services/vaultService.ts';
import { toHex } from '../../features/vault/services/vaultFormat.ts';
import { databaseFile } from '../../features/settings/services/backupFiles.native.ts';
/** Development-only, isolated synthetic databases. No key or fixture values are logged. */
export async function runNativeVaultChecks(progress: (stage: string) => void) {
  if (!__DEV__) throw new Error('Development-only diagnostics.');
  const SQLite = await import('expo-sqlite');
  const suffix = toHex(await vaultCrypto.random(8));
  const names = [`maivelle-vault-fixture-${suffix}.db`, `maivelle-vault-recovery-${suffix}.db`];
  const opened: import('expo-sqlite').SQLiteDatabase[] = [];
  const results: string[] = [];

  function check(value: boolean, label: string) {
    if (!value) throw new Error(`Native Vault check failed: ${label}`);
    results.push(`PASS: ${label}`);
    progress(results.join('\n'));
  }

  async function rejects(action: () => Promise<unknown>, label: string) {
    let failed = false;
    try {
      await action();
    } catch {
      failed = true;
    }
    check(failed, label);
  }
  const password = 'Public fictional master alpha';
  const next = 'Public fictional master beta';
  const backupPassword = 'Public fictional backup gamma';
  const sample = {
    accountName: 'Native fictional account sentinel',
    username: 'native-synthetic-user',
    email: 'native@example.invalid',
    password: 'PublicFixtureOnly!294',
    website: 'https://example.invalid',
    notes: 'Native fictional note sentinel',
    category: 'Fixture',
    favorite: true,
  };
  try {
    let db = await SQLite.openDatabaseAsync(names[0], {
      useNewConnection: true,
    });
    opened.push(db);
    await initializeDatabase(db, migrations.slice(0, 9));
    await db.runAsync(
      'INSERT INTO notes (id,title,body,created_at,updated_at) VALUES (?,?,?,?,?)',
      'vault-old-note',
      'Preserved fictional Note',
      '',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    );
    await initializeDatabase(db);
    await initializeDatabase(db);
    check(
      (
        await db.getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
          'SELECT title FROM notes WHERE id=?',
          'vault-old-note',
        )
      )?.title === 'Preserved fictional Note',
      'migration 10 preserves old Notes and is idempotent',
    );
    let repo = createVaultRepository(db);
    let service = createVaultService(repo, vaultCrypto);
    await service.refresh();
    progress('Running full-cost native setup…');
    let ticks = 0;
    const heartbeat = setInterval(() => ticks++, 10);
    try {
      const setup = service.setup(password);
      await rejects(() => service.setup(password), 'overlapping setup rejected');
      await setup;
    } finally {
      clearInterval(heartbeat);
    }
    check(ticks > 0, 'native KDF keeps JavaScript responsive');
    const id = await service.save(sample);
    const first = await service.get(id);
    check(first?.password === sample.password, 'encrypted credential create and read');
    const before = (
      await repo.items(
        (await repo.metadata()) as NonNullable<Awaited<ReturnType<typeof repo.metadata>>>,
      )
    )[0];
    const persisted =
      JSON.stringify(
        await db.getAllAsync<import('../../database/rows.ts').VaultItemsRow>(
          'SELECT * FROM vault_items',
        ),
      ) +
      JSON.stringify(
        await db.getAllAsync<import('../../database/rows.ts').VaultMetadataRow>(
          'SELECT * FROM vault_metadata',
        ),
      );
    check(
      [password, ...Object.values(sample).filter((value) => typeof value === 'string')].every(
        (value) => !persisted.includes(value as string),
      ),
      'persisted Vault rows contain no fixture plaintext',
    );
    await service.save(
      { ...sample, accountName: 'Native edited fictional account' },
      { id, revision: 1 },
    );
    const edited = await service.get(id);
    check(
      edited?.createdAt === first?.createdAt && edited?.revision === 2,
      'edit preserves creation and stable ID',
    );
    check((await service.list('EDITED', true)).length === 1, 'local search and favorites');
    const saved = (
      await repo.items(
        (await repo.metadata()) as NonNullable<Awaited<ReturnType<typeof repo.metadata>>>,
      )
    )[0];
    check(saved.envelope.nonce !== before.envelope.nonce, 'fresh nonce on edit');
    for (const field of ['data', 'tag', 'nonce'] as const) {
      const e = {
        ...saved.envelope,
        [field]: (saved.envelope[field][0] === '0' ? '1' : '0') + saved.envelope[field].slice(1),
      };
      await db.runAsync('UPDATE vault_items SET envelope=? WHERE id=?', JSON.stringify(e), id);
      await rejects(() => service.get(id), `${field} tampering rejected`);
      await db.runAsync(
        'UPDATE vault_items SET envelope=? WHERE id=?',
        JSON.stringify(saved.envelope),
        id,
      );
    }
    await db.runAsync('UPDATE vault_items SET revision=revision+1 WHERE id=?', id);
    await rejects(() => service.get(id), 'associated-data tampering rejected');
    await db.runAsync('UPDATE vault_items SET revision=? WHERE id=?', saved.revision, id);
    service.lock();
    await rejects(() => service.get(id), 'locked access rejected');
    await rejects(
      () => service.unlock('Wrong fictional master password'),
      'incorrect master password rejected',
    );
    await service.unlock(password);
    const cipherBefore = JSON.stringify(
      await repo.items(
        (await repo.metadata()) as NonNullable<Awaited<ReturnType<typeof repo.metadata>>>,
      ),
    );
    await service.changePassword(password, next);
    check(service.getState().locked, 'master change locks Vault');
    await rejects(() => service.unlock(password), 'old master password rejected after change');
    await service.unlock(next);
    check(
      JSON.stringify(
        await repo.items(
          (await repo.metadata()) as NonNullable<Awaited<ReturnType<typeof repo.metadata>>>,
        ),
      ) === cipherBefore,
      'master change preserves credential ciphertext',
    );
    const backup = await service.exportBackup(backupPassword);
    check(!backup.includes(sample.password), 'portable backup contains no fixture plaintext');
    const recoveryDb = await SQLite.openDatabaseAsync(names[1], {
      useNewConnection: true,
    });
    opened.push(recoveryDb);
    await initializeDatabase(recoveryDb);
    const recovered = createVaultService(createVaultRepository(recoveryDb), vaultCrypto);
    await recovered.refresh();
    const bad = JSON.parse(backup);
    bad.envelope.tag = '0'.repeat(32);
    await rejects(
      () => recovered.restoreBackup(JSON.stringify(bad), backupPassword, password),
      'tampered backup rejected before writes',
    );
    await recovered.restoreBackup(backup, backupPassword, password);
    await recovered.unlock(password);
    check(
      (await recovered.get(id))?.password === sample.password,
      'portable backup recovers with a new master password',
    );
    recovered.lock();
    const generated = await service.generatePassword(32, ['upper', 'lower', 'digits']);
    check(
      generated.length === 32 &&
        /[A-Z]/.test(generated) &&
        /[a-z]/.test(generated) &&
        /[0-9]/.test(generated),
      'secure password generator groups',
    );
    service.lock();
    await db.closeAsync();
    opened.splice(opened.indexOf(db), 1);
    db = await SQLite.openDatabaseAsync(names[0], { useNewConnection: true });
    opened.push(db);
    await initializeDatabase(db);
    repo = createVaultRepository(db);
    service = createVaultService(repo, vaultCrypto);
    await service.refresh();
    check(service.getState().locked, 'reconstructed session starts locked');
    await service.unlock(next);
    check(
      (await service.get(id))?.password === sample.password,
      'encrypted native connection reopen persistence',
    );
    service.lock();
    const pending = service.unlock(next);
    service.lock();
    await rejects(() => pending, 'lock invalidates late KDF completion');
    check(service.getState().locked, 'late unlock never repopulates session');
    await service.unlock(next);
    await service.remove(id, 2);
    check((await service.list()).length === 0, 'credential deletion');
    service.lock();
    check(
      (await db.getAllAsync('PRAGMA foreign_key_check')).length === 0,
      'Vault foreign-key integrity and no network calls',
    );
    return results;
  } finally {
    for (const db of opened) await db.closeAsync();
    // Exact names created above only; never the application database.
    for (const name of names) {
      // A failure before recovery creation must not hide its cause behind cleanup.
      if (databaseFile(SQLite.defaultDatabaseDirectory, name).exists) {
        await SQLite.deleteDatabaseAsync(name);
      }
    }
  }
}
