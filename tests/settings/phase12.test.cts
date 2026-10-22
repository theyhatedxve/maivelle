const { test } = require('node:test');
const {
  confirmReplacement,
} = require('../../src/features/settings/services/replacementConfirmation.ts');
const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
test('replacement cancellation and dismissal never authorize storage work', async () => {
  for (const decision of ['cancel', 'dismiss', 'replace']) {
    let storageCalls = 0;
    const approved = await confirmReplacement((_title, _message, buttons, options) => {
      if (decision === 'dismiss') options.onDismiss();
      else buttons[decision === 'replace' ? 1 : 0].onPress();
      // A late duplicate callback cannot change the first decision.
      buttons[1].onPress();
    });
    if (approved) storageCalls++;
    assert.equal(storageCalls, decision === 'replace' ? 1 : 0);
  }
});
const { randomBytes, scrypt, createCipheriv, createDecipheriv } = require('node:crypto');
const { promisify } = require('node:util');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { backup } = require('node:sqlite');
const { openTestDatabase } = require('../database/sqliteAdapter.cts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { migrations } = require('../../src/database/migrations/index.ts');
const { applyMigrations } = require('../../src/database/migrations/migrate.ts');
const {
  createSettingsRepository,
} = require('../../src/database/repositories/settingsRepository.ts');
const { preferenceDefaults } = require('../../src/features/settings/model/preferences.ts');
const {
  createStorageControl,
  ORIGINAL_DATABASE,
} = require('../../src/database/storage/storageControl.ts');
const { cutoverDatabase } = require('../../src/database/storage/cutover.ts');
const { guardDatabase } = require('../../src/database/storage/maintenance.ts');
const {
  encryptSnapshot,
  decryptSnapshot,
  requireSpace,
  CHUNK_BYTES,
  MAX_DATABASE_BYTES,
} = require('../../src/features/settings/services/backupFormat.ts');
const {
  validateSchema,
  migrateRestored,
  validateVault,
  integrity,
} = require('../../src/features/settings/services/backupValidation.ts');
const { toHex, fromHex } = require('../../src/features/vault/services/vaultFormat.ts');
const { createVaultRepository } = require('../../src/database/repositories/vaultRepository.ts');
const { createVaultService } = require('../../src/features/vault/services/vaultService.ts');
const { createAppLockService } = require('../../src/features/settings/services/appLockService.ts');
const { randomUUID } = require('node:crypto');
const {
  seedPortableModules,
  portableRecords,
  verifyRestoredReminders,
} = require('../../src/testing/database/portableBackupFixture.ts');
const {
  createMedicineRepository,
} = require('../../src/database/repositories/medicineRepository.ts');
const {
  createMedicineService,
} = require('../../src/features/medicine/services/medicineService.ts');
const {
  createMedicineReconciler,
  MEDICINE_OWNER,
} = require('../../src/services/notifications/medicineReconciler.ts');
// Independent host backend only; never an app fallback or reduced-cost KDF.
const crypto = {
  async random(n) {
    return new Uint8Array(randomBytes(n));
  },
  async derive(p, s) {
    return new Uint8Array(
      await promisify(scrypt)(p, s, 32, {
        N: 131072,
        r: 8,
        p: 1,
        maxmem: 160 * 1024 * 1024,
      }),
    );
  },
  async seal(k, p, a) {
    const nonce = randomBytes(12),
      c = createCipheriv('aes-256-gcm', k, nonce);
    c.setAAD(a);
    const data = Buffer.concat([c.update(p), c.final()]);
    return {
      v: 1,
      nonce: toHex(nonce),
      tag: toHex(c.getAuthTag()),
      data: toHex(data),
    };
  },
  async open(k, e, a) {
    const c = createDecipheriv('aes-256-gcm', k, fromHex(e.nonce));
    c.setAAD(a);
    c.setAuthTag(fromHex(e.tag));
    return new Uint8Array(Buffer.concat([c.update(fromHex(e.data)), c.final()]));
  },
};
const password = 'Public phase twelve backup fixture';
const master = 'Public phase twelve master fixture';
function archiveInput(lines, output = []) {
  let i = 0;
  return {
    nextLine: async () => lines[i++] ?? null,
    write: async (b) => output.push(Buffer.from(b)),
    freeBytes: 1024 ** 3,
  };
}
async function encrypt(bytes) {
  let offset = 0;
  const lines = [];
  await encryptSnapshot(
    {
      size: bytes.length,
      schema: 10,
      read: async (n) => {
        const b = Uint8Array.from(bytes.subarray(offset, offset + n));
        offset += b.length;
        return b;
      },
      write: async (line) => {
        lines.push(line);
      },
    },
    password,
    crypto,
  );
  return lines;
}
async function fixture(t) {
  const db = openTestDatabase();
  await initializeDatabase(db);
  t.after(() => db.closeAsync());
  return db;
}
test('preferences reuse app_settings, validate every field and survive disk reopen without raw secrets', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'maivelle-prefs-'));
  const file = join(dir, 'prefs.db');
  let db = openTestDatabase(file);
  t.after(async () => {
    await db.closeAsync();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir())));
    rmSync(dir, { recursive: true });
  });
  await initializeDatabase(db);
  let repo = createSettingsRepository(db);
  assert.deepEqual(await repo.read(), preferenceDefaults);
  for (const [key, value] of Object.entries({
    appearance: 'dark',
    appLock: true,
    inactivitySeconds: 300,
    protectScreens: true,
    medicineReminders: false,
    confirmExternalBackup: false,
  }))
    await repo.write(key, value);
  const created = (
    await db.getFirstAsync(
      'SELECT created_at FROM app_settings WHERE key=?',
      'preferences.v1.appearance',
    )
  ).created_at;
  await repo.write('appearance', 'system');
  assert.equal(
    (
      await db.getFirstAsync(
        'SELECT created_at FROM app_settings WHERE key=?',
        'preferences.v1.appearance',
      )
    ).created_at,
    created,
  );
  for (const [key, value] of [
    ['appearance', 'bad'],
    ['inactivitySeconds', 0],
    ['appLock', 'true'],
    ['rawPIN', '1234'],
  ])
    await assert.rejects(() => repo.write(key, value));
  await db.closeAsync();
  db = openTestDatabase(file);
  repo = createSettingsRepository(db);
  const value = await repo.read();
  assert.equal(value.appearance, 'system');
  assert.equal(value.appLock, true);
  assert.equal(value.medicineReminders, false);
});
test('chunked authenticated archive round trips, binds header/position/footer and rejects wrong passwords or tampering', async () => {
  const bytes = randomBytes(CHUNK_BYTES + 4096);
  const lines = await encrypt(bytes);
  const out = [];
  await decryptSnapshot(archiveInput(lines, out), password, crypto);
  assert.deepEqual(Buffer.concat(out), bytes);
  const nonces = lines.slice(1).map((x) => JSON.parse(x).nonce);
  assert.equal(new Set(nonces).size, nonces.length);
  assert.ok(!lines.join('').includes(password));
  await assert.rejects(
    () => decryptSnapshot(archiveInput(lines), 'Wrong public backup password', crypto),
    /authentication failed/,
  );
  for (const field of ['data', 'tag', 'nonce']) {
    const bad = [...lines];
    const e = JSON.parse(bad[1]);
    e[field] = (e[field][0] === '0' ? '1' : '0') + e[field].slice(1);
    bad[1] = JSON.stringify(e);
    await assert.rejects(() => decryptSnapshot(archiveInput(bad), password, crypto));
  }
  const changed = [...lines];
  const h = JSON.parse(changed[0]);
  h.id = 'a'.repeat(32);
  changed[0] = JSON.stringify(h);
  await assert.rejects(
    () => decryptSnapshot(archiveInput(changed), password, crypto),
    /authentication/,
  );
  await assert.rejects(() =>
    decryptSnapshot(archiveInput([lines[0], lines[2], lines[1], lines[3]]), password, crypto),
  );
  await assert.rejects(
    () => decryptSnapshot(archiveInput(lines.slice(0, -1)), password, crypto),
    /Truncated/,
  );
  await assert.rejects(
    () => decryptSnapshot(archiveInput([...lines, lines[1]]), password, crypto),
    /Unexpected/,
  );
});
test('unsupported policies, oversized headers and insufficient space fail before KDF or live writes', async () => {
  const lines = await encrypt(randomBytes(4096));
  let derives = 0;
  const counted = {
    ...crypto,
    derive: async () => {
      derives++;
      throw Error('must not derive');
    },
  };
  for (const patch of [
    { N: 1024 },
    { schema: 999 },
    { version: 99 },
    { bytes: MAX_DATABASE_BYTES + 1 },
    { chunkBytes: 1 },
  ]) {
    const bad = [JSON.stringify({ ...JSON.parse(lines[0]), ...patch })];
    await assert.rejects(() => decryptSnapshot(archiveInput(bad), password, counted));
  }
  await assert.rejects(
    () => decryptSnapshot({ ...archiveInput(lines), freeBytes: 0 }, password, counted),
    /Insufficient/,
  );
  assert.equal(derives, 0);
  assert.throws(() => requireSpace(JSON.parse(lines[0]), NaN));
});
test('consistent disk snapshot preserves all eight modules and encrypted Vault; staged schema and Vault checks precede cutover', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'maivelle-restore-'));
  const source = openTestDatabase(join(dir, 'source.db')),
    reference = openTestDatabase();
  let stage;
  t.after(async () => {
    await source.closeAsync();
    await reference.closeAsync();
    if (stage) await stage.closeAsync();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir())));
    rmSync(dir, { recursive: true });
  });
  await initializeDatabase(source);
  await initializeDatabase(reference);
  await source.runAsync(
    'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
    'old-note',
    'Public original note',
    'fictional',
    '2026-01-01',
    '2026-01-01',
  );
  const service = createVaultService(createVaultRepository(source), crypto);
  await service.refresh();
  await service.setup(master);
  const id = await service.save({
    accountName: 'Public backup account',
    username: 'synthetic',
    email: 'fixture@example.invalid',
    password: 'PublicOnly123',
    website: '',
    notes: '',
    category: '',
    favorite: false,
  });
  service.lock();
  await seedPortableModules(source, randomUUID);
  const expectedRecords = await portableRecords(source);
  for (const table of [
    'notes',
    'tasks',
    'calendar_events',
    'medicines',
    'time_sessions',
    'transactions',
    'budgets',
    'vault_items',
  ])
    assert.ok(expectedRecords[table].length, `fixture must include ${table}`);
  await backup(source.native, join(dir, 'snapshot.db'));
  await source.runAsync(
    'UPDATE notes SET title=? WHERE id=?',
    'Changed after snapshot',
    'old-note',
  );
  const lines = await encrypt(readFileSync(join(dir, 'snapshot.db')));
  const output = [];
  await decryptSnapshot(archiveInput(lines, output), password, crypto);
  writeFileSync(join(dir, 'stage.db'), Buffer.concat(output));
  stage = openTestDatabase(join(dir, 'stage.db'));
  await validateSchema(stage, reference);
  await migrateRestored(stage);
  await migrateRestored(stage);
  await integrity(stage);
  assert.deepEqual(await portableRecords(stage), expectedRecords);
  assert.ok((await verifyRestoredReminders(stage, randomUUID)) > 0);
  assert.equal(
    (await stage.getFirstAsync('SELECT title FROM notes WHERE id=?', 'old-note')).title,
    'Public original note',
  );
  assert.equal(
    (await source.getFirstAsync('SELECT title FROM notes WHERE id=?', 'old-note')).title,
    'Changed after snapshot',
  );
  await assert.rejects(() => validateVault(stage, 'Wrong public master password', crypto));
  assert.equal(await validateVault(stage, master, crypto), true);
  const restored = createVaultService(createVaultRepository(stage), crypto);
  await restored.refresh();
  await restored.unlock(master);
  assert.equal((await restored.get(id)).password, 'PublicOnly123');
  restored.lock();
  const futurePlan = [
    ...migrations,
    {
      version: 11,
      name: 'isolated-post-restore-probe',
      sql: 'CREATE TABLE phase12_future_fixture(id TEXT PRIMARY KEY)',
    },
  ];
  await applyMigrations(stage, futurePlan);
  await applyMigrations(stage, futurePlan);
  assert.equal(
    (await stage.getFirstAsync('SELECT title FROM notes WHERE id=?', 'old-note')).title,
    'Public original note',
  );
  const afterMigration = createVaultService(createVaultRepository(stage), crypto);
  await afterMigration.refresh();
  await afterMigration.unlock(master);
  assert.equal((await afterMigration.get(id)).password, 'PublicOnly123');
  afterMigration.lock();
  await stage.execAsync('CREATE TABLE unexpected(value TEXT)');
  await assert.rejects(() => validateSchema(stage, reference), /schema differs/);
});
test('transactional storage pointer finalizes replacement and rolls back failures or interrupted startup without changing prior records', async (t) => {
  const db = await fixture(t);
  const control = createStorageControl(db);
  await control.initialize();
  const candidate = 'maivelle-restored-' + 'a'.repeat(32) + '.db';
  let failures = 0;
  const io = {
    control,
    close: async () => {},
    open: async () => {},
    verify: async () => {},
  };
  await assert.rejects(
    () =>
      cutoverDatabase(
        {
          ...io,
          verify: async () => {
            failures++;
            throw Error('fictional open failure');
          },
        },
        candidate,
      ),
    /previous database was reopened/,
  );
  assert.equal((await control.read()).active, ORIGINAL_DATABASE);
  assert.equal(failures, 1);
  await cutoverDatabase(io, candidate);
  assert.deepEqual(await control.read(), {
    active: candidate,
    previous: ORIGINAL_DATABASE,
    pending: false,
  });
  await control.select(ORIGINAL_DATABASE, candidate, true);
  await control.initialize();
  assert.equal((await control.read()).active, candidate);
  assert.equal((await control.read()).pending, false);
  await assert.rejects(() => cutoverDatabase(io, '../outside.db'), /Invalid/);
});
test('storage generations reject late async writes and drain active transactions before closing', async (t) => {
  const db = await fixture(t);
  const guarded = guardDatabase(db);
  let release;
  const pending = guarded.db.withExclusiveTransactionAsync(async (tx) => {
    await new Promise((r) => {
      release = r;
    });
    await tx.runAsync('INSERT INTO app_settings VALUES(?,?,?,?)', 'fixture', 'true', 'x', 'x');
  });
  await new Promise((r) => setImmediate(r));
  let drained = false;
  const retiring = guarded.retire().then(() => {
    drained = true;
  });
  assert.equal(drained, false);
  await assert.rejects(() => guarded.db.runAsync('DELETE FROM notes'), /reopening/);
  release();
  await pending;
  await retiring;
  assert.equal(drained, true);
  assert.equal(
    (await db.getFirstAsync('SELECT value FROM app_settings WHERE key=?', 'fixture')).value,
    'true',
  );
});
test('app access gate rejects overlapping/late authentication, locks on inactivity and never authorizes Vault keys', async () => {
  let now = 0,
    release;
  let calls = 0;
  const gate = createAppLockService(
    async () => {
      calls++;
      await new Promise((r) => {
        release = r;
      });
    },
    () => now,
  );
  gate.configure(true, 60);
  assert.equal(gate.getState().locked, true);
  const pending = gate.unlock();
  await assert.rejects(() => gate.unlock(), /already running/);
  gate.lock();
  release();
  await assert.rejects(() => pending, /backgrounded/);
  assert.equal(gate.getState().locked, true);
  const successful = gate.unlock();
  release();
  await successful;
  assert.equal(gate.getState().locked, false);
  now = 59999;
  gate.check();
  assert.equal(gate.getState().locked, false);
  now = 60000;
  gate.check();
  assert.equal(gate.getState().locked, true);
  assert.deepEqual(Object.keys(gate.getState()).sort(), ['busy', 'locked']);
  assert.equal(calls, 2);
});
test('reminder preference and permission changes preserve medicine schedules; empty restored job ledger rebuilds derived requests', async (t) => {
  const db = await fixture(t),
    settings = createSettingsRepository(db);
  const repo = createMedicineRepository(db, randomUUID);
  const now = new Date(2026, 9, 20, 9);
  const medicine = createMedicineService(repo, () => now);
  await medicine.save(null, {
    name: 'Public phase12 medicine',
    form: 'Fictional',
    instructions: 'Test only',
    notes: '',
    active: true,
    startDate: null,
    endDate: null,
    schedules: [
      {
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        times: ['20:00'],
        startDate: null,
        endDate: null,
      },
    ],
  });
  const before = await db.getAllAsync('SELECT * FROM medicine_schedules');
  const doses = await medicine.doses('2026-10-20', '2026-10-22');
  const pending = new Map();
  let granted = true;
  const adapter = {
    permissions: async () => ({
      granted: granted && (await settings.read()).medicineReminders,
      exact: false,
    }),
    pending: async () => [...pending.values()],
    cancel: async (id) => {
      pending.delete(id);
    },
    schedule: async (dose, id, delivery) => {
      pending.set(id, {
        id,
        owner: MEDICINE_OWNER,
        occurrenceId: dose.id,
        scheduledAt: dose.scheduledAt,
        delivery,
      });
      return id;
    },
  };
  const reconciler = createMedicineReconciler(repo, adapter);
  await reconciler.reconcile(doses, now);
  assert.ok(pending.size > 0);
  await settings.write('medicineReminders', false);
  await reconciler.reconcile(doses, now);
  assert.equal(pending.size, 0);
  assert.deepEqual(await db.getAllAsync('SELECT * FROM medicine_schedules'), before);
  await settings.write('medicineReminders', true);
  granted = false;
  await reconciler.reconcile(doses, now);
  assert.equal(pending.size, 0);
  assert.deepEqual(await db.getAllAsync('SELECT * FROM medicine_schedules'), before);
  granted = true;
  await db.execAsync('DELETE FROM medicine_notification_jobs');
  await reconciler.reconcile(doses, now);
  assert.ok(pending.size > 0);
  assert.equal((await repo.jobs()).length, pending.size);
});
