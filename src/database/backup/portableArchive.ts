import {
  envelope,
  fromHex,
  toHex,
  masterPassword,
  validDate,
} from '../../features/vault/services/vaultFormat.ts';
export type Header = {
  format: string;
  version: number;
  payload: string;
  schema: number;
  id: string;
  createdAt: string;
  kdf: string;
  N: number;
  r: number;
  p: number;
  dkLen: number;
  salt: string;
};
export const MAX_PORTABLE_FRAME = 512 * 1024;
export const MAX_PORTABLE_LINE = MAX_PORTABLE_FRAME * 2 + 1024;
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_RECORDS = 100000;
const encoder = new TextEncoder();

function header(value: unknown): Header {
  const h = value as Header;
  if (
    !h ||
    Object.keys(h).sort().join(',') !==
      'N,createdAt,dkLen,format,id,kdf,p,payload,r,salt,schema,version' ||
    h.format !== 'maivelle-offline-backup' ||
    h.version !== 2 ||
    h.payload !== 'logical-records' ||
    ![10, 11].includes(h.schema) ||
    h.kdf !== 'scrypt' ||
    h.N !== 131072 ||
    h.r !== 8 ||
    h.p !== 1 ||
    h.dkLen !== 32
  )
    throw new Error('Unsupported portable encryption policy.');
  fromHex(h.id, 16);
  fromHex(h.salt, 32);
  validDate(h.createdAt);
  return h;
}
/** Authenticate ALL policy fields in canonical order and frame index. */
function aad(h: Header, index: number) {
  return encoder.encode(
    JSON.stringify([
      'Maivelle/PortableRecords',
      h.format,
      h.version,
      h.payload,
      h.schema,
      h.id,
      h.createdAt,
      h.kdf,
      h.N,
      h.r,
      h.p,
      h.dkLen,
      h.salt,
      index,
    ]),
  );
}
/** No database keys in this format. Rows remain inside independently authenticated
records; a final authenticated count/byte total detects truncation and splicing. */
export async function encryptPortable(
  records: AsyncIterable<unknown>,
  write: (line: string) => Promise<void>,
  passphrase: string,
  crypto: import('../../features/vault/services/types.ts').VaultCrypto,
) {
  const h = header({
    format: 'maivelle-offline-backup',
    version: 2,
    payload: 'logical-records',
    schema: 11,
    id: toHex(await crypto.random(16)),
    createdAt: new Date().toISOString(),
    kdf: 'scrypt',
    N: 131072,
    r: 8,
    p: 1,
    dkLen: 32,
    salt: toHex(await crypto.random(32)),
  });
  const password = masterPassword(passphrase);
  let key: Uint8Array | undefined;
  let count = 0;
  let total = 0;
  const nonces = new Set();
  try {
    key = await crypto.derive(password, fromHex(h.salt, 32));
    await write(JSON.stringify(h));
    async function frame(value: unknown) {
      const bytes = encoder.encode(JSON.stringify(value));
      try {
        if (bytes.length > MAX_PORTABLE_FRAME)
          throw new Error('Portable record exceeds supported size.');
        const e = await crypto.seal(key as Uint8Array, bytes, aad(h, count));
        if (nonces.has(e.nonce)) throw new Error('Nonce collision; archive not completed.');
        nonces.add(e.nonce);
        await write(JSON.stringify(e));
      } finally {
        bytes.fill(0);
      }
    }
    for await (const record of records) {
      const size = encoder.encode(JSON.stringify(record)).length;
      if (++count > MAX_RECORDS || (total += size) > MAX_BYTES)
        throw new Error('Portable archive exceeds supported limits.');
      // frame position is zero-based; footer uses count after all records.
      count--;
      await frame({ kind: 'record', value: record });
      count++;
    }
    await frame({ kind: 'complete', count, bytes: total });
    return h;
  } finally {
    password.fill(0);
    key?.fill(0);
  }
}
/** Staging consumer must roll back unless the iterator reaches verified completion.
Exposed records are authenticated but their complete set is not until the footer. */
export async function* decryptPortable(
  nextLine: () => Promise<string | null>,
  passphrase: string,
  crypto: import('../../features/vault/services/types.ts').VaultCrypto,
) {
  const first = await nextLine();
  if (!first || first.length > 2048) throw new Error('Invalid portable header.');
  const h = header(JSON.parse(first));
  const password = masterPassword(passphrase);
  let key;
  let count = 0;
  let total = 0;
  const nonces = new Set();
  try {
    key = await crypto.derive(password, fromHex(h.salt, 32));
    while (true) {
      const line = await nextLine();
      if (!line || line.length > MAX_PORTABLE_LINE)
        throw new Error('Incomplete or oversized portable frame.');
      const sealed = envelope(JSON.parse(line), MAX_PORTABLE_FRAME * 2);
      if (nonces.has(sealed.nonce)) throw new Error('Repeated portable nonce.');
      nonces.add(sealed.nonce);
      const bytes = await crypto.open(key, sealed, aad(h, count));
      let record;
      try {
        record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      } finally {
        bytes.fill(0);
      }
      if (record?.kind === 'complete') {
        if (record.count !== count || record.bytes !== total || (await nextLine()) !== null)
          throw new Error('Portable completion check failed.');
        return;
      }
      if (
        !record ||
        Object.keys(record).sort().join(',') !== 'kind,value' ||
        record.kind !== 'record'
      )
        throw new Error('Invalid portable record frame.');
      if (
        ++count > MAX_RECORDS ||
        (total += encoder.encode(JSON.stringify(record.value)).length) > MAX_BYTES
      )
        throw new Error('Portable archive exceeds supported limits.');
      yield record.value;
    }
  } catch {
    throw new Error(
      'Portable backup authentication or validation failed. Check the passphrase and intact backup; current data was not changed.',
    );
  } finally {
    password.fill(0);
    key?.fill(0);
  }
}
