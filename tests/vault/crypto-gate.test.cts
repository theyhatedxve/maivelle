const { test } = require('node:test');
const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
const { scryptSync } = require('node:crypto');
const { scryptAsync } = require('@noble/hashes/scrypt.js');
const {
  deriveVaultWrappingKey,
  vaultKdfPolicy,
} = require('../../src/services/security/vaultKdf.ts');
test('candidate scrypt agrees with RFC 7914 public known-answer vector', async () => {
  const key = await scryptAsync('', '', { N: 16, r: 1, p: 1, dkLen: 64 });
  assert.equal(
    Buffer.from(key).toString('hex'),
    '77d6576238657b203b19ca42c18a0497f16b4844e3074ae8dfdffa3fede21442fcd0069ded0948f8326a753a0fc81f17e8d3e0fb2e0d3628cf35e20c38d18906',
  );
  key.fill(0);
});
test('proposed full-strength wrapping KDF matches independent Node/OpenSSL implementation', async () => {
  const password = new TextEncoder().encode('Public compatibility fixture, not a password');
  const salt = new Uint8Array(32).fill(3);
  const expected = scryptSync(password, salt, 32, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 160 * 1024 * 1024,
  });
  const actual = await deriveVaultWrappingKey(password, salt);
  assert.deepEqual(Buffer.from(actual), expected);
  actual.fill(0);
  expected.fill(0);
  password.fill(0);
  salt.fill(0);
  assert.equal(Object.isFrozen(vaultKdfPolicy), true);
});
test('candidate KDF rejects invalid and excessive inputs without a weaker fallback', async () => {
  const salt = new Uint8Array(32);
  for (const password of [null, 'password', new Uint8Array(11), new Uint8Array(1025)])
    await assert.rejects(deriveVaultWrappingKey(password, salt));
  await assert.rejects(deriveVaultWrappingKey(new Uint8Array(12), new Uint8Array(31)));
});
test('Noble async scrypt yields microtasks without servicing a queued UI timer', async () => {
  let timerFired = false;
  const timer = setTimeout(() => {
    timerFired = true;
  }, 0);
  try {
    const key = await scryptAsync('', '', {
      N: 1024,
      r: 1,
      p: 1,
      dkLen: 32,
      asyncTick: 0,
    });
    key.fill(0);
    assert.equal(timerFired, false, 'asyncTick is not an off-thread or UI-yield guarantee');
  } finally {
    clearTimeout(timer);
  }
});
test('host KDF refuses an app runtime instead of becoming a JavaScript fallback', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: true,
    configurable: true,
  });
  try {
    await assert.rejects(
      deriveVaultWrappingKey(new Uint8Array(12), new Uint8Array(32)),
      /Host reference KDF cannot run in the app/,
    );
  } finally {
    Reflect.deleteProperty(globalThis, '__DEV__');
  }
});
