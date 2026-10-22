const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const { randomBytes, scrypt, createCipheriv, createDecipheriv } = require('node:crypto');
const { promisify } = require('node:util');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname } = require('node:path');
const { openTestDatabase } = require('../database/sqliteAdapter.cts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { migrations } = require('../../src/database/migrations/index.ts');
const { createVaultRepository } = require('../../src/database/repositories/vaultRepository.ts');
const { createVaultService } = require('../../src/features/vault/services/vaultService.ts');
const {
  toHex,
  fromHex,
  credential,
  header,
} = require('../../src/features/vault/services/vaultFormat.ts');
// Independent OpenSSL host backend, never shipped to Android or used as a fallback.
const hostCrypto = {
  async random(n) {
    return new Uint8Array(randomBytes(n));
  },
  async derive(password, salt) {
    return new Uint8Array(
      await promisify(scrypt)(password, salt, 32, {
        N: 131072,
        r: 8,
        p: 1,
        maxmem: 160 * 1024 * 1024,
      }),
    );
  },
  async seal(key, clear, aad) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad);
    const data = Buffer.concat([cipher.update(clear), cipher.final()]);
    return {
      v: 1,
      nonce: toHex(nonce),
      tag: toHex(cipher.getAuthTag()),
      data: toHex(data),
    };
  },
  async open(key, e, aad) {
    const decipher = createDecipheriv('aes-256-gcm', key, fromHex(e.nonce));
    decipher.setAAD(aad);
    decipher.setAuthTag(fromHex(e.tag));
    return new Uint8Array(Buffer.concat([decipher.update(fromHex(e.data)), decipher.final()]));
  },
};
const pass = 'Fictional master password A';
const next = 'Fictional master password B';
const backupPass = 'Fictional export password C';
const sample = {
  accountName: 'Fictional account only',
  username: 'synthetic-user',
  email: 'fixture@example.invalid',
  password: 'NotARealSecret!9274',
  website: 'https://example.invalid',
  notes: 'Fictional vault note sentinel',
  category: 'Test category',
  favorite: true,
};
test('locking during setup clears owned temporary keys and never commits a late Vault', async (t) => {
  const { db, repo } = await fixture(t);
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  let firstKey;
  const crypto = {
    ...hostCrypto,
    async random(n) {
      const value = await hostCrypto.random(n);
      if (n === 32 && !firstKey) firstKey = value;
      return value;
    },
    async derive(p, s) {
      await barrier;
      return hostCrypto.derive(p, s);
    },
  };
  const service = createVaultService(createVaultRepository(db), crypto);
  await service.refresh();
  const pending = service.setup(pass);
  await new Promise((resolve) => setImmediate(resolve));
  service.lock();
  assert.ok(firstKey.every((byte) => byte === 0));
  release();
  await assert.rejects(pending, /locked/);
  assert.equal(await repo.metadata(), null);
  assert.equal(service.getState().locked, true);
});
async function fixture(t, options = {}) {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db);
  const repo = createVaultRepository(db);
  const service = createVaultService(repo, hostCrypto, options);
  await service.refresh();
  return { db, repo, service };
}
test('migration 10 preserves old records, is idempotent and only adds encrypted Vault tables', async (t) => {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db, migrations.slice(0, 9));
  await db.runAsync(
    'INSERT INTO notes (id,title,body,created_at,updated_at) VALUES (?,?,?,?,?)',
    'old-record',
    'Keep previous Notes',
    'Synthetic only',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z',
  );
  await initializeDatabase(db);
  await initializeDatabase(db);
  assert.equal(
    (await db.getFirstAsync('SELECT title FROM notes WHERE id=?', 'old-record')).title,
    'Keep previous Notes',
  );
  assert.equal((await db.getFirstAsync('SELECT count(*) AS n FROM schema_migrations')).n, 10);
  assert.equal((await db.getFirstAsync('SELECT count(*) AS n FROM vault_metadata')).n, 0);
});
test('setup is exclusive; CRUD encrypts every sensitive field, binds metadata, preserves creation and detects stale edits', async (t) => {
  const { db, repo, service } = await fixture(t);
  const settingUp = service.setup(pass);
  await assert.rejects(service.setup(pass), /already running/);
  await settingUp;
  await assert.rejects(service.setup(pass), /already exists/);
  const id = await service.save(sample);
  const first = await service.get(id);
  const raw = JSON.stringify(await db.getAllAsync('SELECT * FROM vault_items'));
  for (const value of Object.values(sample).filter((v) => typeof v === 'string'))
    assert.equal(raw.includes(value), false);
  assert.equal(JSON.stringify(await repo.metadata()).includes(pass), false);
  assert.equal((await service.list('SYNTHETIC'))[0].id, id);
  const changed = {
    ...sample,
    accountName: 'Edited fictional account',
    favorite: false,
  };
  await service.save(changed, { id, revision: first.revision });
  const second = await service.get(id);
  assert.equal(second.createdAt, first.createdAt);
  assert.equal(second.revision, 2);
  assert.equal((await service.list('', true)).length, 0);
  await assert.rejects(service.save(changed, { id, revision: 1 }), /changed/);
  await assert.rejects(service.save({ ...sample, accountName: ' ' }), /required/);
  const saved = (await repo.items(await repo.metadata()))[0];
  for (const field of ['data', 'tag', 'nonce']) {
    const bad = {
      ...saved.envelope,
      [field]: (saved.envelope[field][0] === '0' ? '1' : '0') + saved.envelope[field].slice(1),
    };
    await db.runAsync('UPDATE vault_items SET envelope=? WHERE id=?', JSON.stringify(bad), id);
    await assert.rejects(service.get(id));
    await db.runAsync(
      'UPDATE vault_items SET envelope=? WHERE id=?',
      JSON.stringify(saved.envelope),
      id,
    );
  }
  await db.runAsync('UPDATE vault_items SET revision=revision+1 WHERE id=?', id);
  await assert.rejects(service.get(id));
  await db.runAsync('UPDATE vault_items SET revision=? WHERE id=?', saved.revision, id);
  const nonces = new Set([saved.envelope.nonce]);
  for (let i = 0; i < 12; i++) {
    const created = await service.save({
      ...sample,
      accountName: `Fictional nonce ${i}`,
    });
    const row = (await repo.items(await repo.metadata())).find((r) => r.id === created);
    assert.equal(nonces.has(row.envelope.nonce), false);
    nonces.add(row.envelope.nonce);
  }
  await service.remove(id, second.revision);
  assert.equal(await service.get(id), null);
  service.lock();
  await assert.rejects(service.list(), /Unlock/);
  assert.equal(service.getState().locked, true);
});
test('wrong password never resets data; master change rewraps unchanged ciphertext and old password stops working', async (t) => {
  let removed = 0;
  const biometrics = {
    available: async () => false,
    has: async () => false,
    read: async () => null,
    write: async () => {},
    remove: async () => {
      removed++;
    },
  };
  const { repo, service } = await fixture(t, { biometrics });
  await service.setup(pass);
  const id = await service.save(sample);
  const before = JSON.stringify(await repo.items(await repo.metadata()));
  service.lock();
  await assert.rejects(service.unlock('Incorrect fictional password'));
  assert.equal(service.getState().locked, true);
  await service.unlock(pass);
  await service.changePassword(pass, next);
  assert.equal(removed, 1);
  assert.equal(service.getState().locked, true);
  assert.equal(JSON.stringify(await repo.items(await repo.metadata())), before);
  await assert.rejects(service.unlock(pass));
  await service.unlock(next);
  assert.equal((await service.get(id)).password, sample.password);
});
test('lock invalidates late unlock/setup, inactivity uses injected monotonic clock, and public state contains no secrets', async (t) => {
  let now = 0;
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  let waiting = false;
  const crypto = {
    ...hostCrypto,
    async derive(p, s) {
      if (waiting) await blocked;
      return hostCrypto.derive(p, s);
    },
  };
  const { db } = await fixture(t);
  const service = createVaultService(createVaultRepository(db), crypto, {
    clock: () => now,
  });
  await service.refresh();
  await service.setup(pass);
  await service.save(sample);
  service.lock();
  waiting = true;
  const pending = service.unlock(pass);
  await new Promise((resolve) => setImmediate(resolve));
  service.lock();
  release();
  await assert.rejects(pending, /locked/);
  assert.equal(service.getState().locked, true);
  waiting = false;
  await service.unlock(pass);
  now = 60001;
  service.checkInactivity();
  assert.equal(service.getState().locked, true);
  assert.equal(JSON.stringify(service.getState()).includes(sample.password), false);
});
test('portable authenticated backup restores into an empty Vault and rejects tampering, unsupported KDF and replacement', async (t) => {
  const source = await fixture(t);
  await source.service.setup(pass);
  const id = await source.service.save(sample);
  const backup = await source.service.exportBackup(backupPass);
  assert.equal(backup.includes(sample.password), false);
  assert.equal(backup.includes(pass), false);
  const destination = await fixture(t);
  const changed = JSON.parse(backup);
  changed.envelope.tag = '0'.repeat(32);
  await assert.rejects(
    destination.service.restoreBackup(JSON.stringify(changed), backupPass, next),
  );
  assert.equal(await destination.repo.metadata(), null);
  const badCost = JSON.parse(backup);
  badCost.header.N = 2 ** 28;
  await assert.rejects(
    destination.service.restoreBackup(JSON.stringify(badCost), backupPass, next),
    /KDF policy/,
  );
  assert.equal(await destination.repo.metadata(), null);
  await assert.rejects(
    destination.service.restoreBackup(backup, 'Wrong fictional export password', next),
  );
  await destination.service.restoreBackup(backup, backupPass, next);
  assert.equal(destination.service.getState().locked, true);
  await destination.service.unlock(next);
  assert.equal((await destination.service.get(id)).password, sample.password);
  await assert.rejects(source.service.restoreBackup(backup, backupPass, next), /empty Vault/);
});
test('encrypted SQLite survives close/reopen; file bytes contain no fictional secrets', async () => {
  const root = mkdtempSync(join(tmpdir(), 'maivelle-vault-'));
  const filename = join(root, 'fixture.db');
  let db;
  try {
    db = openTestDatabase(filename);
    await initializeDatabase(db);
    let service = createVaultService(createVaultRepository(db), hostCrypto);
    await service.refresh();
    await service.setup(pass);
    const id = await service.save(sample);
    service.lock();
    await db.closeAsync();
    db = openTestDatabase(filename);
    await initializeDatabase(db);
    service = createVaultService(createVaultRepository(db), hostCrypto);
    await service.refresh();
    assert.equal(service.getState().locked, true);
    await service.unlock(pass);
    assert.equal((await service.get(id)).password, sample.password);
    service.lock();
    await db.closeAsync();
    db = null;
    const disk = readFileSync(filename);
    for (const value of [pass, sample.password, sample.accountName, sample.email, sample.notes])
      assert.equal(disk.includes(Buffer.from(value)), false);
  } finally {
    if (db) await db.closeAsync();
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    rmSync(target, { recursive: true, force: true });
  }
});
test('protected biometrics require a master-unlocked session, bind exact metadata and fail closed without losing password fallback', async (t) => {
  let value = null;
  let usable = true;
  let canceled = false;
  const biometrics = {
    available: async () => usable,
    has: async () => !!value,
    read: async () => {
      if (canceled) throw new Error('Canceled');
      return value;
    },
    write: async (v) => {
      value = v;
    },
    remove: async () => {
      value = null;
    },
  };
  const { db, service } = await fixture(t, { biometrics });
  await assert.rejects(service.enableBiometrics(), /Unlock/);
  await service.setup(pass);
  await service.enableBiometrics();
  service.lock();
  canceled = true;
  await assert.rejects(service.unlockBiometrics(), /master password/);
  assert.equal(service.getState().locked, true);
  canceled = false;
  await service.unlockBiometrics();
  assert.equal(service.getState().locked, false);
  service.lock();
  const original = (await db.getFirstAsync('SELECT header FROM vault_metadata')).header;
  const tampered = JSON.parse(original);
  tampered.salt = 'a'.repeat(64);
  await db.runAsync('UPDATE vault_metadata SET header=?', JSON.stringify(tampered));
  await assert.rejects(service.unlockBiometrics(), /master password/);
  await db.runAsync('UPDATE vault_metadata SET header=?', original);
  usable = false;
  await assert.rejects(service.unlockBiometrics(), /unavailable/);
  await service.unlock(pass);
  assert.equal(service.getState().locked, false);
});
test('generator validates controls and uses allowed groups without modulo-biased mapping', async (t) => {
  const { service } = await fixture(t);
  await service.setup(pass);
  const output = await service.generatePassword(64, ['lower', 'upper', 'digits']);
  assert.equal(output.length, 64);
  assert.match(output, /^[A-Za-z0-9]+$/);
  assert.match(output, /[a-z]/);
  assert.match(output, /[A-Z]/);
  assert.match(output, /[0-9]/);
  await assert.rejects(service.generatePassword(8));
  await assert.rejects(service.generatePassword(32, []));
  assert.throws(() => credential({ ...sample, accountName: '' }));
  assert.throws(() => header({}));
});
