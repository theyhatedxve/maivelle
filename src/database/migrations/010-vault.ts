export const vaultSchema: import('../types.ts').Migration = {
  version: 10,
  name: 'authenticated-vault-envelopes',
  sql: `
    CREATE TABLE vault_metadata (
      slot INTEGER PRIMARY KEY NOT NULL CHECK(slot=1),
      id TEXT NOT NULL UNIQUE,
      revision INTEGER NOT NULL CHECK(revision>0),
      header TEXT NOT NULL CHECK(json_valid(header)),
      wrapped_key TEXT NOT NULL CHECK(json_valid(wrapped_key)),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL CHECK(updated_at>=created_at)
    );
    CREATE TABLE vault_items (
      id TEXT PRIMARY KEY NOT NULL,
      vault_id TEXT NOT NULL REFERENCES vault_metadata(id) ON DELETE RESTRICT,
      revision INTEGER NOT NULL CHECK(revision>0),
      nonce TEXT NOT NULL CHECK(length(nonce)=24),
      envelope TEXT NOT NULL CHECK(json_valid(envelope)),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL CHECK(updated_at>=created_at),
      UNIQUE(vault_id,nonce)
    );
    CREATE INDEX vault_items_vault ON vault_items(vault_id,id);
    CREATE TABLE vault_settings (
      vault_id TEXT PRIMARY KEY NOT NULL REFERENCES vault_metadata(id) ON DELETE RESTRICT,
      inactivity_seconds INTEGER NOT NULL DEFAULT 60 CHECK(inactivity_seconds IN (60,300))
    );
  `,
};
