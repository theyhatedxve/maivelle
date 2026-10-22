import {
  fromHex,
  toHex,
  envelope,
  masterPassword,
  validDate,
} from '../../vault/services/vaultFormat.ts';
export type BackupHeader = {
  format: 'maivelle-offline-backup';
  version: 1;
  id: string;
  createdAt: string;
  schema: number;
  bytes: number;
  chunks: number;
  chunkBytes: number;
  kdf: 'scrypt';
  N: 131072;
  r: 8;
  p: 1;
  dkLen: 32;
  salt: string;
};
export const CHUNK_BYTES = 128 * 1024;
export const MAX_DATABASE_BYTES = 64 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = MAX_DATABASE_BYTES * 3;
export const MAX_LINE_BYTES = CHUNK_BYTES * 2 + 1024;

export function backupHeader(value: unknown): BackupHeader {
  const h = value as BackupHeader;
  if (
    !h ||
    Object.keys(h).sort().join(',') !==
      'N,bytes,chunkBytes,chunks,createdAt,dkLen,format,id,kdf,p,r,salt,schema,version' ||
    h.format !== 'maivelle-offline-backup' ||
    h.version !== 1 ||
    h.kdf !== 'scrypt' ||
    h.N !== 131072 ||
    h.r !== 8 ||
    h.p !== 1 ||
    h.dkLen !== 32 ||
    !Number.isSafeInteger(h.bytes) ||
    h.bytes < 4096 ||
    h.bytes > MAX_DATABASE_BYTES ||
    h.chunkBytes !== CHUNK_BYTES ||
    h.chunks !== Math.ceil(h.bytes / CHUNK_BYTES) ||
    !Number.isSafeInteger(h.schema) ||
    h.schema < 10 ||
    h.schema > 11
  )
    throw new Error('Unsupported backup format, schema, size or KDF policy.');
  fromHex(h.id, 16);
  fromHex(h.salt, 32);
  validDate(h.createdAt);
  return h;
}
/** All header fields and exact chunk position/count are authenticated; footer prevents truncation. */
function associated(h: BackupHeader, position: number | string) {
  return new TextEncoder().encode(
    JSON.stringify([
      'Maivelle/OfflineBackup',
      1,
      h.id,
      h.createdAt,
      h.schema,
      h.bytes,
      h.chunks,
      h.chunkBytes,
      h.kdf,
      h.N,
      h.r,
      h.p,
      h.dkLen,
      h.salt,
      position,
    ]),
  );
}

export function requireSpace(h: BackupHeader, freeBytes: number) {
  if (!Number.isFinite(freeBytes) || freeBytes < h.bytes * 4 + 16 * 1024 * 1024)
    throw new Error('Insufficient local storage. Free space and retry; current data is unchanged.');
}

export async function encryptSnapshot(
  io: {
    size: number;
    schema: number;
    read: (count: number) => Promise<Uint8Array>;
    write: (line: string) => Promise<void>;
  },
  passphrase: string,
  crypto: import('../../vault/services/types.ts').VaultCrypto,
  progress: (stage: string) => void = () => {},
) {
  const h = backupHeader({
    format: 'maivelle-offline-backup',
    version: 1,
    id: toHex(await crypto.random(16)),
    createdAt: new Date().toISOString(),
    schema: io.schema,
    bytes: io.size,
    chunks: Math.ceil(io.size / CHUNK_BYTES),
    chunkBytes: CHUNK_BYTES,
    kdf: 'scrypt',
    N: 131072,
    r: 8,
    p: 1,
    dkLen: 32,
    salt: toHex(await crypto.random(32)),
  });
  const password = masterPassword(passphrase);
  let key;
  const nonces = new Set();
  try {
    progress('Deriving backup key on the native background dispatcher…');
    key = await crypto.derive(password, fromHex(h.salt, 32));
    await io.write(JSON.stringify(h));
    for (let i = 0; i <= h.chunks; i++) {
      const clear =
        i === h.chunks
          ? new Uint8Array()
          : await io.read(Math.min(CHUNK_BYTES, h.bytes - i * CHUNK_BYTES));
      try {
        if (i < h.chunks && clear.length !== Math.min(CHUNK_BYTES, h.bytes - i * CHUNK_BYTES))
          throw new Error('Snapshot changed or was truncated.');
        const sealed = await crypto.seal(
          key,
          clear,
          associated(h, i === h.chunks ? 'complete' : i),
        );
        if (nonces.has(sealed.nonce))
          throw new Error('Random nonce collision. No backup was exported; retry.');
        nonces.add(sealed.nonce);
        await io.write(JSON.stringify(sealed));
        progress(`Encrypting snapshot ${Math.min(i + 1, h.chunks)}/${h.chunks}`);
      } finally {
        clear.fill(0);
      }
    }
    if ((await io.read(1)).length) throw new Error('Snapshot size changed.');
    return h;
  } finally {
    password.fill(0);
    key?.fill(0);
  }
}
/** Bounded streaming reader; no whole-database JS allocation. Staging output only. */
export async function decryptSnapshot(
  io: {
    nextLine: () => Promise<string | null>;
    write: (bytes: Uint8Array) => Promise<void>;
    freeBytes: number;
  },
  passphrase: string,
  crypto: import('../../vault/services/types.ts').VaultCrypto,
  progress: (stage: string) => void = () => {},
) {
  const first = await io.nextLine();
  if (!first || first.length > 2048) throw new Error('Invalid backup header.');
  const h = backupHeader(JSON.parse(first));
  requireSpace(h, io.freeBytes);
  const password = masterPassword(passphrase);
  let key;
  const nonces = new Set();
  try {
    progress('Authenticating backup on the native background dispatcher…');
    key = await crypto.derive(password, fromHex(h.salt, 32));
    for (let i = 0; i <= h.chunks; i++) {
      const line = await io.nextLine();
      if (!line || line.length > MAX_LINE_BYTES)
        throw new Error('Truncated or oversized backup chunk.');
      const sealed = envelope(JSON.parse(line), CHUNK_BYTES * 2);
      if (nonces.has(sealed.nonce)) throw new Error('Repeated backup nonce.');
      nonces.add(sealed.nonce);
      let clear;
      try {
        clear = await crypto.open(key, sealed, associated(h, i === h.chunks ? 'complete' : i));
        const expected = i === h.chunks ? 0 : Math.min(CHUNK_BYTES, h.bytes - i * CHUNK_BYTES);
        if (clear.length !== expected) throw new Error('Invalid backup chunk length.');
        if (i < h.chunks) await io.write(clear);
      } catch {
        throw new Error(
          'Backup authentication failed. Check the passphrase and file integrity. Current data is unchanged.',
        );
      } finally {
        clear?.fill(0);
      }
      progress(`Verifying backup ${Math.min(i + 1, h.chunks)}/${h.chunks}`);
    }
    if ((await io.nextLine()) !== null)
      throw new Error('Unexpected backup content after completion.');
    return h;
  } finally {
    password.fill(0);
    key?.fill(0);
  }
}
