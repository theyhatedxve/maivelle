import { envelope, fromHex, toHex } from '../../features/vault/services/vaultFormat.ts';
// Loading remains lazy: normal Home startup never loads native cryptography.
const load = () => require('expo-crypto') as typeof import('expo-crypto');

export const vaultCrypto: import('../../features/vault/services/types').VaultCrypto = {
  random: (size) => load().getRandomBytesAsync(size),
  derive: (password, salt) => require('./vaultKdf').deriveVaultWrappingKey(password, salt),
  async seal(key, clear, aad) {
    const crypto = load();
    const nonce = await crypto.getRandomBytesAsync(12);
    const nativeKey = await crypto.AESEncryptionKey.import(key);
    const sealed = await crypto.aesEncryptAsync(clear, nativeKey, {
      nonce: { bytes: nonce },
      tagLength: 16,
      additionalData: aad,
    });
    return {
      v: 1,
      nonce: toHex(nonce),
      tag: toHex(await sealed.tag()),
      data: toHex(await sealed.ciphertext()),
    };
  },
  async open(key, value, aad) {
    const e = envelope(value, 32 * 1024 * 1024);
    const crypto = load();
    try {
      return await crypto.aesDecryptAsync(
        crypto.AESSealedData.fromParts(fromHex(e.nonce, 12), fromHex(e.data), fromHex(e.tag, 16)),
        await crypto.AESEncryptionKey.import(key),
        { additionalData: aad },
      );
    } catch {
      throw new Error(
        'Authentication failed. Password is incorrect or encrypted data is damaged. No data was reset.',
      );
    }
  },
};
