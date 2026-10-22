const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStorageSelection } = require('../../src/database/storage/storageSelection.ts');
function fixture(state = {}, development = true) {
  const calls = [];
  const db = { source: 'keyed' };
  const options = {
    development,
    inspect: async () => ({
      journal: null,
      encryptedArtifacts: false,
      legacyArtifacts: false,
      ...state,
    }),
    encrypted: {
      open: async () => {
        calls.push('keyed');
        return db;
      },
      close: async () => {
        calls.push('release');
      },
    },
    legacy: {
      getDatabase: async () => {
        calls.push('plaintext');
        return {};
      },
      close: async () => {},
    },
  };
  return { calls, options, manager: createStorageSelection(options) };
}
test('selected encrypted storage is shared and never opens a legacy database', async () => {
  const f = fixture({ journal: { active: 'encrypted' } });
  await Promise.all([f.manager.getDatabase(), f.manager.getDatabase()]);
  assert.deepEqual(f.calls, ['keyed', 'keyed']);
  assert.equal((await f.manager.selection()).mode, 'encrypted');
});
test('wrong, missing or invalid protected key cannot cause plaintext fallback', async () => {
  const f = fixture({ journal: { active: 'encrypted' } });
  f.options.encrypted.open = async () => {
    throw Error('KEY_UNAVAILABLE');
  };
  await assert.rejects(f.manager.getDatabase, /KEY_UNAVAILABLE/);
  assert.deepEqual(f.calls, []);
});
test('incomplete first provisioning fails closed without generating storage', async () => {
  const f = fixture({ journal: { active: null, pending: 'interrupted' } });
  await assert.rejects(f.manager.getDatabase, { code: 'PROVISIONING_INCOMPLETE' });
  assert.deepEqual(f.calls, []);
});
test('encrypted orphan files without a journal block even development fallback', async () => {
  const f = fixture({ encryptedArtifacts: true, legacyArtifacts: true });
  await assert.rejects(f.manager.getDatabase, { code: 'STORAGE_SELECTION_MISSING' });
  assert.deepEqual(f.calls, []);
});
test('legacy development selection is retained and production never auto-provisions', async () => {
  const f = fixture({ legacyArtifacts: true });
  await f.manager.getDatabase();
  assert.deepEqual(f.calls, ['release', 'plaintext']);
  for (const legacyArtifacts of [true, false]) {
    const production = fixture({ legacyArtifacts }, false);
    await assert.rejects(production.manager.getDatabase, { code: 'ENCRYPTION_REQUIRED' });
    assert.deepEqual(production.calls, ['release']);
  }
});
test('journal inspection failures and retry never reset or bypass encryption', async () => {
  const f = fixture();
  let attempts = 0;
  f.options.inspect = async () => {
    attempts++;
    throw Error('damaged journal');
  };
  await assert.rejects(f.manager.getDatabase, /damaged journal/);
  await assert.rejects(f.manager.getDatabase, /damaged journal/);
  assert.equal(attempts, 2);
  assert.deepEqual(f.calls, []);
});
