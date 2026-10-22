const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createEncryptedDatabaseFactory,
} = require('../../src/database/storage/encryptedConnection.ts');
test('interrupted first initialization reuses its saved key, initializes and reopens without key replacement', async () => {
  const f = fixture();
  let crash = true;
  f.options.initialize = async () => {
    if (crash) throw Error('initialization crash');
  };
  await assert.rejects(
    () => createEncryptedDatabaseFactory(f.options).provision('fixture.db'),
    /ENCRYPTED_INITIALIZATION/,
  );
  const record = f.state.record;
  crash = false;
  // Factory captured initialization at construction; simulate a new process.
  const restarted = createEncryptedDatabaseFactory(f.options);
  const db = await restarted.recoverProvision('fixture.db');
  await db.closeAsync();
  assert.equal(f.state.record, record);
  assert.equal(f.state.events.filter((x) => x === 'persist-key').length, 1);
});
test('first-install key-publication interruption never causes key regeneration during explicit recovery', async () => {
  const f = fixture();
  await assert.rejects(() => f.factory.recoverProvision('fixture.db'), /KEY_UNAVAILABLE/);
  assert.equal(f.state.opens, 0);
  assert.equal(f.state.record, null);
});
function fixture() {
  const state = {
    record: null,
    exists: false,
    opens: 0,
    closed: 0,
    events: [],
    writer: null,
    random: new Uint8Array(32).fill(7),
  };
  const options = {
    readRecord: async () => state.record,
    writeRecord: async (_name, value) => {
      state.record = value;
      state.events.push('persist-key');
    },
    random: async () => state.random,
    fileExists: () => state.exists,
    openDatabase: async (_name?: string) => {
      state.opens++;
      state.exists = true;
      state.events.push('open');
      return {
        closeAsync: async () => {
          state.closed++;
        },
        getFirstAsync: async (_sql?: string): Promise<{ count?: number; name?: string } | null> => {
          state.events.push('read-schema');
          return { count: 1, name: 'schema_migrations' };
        },
      };
    },
    keyDatabase: async () => {
      state.events.push('key');
    },
    initialize: async () => {
      state.events.push('migrate');
    },
    configureWriters: (_db, open) => {
      state.writer = open;
    },
  };
  return { state, options, factory: createEncryptedDatabaseFactory(options) };
}
test('missing or malformed device key fails before native open, preserving an existing file', async () => {
  for (const record of [
    null,
    'bad-json',
    JSON.stringify({
      version: 2,
      database: 'fixture.db',
      key: '07'.repeat(32),
    }),
    JSON.stringify({ version: 1, database: 'other.db', key: '07'.repeat(32) }),
  ]) {
    const f = fixture();
    f.state.exists = true;
    f.state.record = record;
    await assert.rejects(() => f.factory.open('fixture.db'), /KEY_/);
    assert.equal(f.state.opens, 0);
    assert.equal(f.state.exists, true);
    assert.equal(f.state.record, record);
  }
});
test('explicit provision persists a native random key before open; every writer applies key before schema access', async () => {
  const f = fixture();
  await f.factory.provision('fixture.db');
  assert.deepEqual(f.state.events, ['persist-key', 'open', 'key', 'read-schema', 'migrate']);
  assert.ok(f.state.random.every((x) => x === 0));
  assert.equal(JSON.parse(f.state.record).key, '07'.repeat(32));
  const start = f.state.events.length;
  await f.state.writer();
  const writer = f.state.events.slice(start);
  assert.deepEqual(writer.slice(0, 2), ['open', 'key']);
  assert.ok(
    writer.slice(2).length > 0 && writer.slice(2).every((event) => event === 'read-schema'),
  );
});
test('open never creates a missing database even with an available key', async () => {
  const f = fixture();
  f.state.record = JSON.stringify({
    version: 1,
    database: 'fixture.db',
    key: '07'.repeat(32),
  });
  await assert.rejects(() => f.factory.open('fixture.db'), /DATABASE_MISSING/);
  assert.equal(f.state.opens, 0);
  assert.equal(f.state.exists, false);
});
test('existing file or orphan key cannot be overwritten by provisioning', async () => {
  for (const keyOnly of [false, true]) {
    const f = fixture();
    f.state.exists = !keyOnly;
    f.state.record = keyOnly ? 'retained-key-record' : null;
    await assert.rejects(() => f.factory.provision('fixture.db'), /ALREADY_PROVISIONED/);
    assert.equal(f.state.opens, 0);
    assert.deepEqual(f.state.events, []);
  }
});
test('an existing empty file or empty ledger is rejected before migrations rather than initialized as a replacement', async () => {
  for (const missingTable of [true, false]) {
    const f = fixture();
    await f.factory.provision('fixture.db');
    f.state.events.length = 0;
    const factory = createEncryptedDatabaseFactory({
      ...f.options,
      openDatabase: async (name) => {
        const db = await f.options.openDatabase(name);
        db.getFirstAsync = async (sql) =>
          sql.includes('WHERE type=')
            ? missingTable
              ? null
              : { name: 'schema_migrations' }
            : { count: 0 };
        return db;
      },
    });
    await assert.rejects(() => factory.open('fixture.db'), /DATABASE_SCHEMA_MISSING/);
    assert.ok(!f.state.events.includes('migrate'));
    assert.ok(f.state.record);
    assert.equal(f.state.exists, true);
    assert.equal(f.state.closed, 1);
  }
});
test('decryption errors close the handle and redact native error text, never initialize or delete storage', async () => {
  const f = fixture();
  f.state.exists = true;
  f.state.record = JSON.stringify({
    version: 1,
    database: 'fixture.db',
    key: '07'.repeat(32),
  });
  const factory = createEncryptedDatabaseFactory({
    ...f.options,
    keyDatabase: async () => {
      throw Error('secret-bearing-native-diagnostic');
    },
  });
  await assert.rejects(
    () => factory.open('fixture.db'),
    (error) =>
      error.code === 'DATABASE_DECRYPTION' &&
      !error.message.includes('secret-bearing') &&
      !error.cause,
  );
  assert.equal(f.state.closed, 1);
  assert.equal(f.state.exists, true);
  assert.ok(f.state.record);
  assert.ok(!f.state.events.includes('migrate'));
});
test('overlapping provision attempts cannot generate duplicate keys', async () => {
  const f = fixture();
  let resume;
  let entered;
  const started = new Promise((r) => {
    entered = r;
  });
  const factory = createEncryptedDatabaseFactory({
    ...f.options,
    random: async () => {
      entered();
      return new Promise((r) => {
        resume = r;
      });
    },
  });
  const first = factory.provision('fixture.db');
  await started;
  await assert.rejects(() => factory.provision('fixture.db'), /PROVISIONING_BUSY/);
  resume(new Uint8Array(32).fill(3));
  await first;
  assert.equal(f.state.opens, 1);
});
test('failed initialization retains key and file for explicit recovery instead of rekeying', async () => {
  const f = fixture();
  const factory = createEncryptedDatabaseFactory({
    ...f.options,
    initialize: async () => {
      throw Error('simulated migration failure');
    },
  });
  await assert.rejects(() => factory.provision('fixture.db'), /ENCRYPTED_INITIALIZATION/);
  assert.ok(f.state.record);
  assert.equal(f.state.exists, true);
  assert.equal(f.state.closed, 1);
  await assert.rejects(() => factory.provision('fixture.db'), /ALREADY_PROVISIONED/);
});
