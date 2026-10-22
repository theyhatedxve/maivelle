/** Compatibility probe only. Public fixtures, no credential persistence or key provisioning.
 * The approved gate must pass on the actual Android binary before a vault can be enabled. */

export async function verifyVaultCryptoGate(onProgress: (stage: string) => void = () => {}) {
  if (!__DEV__) throw new Error('Security diagnostics are development-only.');
  onProgress('loading native crypto');
  // Keep native loading lazy, but bundle this probe dependency locally rather than
  // relying on an additional development-server chunk request during the gate.
  const crypto = require('expo-crypto') as typeof import('expo-crypto');
  const results: string[] = [];

  function check(ok: boolean, label: string) {
    if (!ok) throw new Error(`Security gate failed: ${label}`);
    results.push(`PASS: ${label}`);
  }
  onProgress('native randomness');
  const random = await crypto.getRandomBytesAsync(32);
  check(
    random.length === 32 && random.some((b) => b !== 0),
    'native SecureRandom API available (not a statistical security proof)',
  );
  random.fill(0);
  return results.concat(await verifyVaultAes(onProgress), await verifyVaultKdf(onProgress));
}

export async function verifyVaultKdf(onProgress: (stage: string) => void = () => {}) {
  if (!__DEV__) throw new Error('Security diagnostics are development-only.');
  const { requireNativeModule } = require('expo');
  const native = requireNativeModule('MaivelleCrypto');
  const { deriveVaultWrappingKey } = require('./vaultKdf');
  const results: string[] = [];

  const hex = (value: Uint8Array) =>
    Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');

  function check(ok: boolean, label: string) {
    if (!ok) throw new Error(`Security gate failed: ${label}`);
    results.push(`PASS: ${label}`);
  }
  // RFC 7914 section 12 public scrypt vector; this does not select production work factors.
  onProgress('RFC scrypt vector');
  check(await native.verifyRfcVector(true), 'RFC 7914 native scrypt vector');
  onProgress('full-cost scrypt');
  const started = Date.now();
  let timerTicks = 0;
  const timer = setInterval(() => {
    timerTicks++;
  }, 10);
  let derived;
  try {
    derived = await deriveVaultWrappingKey(
      new TextEncoder().encode('Public compatibility fixture, not a password'),
      new Uint8Array(32).fill(3),
    );
  } finally {
    clearInterval(timer);
  }
  check(
    hex(derived) === '2b365f49da389c33d7e9abf10f64671f8d6bb9bfb97049b6b4ec0a1490b13155',
    `scrypt N=131072/r=8/p=1 completed in ${Date.now() - started} ms`,
  );
  derived.fill(0);
  check(timerTicks > 0, `JS event loop responsive during native KDF (${timerTicks} timer ticks)`);
  let rejected = false;
  try {
    await native.deriveWrappingKey(new Uint8Array(11), new Uint8Array(32));
  } catch {
    rejected = true;
  }
  check(rejected, 'native KDF rejects invalid password length');
  rejected = false;
  try {
    await native.deriveWrappingKey(new Uint8Array(12), new Uint8Array(31));
  } catch {
    rejected = true;
  }
  check(rejected, 'native KDF rejects invalid salt length');
  return results;
}

export async function verifyVaultAes(onProgress: (stage: string) => void = () => {}) {
  if (!__DEV__) throw new Error('Security diagnostics are development-only.');
  const crypto = require('expo-crypto') as typeof import('expo-crypto');
  const results: string[] = [];

  const hex = (value: Uint8Array) =>
    Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');

  function check(ok: boolean, label: string) {
    if (!ok) throw new Error(`Security gate failed: ${label}`);
    results.push(`PASS: ${label}`);
  }
  onProgress('AES-256-GCM vector and decrypt');
  const key = await crypto.AESEncryptionKey.import(new Uint8Array(32));
  const sealed = await crypto.aesEncryptAsync(new Uint8Array(16), key, {
    nonce: { bytes: new Uint8Array(12) },
    tagLength: 16,
  });
  check(
    hex(await sealed.ciphertext()) === 'cea7403d4d606b6e074ec5d3baf39d18' &&
      hex(await sealed.tag()) === 'd0d1c8a799996bf0265b98b5d48ab919',
    'AES-256-GCM known-answer vector',
  );
  const clear = await crypto.aesDecryptAsync(sealed, key);
  check(clear.length === 16 && clear.every((byte) => byte === 0), 'AES-256-GCM native decrypt');
  clear.fill(0);
  onProgress('wrong-key rejection');
  const wrongKey = await crypto.AESEncryptionKey.import(new Uint8Array(32).fill(1));
  let wrongKeyRejected = false;
  try {
    await crypto.aesDecryptAsync(sealed, wrongKey);
  } catch {
    wrongKeyRejected = true;
  }
  check(wrongKeyRejected, 'wrong AES key rejected');
  onProgress('ciphertext tamper rejection');
  const tampered = await sealed.ciphertext();
  tampered[0] ^= 1;
  let rejected = false;
  try {
    await crypto.aesDecryptAsync(
      crypto.AESSealedData.fromParts(await sealed.iv(), tampered, await sealed.tag()),
      key,
    );
  } catch {
    rejected = true;
  }
  check(rejected, 'modified authenticated ciphertext rejected');
  const badTag = await sealed.tag();
  badTag[0] ^= 1;
  rejected = false;
  try {
    await crypto.aesDecryptAsync(
      crypto.AESSealedData.fromParts(await sealed.iv(), await sealed.ciphertext(), badTag),
      key,
    );
  } catch {
    rejected = true;
  }
  check(rejected, 'modified authentication tag rejected');
  onProgress('associated-data tamper rejection');
  const aad = new Uint8Array([1, 2, 3]);
  const withAad = await crypto.aesEncryptAsync(new Uint8Array([4, 5, 6]), key, {
    additionalData: aad,
  });
  rejected = false;
  try {
    await crypto.aesDecryptAsync(withAad, key, {
      additionalData: new Uint8Array([1, 2, 4]),
    });
  } catch {
    rejected = true;
  }
  check(rejected, 'modified associated data rejected');
  onProgress('sample nonce uniqueness');
  const nonces = new Set();
  for (let i = 0; i < 32; i++) {
    const row = await crypto.aesEncryptAsync(new Uint8Array([i]), key, {
      nonce: { bytes: await crypto.getRandomBytesAsync(12) },
      tagLength: 16,
    });
    nonces.add(hex(await row.iv()));
  }
  check(nonces.size === 32, 'sample nonce uniqueness (not a proof against all collisions)');
  return results;
}
