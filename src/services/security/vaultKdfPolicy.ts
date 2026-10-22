export const vaultKdfPolicy = Object.freeze({
  N: 131072,
  r: 8,
  p: 1,
  dkLen: 32,
  maxmem: 160 * 1024 * 1024,
  asyncTick: 10,
});

export function validateKdfInputs(password: Uint8Array, salt: Uint8Array) {
  if (!(password instanceof Uint8Array) || password.length < 12 || password.length > 1024)
    throw new Error('Master password must use 12–1024 UTF-8 bytes.');
  if (!(salt instanceof Uint8Array) || salt.length !== 32)
    throw new Error('Vault KDF salt must contain 32 bytes.');
}
