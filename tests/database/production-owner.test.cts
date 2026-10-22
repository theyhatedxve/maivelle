const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createProductionOwner,
  productionJournal,
  CIPHER_POLICY,
} = require('../../src/database/storage/productionOwner.ts');
const name = (n) => `maivelle-encrypted-${String(n).padStart(32, '0')}.db`;
test('staged restore requires in-session preview before explicit activation and retains history', async () => {
  const f = fixture();
  await f.owner.provision();
  for (let n = 2; n <= 4; n++) {
    const candidate = await f.owner.stage(
      async () => {},
      async () => {},
    );
    assert.equal(productionJournal(f.state.raw).active, name(n - 1));
    assert.equal((await f.owner.open()).id, name(n - 1));
    await assert.rejects(() => f.owner.activate(name(99)), /verified again/);
    await f.owner.activate(candidate);
  }
  const j = productionJournal(f.state.raw);
  assert.equal(j.active, name(4));
  assert.equal(j.previous, name(3));
  assert.deepEqual(j.retained, [name(1), name(2)]);
  await f.owner.close();
});
test('restart invalidates restore confirmation; pending stage is retained, not automatically selected', async () => {
  const f = fixture();
  await f.owner.provision();
  const candidate = await f.owner.stage(
    async () => {},
    async () => {},
  );
  await f.owner.close();
  const restarted = createProductionOwner(f.io);
  await assert.rejects(() => restarted.activate(candidate), /verified again/);
  assert.equal((await restarted.open()).id, name(1));
  await restarted.discardPending();
  const j = productionJournal(f.state.raw);
  assert.equal(j.pending, null);
  assert.deepEqual(j.retained, [candidate]);
  assert.equal(f.state.created.length, 2);
  await restarted.close();
});
test('failed staging, write failure and cancellation preserve the active generation and every candidate', async () => {
  const f = fixture();
  await f.owner.provision();
  await assert.rejects(
    () =>
      f.owner.stage(
        async () => {
          throw Error('SQLITE_FULL');
        },
        async () => {},
      ),
    /SQLITE_FULL/,
  );
  assert.equal((await f.owner.open()).id, name(1));
  f.state.fail = 'publish';
  await assert.rejects(f.owner.discardPending, /disk-full/);
  assert.equal(productionJournal(f.state.raw).pending, name(2));
  f.state.fail = '';
  await f.owner.discardPending();
  assert.deepEqual(productionJournal(f.state.raw).retained, [name(2)]);
  await f.owner.close();
});
test('failed encrypted activation rolls back selection and reopens the previous database', async () => {
  const f = fixture();
  await f.owner.provision();
  const candidate = await f.owner.stage(
    async () => {},
    async () => {},
  );
  f.state.fail = 'publish';
  await assert.rejects(() => f.owner.activate(candidate), /disk-full/);
  f.state.fail = '';
  assert.equal((await f.owner.open()).id, name(1));
  assert.equal(productionJournal(f.state.raw).pending, candidate);
  await f.owner.close();
});
test('explicit interrupted-first recovery verifies reopened content without regenerating protected keys', async () => {
  const f = fixture();
  f.state.fail = 'publish';
  await assert.rejects(f.owner.provision);
  await f.owner.close();
  f.state.fail = '';
  const restarted = createProductionOwner(f.io);
  await assert.rejects(() => restarted.resumeFirst(undefined), /verification/);
  let verified = 0;
  await restarted.resumeFirst(async () => {
    verified++;
  });
  assert.equal(verified, 2);
  assert.deepEqual(f.state.created, [name(1)]);
  assert.equal((await restarted.open()).id, name(1));
  await assert.rejects(() => restarted.resumeFirst(async () => {}), /verification/);
  await restarted.close();
});
test('lost first-install key and interrupted initialization remain fail-closed until explicitly verified', async () => {
  const f = fixture();
  f.state.fail = 'key';
  await assert.rejects(f.owner.provision);
  f.state.fail = 'open';
  await assert.rejects(() => f.owner.resumeFirst(async () => {}), /wrong or missing key/);
  assert.equal(productionJournal(f.state.raw).active, null);
  f.state.fail = '';
  await assert.rejects(
    () =>
      f.owner.resumeFirst(async () => {
        throw Error('expected import missing');
      }),
    /expected import/,
  );
  assert.equal(productionJournal(f.state.raw).active, null);
  assert.deepEqual(f.state.created, [name(1)]);
  await f.owner.close();
});
test('malformed retained-generation lists cannot bypass journal validation', () => {
  for (const retained of [null, 'bad', ['bad.db'], [name(1)], [name(2), name(2)]])
    assert.throws(() =>
      productionJournal(
        JSON.stringify({
          version: 2,
          policy: CIPHER_POLICY,
          active: name(1),
          previous: null,
          pending: null,
          retained,
        }),
      ),
    );
});
function fixture() {
  const state = {
    raw: null,
    leased: false,
    fail: '',
    opens: [],
    created: [],
    closed: [],
    events: [],
    counter: 0,
  };
  const handle = (id) => ({
    id,
    async closeAsync() {
      state.closed.push(id);
    },
  });
  const io = {
    async acquire() {
      if (state.leased) throw Error('busy');
      state.leased = true;
      state.events.push('lease');
    },
    async release() {
      state.leased = false;
    },
    async read() {
      return state.raw;
    },
    async write(raw) {
      const j = productionJournal(raw);
      state.events.push(j.active ? (j.pending ? 'intent' : 'active') : 'first-intent');
      if (state.fail === 'intent' && j.pending) throw Error('disk-full');
      if (state.fail === 'publish' && !j.pending) throw Error('disk-full');
      state.raw = raw;
    },
    async freshName() {
      return name(++state.counter);
    },
    factory: {
      async provision(id) {
        assert.ok(state.leased);
        assert.equal(productionJournal(state.raw).pending, id);
        state.created.push(id);
        if (state.fail === 'key') throw Error('Keystore unavailable');
        return handle(id);
      },
      async open(id) {
        assert.ok(state.leased);
        state.opens.push(id);
        if (state.fail === 'open') throw Error('wrong or missing key');
        return handle(id);
      },
    },
    async verify() {
      if (state.fail === 'verify') throw Error('bad integrity');
    },
  };
  return { state, io, owner: createProductionOwner(io) };
}
test('opening unprovisioned storage acquires lease but never generates a key or database', async () => {
  const f = fixture();
  await assert.rejects(f.owner.open, /not provisioned/);
  assert.deepEqual(f.state.created, []);
  assert.deepEqual(f.state.opens, []);
  await f.owner.close();
  assert.equal(f.state.leased, false);
});
test('explicit provisioning journals intent before keys, verifies reopening, and shares one active handle', async () => {
  const f = fixture();
  await f.owner.provision();
  const a = await f.owner.open();
  assert.equal(await f.owner.open(), a);
  assert.deepEqual(f.state.events, ['lease', 'first-intent', 'active']);
  assert.deepEqual(f.state.opens, [name(1)]);
  assert.equal(productionJournal(f.state.raw).active, name(1));
  await f.owner.close();
});
test('legacy-data guard refuses first installation before intent or key publication', async () => {
  const f = fixture();
  const owner = createProductionOwner({
    ...f.io,
    assertNewInstallation: async () => {
      throw Error('legacy-data');
    },
  });
  await assert.rejects(owner.provision, /legacy-data/);
  assert.equal(f.state.raw, null);
  assert.deepEqual(f.state.created, []);
  await owner.close();
});
test('key, integrity, reopen and publication failures retain pending first provisioning without automatic retry', async () => {
  for (const point of ['key', 'verify', 'open', 'publish']) {
    const f = fixture();
    f.state.fail = point;
    await assert.rejects(f.owner.provision);
    assert.equal(productionJournal(f.state.raw).pending, name(1));
    f.state.fail = '';
    await assert.rejects(f.owner.provision, /already exists/);
    await assert.rejects(f.owner.open, /interrupted/);
    assert.deepEqual(f.state.created, [name(1)]);
    await f.owner.close();
  }
});
test('intent failure cannot publish a key', async () => {
  const f = fixture();
  f.state.fail = 'intent';
  await assert.rejects(f.owner.provision, /disk-full/);
  assert.deepEqual(f.state.created, []);
  await f.owner.close();
});
test('replacement verification failure and simulated restart reopen the previous generation', async () => {
  const f = fixture();
  await f.owner.provision();
  await assert.rejects(() =>
    f.owner.replace(
      async () => {},
      async () => {
        throw Error('wrong Vault master');
      },
    ),
  );
  assert.equal(productionJournal(f.state.raw).active, name(1));
  assert.equal(productionJournal(f.state.raw).pending, name(2));
  await f.owner.close();
  const restarted = createProductionOwner(f.io);
  await restarted.open();
  assert.equal(f.state.opens.at(-1), name(1));
  await assert.rejects(
    () =>
      restarted.replace(
        async () => {},
        async () => {},
      ),
    /prior candidate/,
  );
  await restarted.close();
});
test('publication failure retains original and candidate; active generation remains readable', async () => {
  const f = fixture();
  await f.owner.provision();
  f.state.fail = 'publish';
  await assert.rejects(
    () =>
      f.owner.replace(
        async () => {},
        async () => {},
      ),
    /disk-full/,
  );
  assert.equal(productionJournal(f.state.raw).active, name(1));
  f.state.fail = '';
  assert.equal((await f.owner.open()).id, name(1));
  await f.owner.close();
});
test('successful replacement is selected only after preparation and reopened verification', async () => {
  const f = fixture();
  await f.owner.provision();
  const checks = [];
  await f.owner.replace(
    async (db) => checks.push('prepare:' + db.id),
    async (db) => checks.push('verify:' + db.id),
  );
  assert.deepEqual(checks, ['prepare:' + name(2), 'verify:' + name(2), 'verify:' + name(2)]);
  const j = productionJournal(f.state.raw);
  assert.equal(j.active, name(2));
  assert.equal(j.previous, name(1));
  assert.equal(j.pending, null);
  assert.equal((await f.owner.open()).id, name(2));
  await f.owner.close();
});
test('malformed journals and unknown policies cannot select or initialize storage', async () => {
  for (const raw of [
    'bad',
    JSON.stringify({
      version: 1,
      policy: 'unknown',
      active: name(1),
      pending: null,
      previous: null,
    }),
    JSON.stringify({
      version: 1,
      policy: CIPHER_POLICY,
      active: name(1),
      previous: null,
      pending: name(1),
    }),
  ]) {
    const f = fixture();
    f.state.raw = raw;
    await assert.rejects(f.owner.open);
    assert.deepEqual(f.state.opens, []);
    assert.deepEqual(f.state.created, []);
    await f.owner.close();
  }
});
test('concurrent owners and overlapping operations cannot provision competing keys', async () => {
  const f = fixture();
  await f.owner.provision();
  const other = createProductionOwner(f.io);
  await assert.rejects(other.open, /busy/);
  let resume, entered;
  const started = new Promise((r) => (entered = r));
  const work = f.owner.replace(
    async () => {
      entered();
      await new Promise((r) => (resume = r));
    },
    async () => {},
  );
  await started;
  await assert.rejects(f.owner.open, /already running/);
  resume();
  await work;
  await f.owner.close();
});
test('first publication waits for imported data and reopened verification; failed import leaves no active generation', async () => {
  const f = fixture();
  const events = [];
  await f.owner.provision(
    async () => events.push('import'),
    async () => events.push('Vault verification'),
  );
  assert.deepEqual(events, ['import', 'Vault verification', 'Vault verification']);
  await f.owner.close();
  const failed = fixture();
  await assert.rejects(
    () =>
      failed.owner.provision(async () => {
        throw Error('failed import');
      }),
    /failed import/,
  );
  assert.equal(productionJournal(failed.state.raw).active, null);
  assert.equal(productionJournal(failed.state.raw).pending, name(1));
  await failed.owner.close();
});
test('snapshot owns a separate handle, retains the lease and closes the handle on export failure', async () => {
  const f = fixture();
  await f.owner.provision();
  const current = await f.owner.open();
  await assert.rejects(
    () =>
      f.owner.snapshot(async (db) => {
        assert.notEqual(db, current);
        assert.equal(f.state.leased, true);
        throw Error('export failed');
      }),
    /export failed/,
  );
  assert.equal(f.state.leased, true);
  assert.equal(await f.owner.open(), current);
  assert.equal(f.state.closed.length, 2);
  await f.owner.close();
});
test('publication acknowledgement loss never resets storage; verified durable selection can reopen', async () => {
  const f = fixture();
  let fault = true;
  const owner = createProductionOwner({
    ...f.io,
    read: async () => {
      const j = productionJournal(f.state.raw);
      if (j?.active && !j.pending && fault) {
        fault = false;
        return null;
      }
      return f.state.raw;
    },
  });
  await assert.rejects(owner.provision, /read-back failed/);
  assert.equal(productionJournal(f.state.raw).active, name(1));
  assert.equal((await owner.open()).id, name(1));
  assert.deepEqual(f.state.created, [name(1)]);
  await owner.close();
});
