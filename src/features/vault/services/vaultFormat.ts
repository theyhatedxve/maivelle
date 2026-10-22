export const FORMAT = 1;
export const MAX_ITEMS = 500;
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

export const toHex = (bytes: Uint8Array) => {
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 4096)
    chunks.push(
      Array.from(bytes.subarray(i, i + 4096), (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
      ),
    );
  return chunks.join('');
};

export function fromHex(value: unknown, length?: number) {
  if (
    typeof value !== 'string' ||
    value.length > MAX_BACKUP_BYTES ||
    value.length % 2 !== 0 ||
    !/^[0-9a-f]*$/.test(value) ||
    (length !== undefined && value.length !== length * 2)
  )
    throw new Error('Unsupported or damaged Vault encoding.');
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function validId(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{32}$/.test(value))
    throw new Error('Invalid Vault identifier.');
  return value;
}

export function envelope(value: unknown, maxHex: number = 200000): import('./types.ts').Envelope {
  if (!value || typeof value !== 'object') throw new Error('Invalid encrypted envelope.');
  const e = value as import('./types.ts').Envelope;
  if (e.v !== 1 || Object.keys(e).sort().join(',') !== 'data,nonce,tag,v')
    throw new Error('Unsupported encrypted envelope.');
  if (typeof e.data !== 'string' || e.data.length > maxHex)
    throw new Error('Encrypted payload is too large.');
  fromHex(e.nonce, 12);
  fromHex(e.tag, 16);
  fromHex(e.data);
  return e;
}

export function header(value: unknown): import('./types.ts').Header {
  const h = value as import('./types.ts').Header;
  if (
    !h ||
    h.format !== 1 ||
    h.kdf !== 'scrypt' ||
    h.N !== 131072 ||
    h.r !== 8 ||
    h.p !== 1 ||
    h.dkLen !== 32 ||
    !Number.isSafeInteger(h.revision) ||
    h.revision < 1
  )
    throw new Error('Unsupported Vault format or KDF policy.');
  if (
    Object.keys(h).sort().join(',') !==
    'N,createdAt,dkLen,format,id,kdf,p,r,revision,salt,updatedAt'
  )
    throw new Error('Unsupported Vault header.');
  validId(h.id);
  fromHex(h.salt, 32);
  validDate(h.createdAt);
  validDate(h.updatedAt);
  if (h.updatedAt < h.createdAt) throw new Error('Invalid Vault timestamps.');
  return h;
}

export function validDate(value: unknown) {
  if (
    typeof value !== 'string' ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new Error('Invalid Vault timestamp.');
  return value;
}

export const aad = (parts: unknown[]) =>
  new TextEncoder().encode(JSON.stringify(['Maivelle/Vault', 1, ...parts]));

export const wrapAad = (h: import('./types.ts').Header) =>
  aad([
    'master-wrap',
    h.id,
    h.revision,
    h.salt,
    h.kdf,
    h.N,
    h.r,
    h.p,
    h.dkLen,
    h.createdAt,
    h.updatedAt,
  ]);

export const itemAad = (row: Omit<import('./types.ts').ItemRow, 'envelope'>) =>
  aad(['credential', row.vaultId, row.id, row.revision, row.createdAt, row.updatedAt]);

export function credential(input: unknown): import('./types.ts').Credential {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Enter credential fields.');
  const value = input as Record<string, unknown>;
  const limits = {
    accountName: 120,
    username: 320,
    email: 320,
    password: 1024,
    website: 2048,
    notes: 20000,
    category: 80,
  };
  if (Object.keys(value).some((key) => ![...Object.keys(limits), 'favorite'].includes(key)))
    throw new Error('Unsupported credential fields.');
  for (const [key, max] of Object.entries(limits))
    if (typeof value[key] !== 'string' || (value[key] as string).length > max)
      throw new Error(`Invalid ${key} (maximum ${max} characters).`);
  if (!(value.accountName as string).trim()) throw new Error('Account name is required.');
  if (typeof value.favorite !== 'boolean') throw new Error('Invalid favorite state.');
  return {
    ...(input as import('./types.ts').Credential),
    accountName: (value.accountName as string).trim(),
  };
}

export function masterPassword(value: string) {
  if (
    typeof value !== 'string' ||
    Array.from(value).length < 12 ||
    new TextEncoder().encode(value).length > 1024
  )
    throw new Error(
      'Use a master password of at least 12 characters and at most 1024 UTF-8 bytes.',
    );
  return new TextEncoder().encode(value);
}
