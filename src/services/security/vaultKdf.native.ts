import { requireNativeModule } from 'expo';
import { validateKdfInputs } from './vaultKdfPolicy.ts';
export { vaultKdfPolicy } from './vaultKdfPolicy.ts';
/** Android native background KDF. No JavaScript fallback. */
export async function deriveVaultWrappingKey(password: Uint8Array, salt: Uint8Array) {
  validateKdfInputs(password, salt);
  const native = requireNativeModule('MaivelleCrypto');
  const result = await native.deriveWrappingKey(password, salt);
  const bytes = new Uint8Array(result);
  if (bytes.length !== 32) throw new Error('Native wrapping key length invalid.');
  return bytes;
}
