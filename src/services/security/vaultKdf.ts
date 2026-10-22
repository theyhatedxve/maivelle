// Host reference implementation only. Extensionless app imports select vaultKdf.native.ts on Android.
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { validateKdfInputs, vaultKdfPolicy } from './vaultKdfPolicy.ts';
export { vaultKdfPolicy } from './vaultKdfPolicy.ts';

export async function deriveVaultWrappingKey(password: Uint8Array, salt: Uint8Array) {
  if (typeof __DEV__ !== 'undefined')
    throw new Error('Host reference KDF cannot run in the app. Rebuild the native KDF module.');
  validateKdfInputs(password, salt);
  return scryptAsync(password, salt, vaultKdfPolicy);
}
