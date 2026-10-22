const { test } = require('node:test');
const assert = require('node:assert/strict');
const { configureNativeTransactions } = require('../../src/database/transactions.ts');
test('an encrypted-named handle cannot install an unkeyed writer fallback', () => {
  const db: Pick<import('expo-sqlite').SQLiteDatabase, 'databasePath'> &
    Partial<Pick<import('expo-sqlite').SQLiteDatabase, 'withExclusiveTransactionAsync'>> = {
    databasePath: '/private/maivelle-encrypted-fixture.db',
  };
  assert.throws(() => configureNativeTransactions(db), /protected-key connection factory/);
});
test('initialization preserves the previously registered keyed writer factory', async () => {
  const events = [];
  const db: Pick<import('expo-sqlite').SQLiteDatabase, 'databasePath'> &
    Partial<Pick<import('expo-sqlite').SQLiteDatabase, 'withExclusiveTransactionAsync'>> = {
    databasePath: '/private/maivelle-encrypted-fixture.db',
  };
  configureNativeTransactions(db, async () => ({
    execAsync: async (sql) => {
      events.push(sql);
    },
    getFirstAsync: async () => ({ foreign_keys: 1 }),
    closeAsync: async () => {
      events.push('close');
    },
  }));
  const registered = db.withExclusiveTransactionAsync;
  configureNativeTransactions(db);
  assert.equal(db.withExclusiveTransactionAsync, registered);
  await registered(async () => {
    events.push('write');
  });
  assert.deepEqual(events, [
    'PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
    'BEGIN IMMEDIATE',
    'write',
    'COMMIT',
    'close',
  ]);
});
