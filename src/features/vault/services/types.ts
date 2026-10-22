export type Envelope = {
  v: 1;
  nonce: string;
  tag: string;
  data: string;
};
export type Header = {
  format: 1;
  id: string;
  revision: number;
  salt: string;
  kdf: 'scrypt';
  N: 131072;
  r: 8;
  p: 1;
  dkLen: 32;
  createdAt: string;
  updatedAt: string;
};
export type Metadata = {
  id: string;
  revision: number;
  header: Header;
  wrapped: Envelope;
  createdAt: string;
  updatedAt: string;
};
export type ItemRow = {
  id: string;
  vaultId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  envelope: Envelope;
};
export type Credential = {
  accountName: string;
  username: string;
  email: string;
  password: string;
  website: string;
  notes: string;
  category: string;
  favorite: boolean;
};
export type CredentialItem = Credential & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type VaultCrypto = {
  random: (size: number) => Promise<Uint8Array>;
  derive: (password: Uint8Array, salt: Uint8Array) => Promise<Uint8Array>;
  seal: (key: Uint8Array, clear: Uint8Array, aad: Uint8Array) => Promise<Envelope>;
  open: (key: Uint8Array, envelope: Envelope, aad: Uint8Array) => Promise<Uint8Array>;
};
export type BiometricStore = {
  available: () => Promise<boolean>;
  has: () => Promise<boolean>;
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  remove: () => Promise<void>;
};

export {};
