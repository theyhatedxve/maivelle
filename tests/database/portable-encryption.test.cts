const { test } = require('node:test');
const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
const {
  randomBytes,
  scrypt,
  createCipheriv,
  createDecipheriv,
  randomUUID,
} = require('node:crypto');
const { promisify } = require('node:util');
const { openTestDatabase } = require('./sqliteAdapter.cts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { exportRecords, importRecords } = require('../../src/database/backup/portableRecords.ts');
const {
  encryptPortable,
  decryptPortable,
} = require('../../src/database/backup/portableArchive.ts');
const {
  seedPortableModules,
  portableRecords,
} = require('../../src/testing/database/portableBackupFixture.ts');
// Independent real host cryptography, never shipped as an application fallback.
const crypto = {
  random: async (n) => new Uint8Array(randomBytes(n)),
  derive: async (p, s) =>
    new Uint8Array(
      await promisify(scrypt)(p, s, 32, {
        N: 131072,
        r: 8,
        p: 1,
        maxmem: 160 * 1024 * 1024,
      }),
    ),
  async seal(k, p, a) {
    const n = randomBytes(12),
      c = createCipheriv('aes-256-gcm', k, n);
    c.setAAD(a);
    return {
      v: 1,
      nonce: n.toString('hex'),
      data: Buffer.concat([c.update(p), c.final()]).toString('hex'),
      tag: c.getAuthTag().toString('hex'),
    };
  },
  async open(k, e, a) {
    const c = createDecipheriv('aes-256-gcm', k, Buffer.from(e.nonce, 'hex'));
    c.setAAD(a);
    c.setAuthTag(Buffer.from(e.tag, 'hex'));
    return new Uint8Array(Buffer.concat([c.update(Buffer.from(e.data, 'hex')), c.final()]));
  },
};
const password = 'Public production recovery fixture 2026';
const read = (lines) => {
  let i = 0;
  return async () => lines[i++] ?? null;
};
async function* values(list) {
  yield* list;
}
test('portable records preserve all module data and exact ledger in real SQLite without device keys', async () => {
  const source = openTestDatabase(),
    dest = openTestDatabase();
  try {
    await initializeDatabase(source);
    await initializeDatabase(dest);
    await seedPortableModules(source, () => randomUUID().replaceAll('-', ''));
    await source.runAsync(
      'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
      'public-note',
      'Public portable note',
      'Fictional only',
      'a',
      'a',
    );
    const records = [];
    for await (const r of exportRecords(source)) records.push(r);
    await importRecords(dest, values(records));
    assert.deepEqual(await portableRecords(dest), await portableRecords(source));
    assert.deepEqual(
      await dest.getAllAsync('SELECT * FROM schema_migrations'),
      await source.getAllAsync('SELECT * FROM schema_migrations'),
    );
    assert.equal((await dest.getAllAsync('SELECT * FROM medicine_notification_jobs')).length, 0);
    await initializeDatabase(dest);
  } finally {
    await source.closeAsync();
    await dest.closeAsync();
  }
});
test('wrong backup password, tag/AAD tampering, reordered frames, truncation and appended data fail authentication', async () => {
  const lines = [];
  await encryptPortable(
    values([{ public: 'fictional' }, { public: 'second' }]),
    async (l) => lines.push(l),
    password,
    crypto,
  );
  async function consume(list, p = password) {
    const out = [];
    for await (const r of decryptPortable(read(list), p, crypto)) out.push(r);
    return out;
  }
  assert.deepEqual(await consume(lines), [{ public: 'fictional' }, { public: 'second' }]);
  assert.ok(!lines.join('').includes('fictional'));
  const envelopes = lines.slice(1).map((line) => JSON.parse(line));
  assert.equal(new Set(envelopes.map((e) => e.nonce)).size, envelopes.length);
  await assert.rejects(() => consume(lines, 'Wrong public password 2026'));
  const badTag = [...lines];
  const e = JSON.parse(badTag[1]);
  e.tag = (e.tag[0] === '0' ? '1' : '0') + e.tag.slice(1);
  badTag[1] = JSON.stringify(e);
  const badHeader = [...lines];
  const h = JSON.parse(lines[0]);
  h.id = '00'.repeat(16);
  badHeader[0] = JSON.stringify(h);
  for (const bad of [
    badTag,
    badHeader,
    [lines[0], lines[2], lines[1], lines[3]],
    lines.slice(0, -1),
    [...lines, lines.at(-1)],
  ])
    await assert.rejects(() => consume(bad));
});
test('failed authenticated stream rolls back inserted staging rows and leaves original migration history intact', async () => {
  const source = openTestDatabase(),
    dest = openTestDatabase();
  try {
    await initializeDatabase(source);
    await initializeDatabase(dest);
    await source.runAsync(
      'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
      'n',
      'Public note',
      'Fictional',
      'a',
      'a',
    );
    const before = await dest.getAllAsync('SELECT * FROM schema_migrations');
    async function* interrupted() {
      for await (const r of exportRecords(source)) yield r;
      throw Error('simulated missing authenticated footer');
    }
    await assert.rejects(() => importRecords(dest, interrupted()));
    assert.deepEqual(await dest.getAllAsync('SELECT * FROM schema_migrations'), before);
    assert.equal((await dest.getFirstAsync('SELECT COUNT(*) AS n FROM notes')).n, 0);
  } finally {
    await source.closeAsync();
    await dest.closeAsync();
  }
});
test('import refuses populated staging, unknown tables, changed schema and foreign-key violations', async () => {
  const source = openTestDatabase();
  await initializeDatabase(source);
  const records = [];
  for await (const r of exportRecords(source)) records.push(r);
  try {
    for (const extra of [
      { kind: 'row', table: 'evil', values: [] },
      {
        kind: 'row',
        table: 'notes',
        values: ['n', 'title', 'body', 'missing-category', 'a', 'a', 0, 0],
      },
    ]) {
      const dest = openTestDatabase();
      try {
        await initializeDatabase(dest);
        await assert.rejects(() => importRecords(dest, values([...records, extra])));
      } finally {
        await dest.closeAsync();
      }
    }
    const changed = openTestDatabase();
    try {
      await initializeDatabase(changed);
      const bad = structuredClone(records);
      bad[0].columns.notes.push('untrusted_column');
      await assert.rejects(() => importRecords(changed, values(bad)));
      assert.equal(
        (await changed.getFirstAsync('SELECT COUNT(*) AS n FROM schema_migrations')).n,
        10,
      );
    } finally {
      await changed.closeAsync();
    }
    const dest = openTestDatabase();
    try {
      await initializeDatabase(dest);
      await dest.runAsync(
        'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
        'existing',
        'Keep',
        'Fictional',
        'a',
        'a',
      );
      await assert.rejects(() => importRecords(dest, values(records)), /empty staging/);
      assert.equal((await dest.getFirstAsync('SELECT title FROM notes')).title, 'Keep');
    } finally {
      await dest.closeAsync();
    }
  } finally {
    await source.closeAsync();
  }
});
test('SQLite capacity failure during import preserves source and rolls back staging ledger and rows', async () => {
  const source = openTestDatabase(),
    dest = openTestDatabase();
  try {
    await initializeDatabase(source);
    await initializeDatabase(dest);
    await source.runAsync(
      'INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)',
      'public-capacity-note',
      'Public storage fixture',
      'Fictional '.repeat(9999),
      'a',
      'a',
    );
    const before = await dest.getAllAsync('SELECT * FROM schema_migrations');
    const { page_count: pages } = await dest.getFirstAsync('PRAGMA page_count');
    await dest.execAsync(`PRAGMA max_page_count=${pages}`);
    await assert.rejects(
      () => importRecords(dest, exportRecords(source)),
      /Portable recovery failed validation/,
    );
    assert.deepEqual(await dest.getAllAsync('SELECT * FROM schema_migrations'), before);
    assert.equal((await dest.getFirstAsync('SELECT COUNT(*) AS n FROM notes')).n, 0);
    assert.equal((await source.getFirstAsync('SELECT length(body) AS n FROM notes')).n, 99990);
    await dest.execAsync('BEGIN; ROLLBACK');
  } finally {
    await source.closeAsync();
    await dest.closeAsync();
  }
});
test('an unconfirmed staging rollback is reported explicitly instead of concealing an I/O failure', async () => {
  const source = openTestDatabase(),
    dest = openTestDatabase();
  try {
    await initializeDatabase(source);
    await initializeDatabase(dest);
    const staging = {
      ...dest,
      async execAsync(sql) {
        if (sql === 'ROLLBACK') throw Error('simulated storage I/O failure');
        return dest.execAsync(sql);
      },
    };
    async function* interrupted() {
      yield* exportRecords(source);
      throw Error('simulated interrupted stream');
    }
    await assert.rejects(
      () => importRecords(staging, interrupted()),
      /staging rollback could not be confirmed/,
    );
    await dest.execAsync('ROLLBACK');
    assert.equal((await dest.getFirstAsync('SELECT COUNT(*) AS n FROM schema_migrations')).n, 11);
  } finally {
    await source.closeAsync();
    await dest.closeAsync();
  }
});
