import {
  aad,
  credential,
  envelope,
  fromHex,
  header,
  itemAad,
  masterPassword,
  MAX_BACKUP_BYTES,
  MAX_ITEMS,
  toHex,
  validDate,
  validId,
  wrapAad,
} from './vaultFormat.ts';
export type Metadata = import('./types.ts').Metadata;
export type ItemRow = import('./types.ts').ItemRow;
export type CredentialItem = import('./types.ts').CredentialItem;

/** Key and session state never enter persistent UI stores. Dependencies are injected for real-SQLite/independent-crypto tests. */
export function createVaultService(
  repo: ReturnType<
    typeof import('../../../database/repositories/vaultRepository.ts').createVaultRepository
  >,
  crypto: import('./types.ts').VaultCrypto,
  {
    biometrics,
    clock = () => performance.now(),
  }: {
    biometrics?: import('./types.ts').BiometricStore;
    clock?: () => number;
  } = {},
) {
  let key: Uint8Array | null = null;
  let meta: Metadata | null = null;
  let generation = 0;
  let lastActivity = clock();
  let timeout = 60;
  let biometricPrompt = false;
  let dialogDepth = 0;
  const temporarySecrets: Set<Uint8Array> = new Set();

  function track(bytes: Uint8Array) {
    temporarySecrets.add(bytes);
    return bytes;
  }

  function wipe(bytes: Uint8Array | undefined) {
    bytes?.fill(0);
    if (bytes) temporarySecrets.delete(bytes);
  }
  let state = {
    ready: false,
    configured: false,
    locked: true,
    busy: false,
    generation: 0,
  };
  const listeners: Set<() => void> = new Set();
  const publish = () => {
    state = { ...state, generation };
    listeners.forEach((fn) => fn());
  };

  function current(ticket: number) {
    if (ticket !== generation) throw new Error('Vault was locked. Unlock it again.');
  }
  function unlocked() {
    if (!key || !meta || state.locked) throw new Error('Unlock the Vault first.');
    return { key, meta };
  }

  async function exclusive<T>(action: (ticket: number) => Promise<T>) {
    if (state.busy) throw new Error('A Vault operation is already running.');
    state = { ...state, busy: true };
    publish();
    const ticket = generation;
    try {
      return await action(ticket);
    } catch (error) {
      current(ticket);
      throw error;
    } finally {
      state = { ...state, busy: false };
      publish();
    }
  }

  async function wrap(
    dataKey: Uint8Array,
    password: string,
    revision: number,
    id: string,
    createdAt: string,
  ) {
    const bytes = track(masterPassword(password));
    let wrapping: Uint8Array | undefined;
    try {
      const salt = await crypto.random(32);
      const updatedAt = new Date(Math.max(Date.now(), Date.parse(createdAt))).toISOString();
      const h = header({
        format: 1,
        id,
        revision,
        salt: toHex(salt),
        kdf: 'scrypt',
        N: 131072,
        r: 8,
        p: 1,
        dkLen: 32,
        createdAt,
        updatedAt,
      });
      wrapping = track(await crypto.derive(bytes, salt));
      const wrapped = await crypto.seal(wrapping, dataKey, wrapAad(h));
      return { id, revision, header: h, wrapped, createdAt, updatedAt };
    } finally {
      wipe(bytes);
      wipe(wrapping);
    }
  }

  async function unwrap(metadata: Metadata, password: string) {
    const bytes = track(masterPassword(password));
    let wrapping: Uint8Array | undefined;
    try {
      wrapping = track(await crypto.derive(bytes, fromHex(header(metadata.header).salt, 32)));
      const result = track(
        await crypto.open(wrapping, envelope(metadata.wrapped), wrapAad(metadata.header)),
      );
      if (result.length !== 32) {
        wipe(result);
        throw new Error('Invalid wrapped data key.');
      }
      return result;
    } finally {
      wipe(bytes);
      wipe(wrapping);
    }
  }

  async function decrypt(dataKey: Uint8Array, row: ItemRow) {
    validId(row.id);
    validId(row.vaultId);
    validDate(row.createdAt);
    validDate(row.updatedAt);
    if (!Number.isSafeInteger(row.revision) || row.revision < 1 || row.updatedAt < row.createdAt)
      throw new Error('Invalid credential metadata.');
    const clear = await crypto.open(dataKey, envelope(row.envelope), itemAad(row));
    track(clear);
    try {
      return credential(JSON.parse(new TextDecoder().decode(clear)));
    } finally {
      wipe(clear);
    }
  }

  async function encrypt(
    dataKey: Uint8Array,
    row: Omit<ItemRow, 'envelope'>,
    value: import('./types.ts').Credential,
  ) {
    const clear = new TextEncoder().encode(JSON.stringify(credential(value)));
    track(clear);
    try {
      return {
        ...row,
        envelope: await crypto.seal(dataKey, clear, itemAad(row)),
      };
    } finally {
      wipe(clear);
    }
  }
  const service = {
    getState: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    async refresh() {
      meta = await repo.metadata();
      state = { ...state, ready: true, configured: !!meta };
      publish();
    },
    lock() {
      generation++;
      dialogDepth = 0;
      temporarySecrets.forEach((bytes) => bytes.fill(0));
      temporarySecrets.clear();
      key?.fill(0);
      key = null;
      state = { ...state, locked: true };
      publish();
    },
    touch() {
      lastActivity = clock();
    },
    checkInactivity() {
      if (!state.locked && clock() - lastActivity >= timeout * 1000) service.lock();
    },
    isBiometricPrompt: () => biometricPrompt || dialogDepth > 0,
    beginConfirmation() {
      const ticket = generation;
      dialogDepth++;
      let done = false;
      return () => {
        if (!done) {
          done = true;
          dialogDepth = Math.max(0, dialogDepth - 1);
        }
        return ticket === generation && !state.locked;
      };
    },

    async setup(password: string) {
      return exclusive(async (ticket) => {
        masterPassword(password).fill(0);
        if (await repo.metadata()) throw new Error('A Vault already exists. Unlock it instead.');
        const dataKey = track(await crypto.random(32));
        try {
          const id = toHex(await crypto.random(16));
          const now = new Date().toISOString();
          const next = await wrap(dataKey, password, 1, id, now);
          current(ticket);
          await repo.setup(next);
          meta = next;
          state = { ...state, configured: true, ready: true };
          current(ticket);
          key = dataKey.slice();
          state = { ...state, locked: false };
          lastActivity = clock();
          publish();
        } finally {
          wipe(dataKey);
        }
      });
    },

    async unlock(password: string) {
      return exclusive(async (ticket) => {
        const saved = await repo.metadata();
        if (!saved) throw new Error('Set up the Vault first.');
        const dataKey = await unwrap(saved, password);
        try {
          current(ticket);
          timeout = await repo.timeout(saved.id);
          current(ticket);
          key?.fill(0);
          key = dataKey.slice();
          meta = saved;
          state = { ...state, locked: false, configured: true, ready: true };
          lastActivity = clock();
          publish();
        } finally {
          wipe(dataKey);
        }
      });
    },

    async changePassword(oldPassword: string, nextPassword: string) {
      return exclusive(async (ticket) => {
        const session = unlocked();
        masterPassword(nextPassword).fill(0);
        const proven = await unwrap(session.meta, oldPassword);
        try {
          current(ticket);
          let difference = 0;
          for (let i = 0; i < 32; i++) difference |= proven[i] ^ session.key[i];
          if (difference) throw new Error('Vault key mismatch.');
          const next = await wrap(
            proven,
            nextPassword,
            session.meta.revision + 1,
            session.meta.id,
            session.meta.createdAt,
          );
          current(ticket);
          // Invalidate device shortcut before committing a new master wrapper.
          if (biometrics) await biometrics.remove();
          current(ticket);
          await repo.rewrap(session.meta, next);
          meta = next;
          service.lock();
        } finally {
          wipe(proven);
        }
      });
    },

    async list(query: string = '', favoritesOnly: boolean = false) {
      return exclusive(async (ticket) => {
        const session = unlocked();
        const rows = await repo.items(session.meta);
        const output = [];
        const needle = query.toLocaleLowerCase();
        for (const row of rows) {
          current(ticket);
          const value = await decrypt(session.key, row);
          current(ticket);
          if (
            (!favoritesOnly || value.favorite) &&
            [value.accountName, value.username, value.email, value.category].some((part) =>
              part.toLocaleLowerCase().includes(needle),
            )
          )
            output.push({
              id: row.id,
              revision: row.revision,
              accountName: value.accountName,
              username: value.username,
              email: value.email,
              category: value.category,
              favorite: value.favorite,
            });
        }
        return output.sort(
          (a, b) =>
            Number(b.favorite) - Number(a.favorite) ||
            a.accountName.localeCompare(b.accountName) ||
            a.id.localeCompare(b.id),
        );
      });
    },

    async get(id: string): Promise<CredentialItem | null> {
      return exclusive(async (ticket) => {
        const session = unlocked();
        const row = (await repo.items(session.meta)).find((item) => item.id === validId(id));
        if (!row) return null;
        const value = await decrypt(session.key, row);
        current(ticket);
        return {
          ...value,
          id: row.id,
          revision: row.revision,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      });
    },

    async save(
      input: import('./types.ts').Credential,
      previous: {
        id: string;
        revision: number;
      } | null = null,
    ) {
      return exclusive(async (ticket) => {
        const value = credential(input);
        const session = unlocked();
        const rows = await repo.items(session.meta);
        const old = previous ? rows.find((item) => item.id === previous.id) : null;
        if (previous && (!old || old.revision !== previous.revision))
          throw new Error('Credential changed or was removed. Reload before saving.');
        if (old) await decrypt(session.key, old);
        const now = new Date(
          Math.max(Date.now(), old ? Date.parse(old.updatedAt) : 0),
        ).toISOString();
        const row = await encrypt(
          session.key,
          {
            id: old?.id ?? toHex(await crypto.random(16)),
            vaultId: session.meta.id,
            revision: (old?.revision ?? 0) + 1,
            createdAt: old?.createdAt ?? now,
            updatedAt: now,
          },
          value,
        );
        current(ticket);
        await repo.save(session.meta, row, old?.revision ?? null);
        current(ticket);
        return row.id;
      });
    },

    async remove(id: string, revision: number) {
      return exclusive(async (ticket) => {
        const session = unlocked();
        const row = (await repo.items(session.meta)).find((item) => item.id === validId(id));
        if (!row || row.revision !== revision)
          throw new Error('Credential changed or was removed.');
        await decrypt(session.key, row);
        current(ticket);
        await repo.remove(session.meta, id, revision);
        current(ticket);
      });
    },

    async setTimeout(seconds: number) {
      const session = unlocked();
      await repo.setTimeout(session.meta.id, seconds);
      timeout = seconds;
      service.touch();
    },
    async biometricAvailable() {
      return !!biometrics && (await biometrics.available());
    },
    async biometricEnabled() {
      return !!biometrics && (await biometrics.has());
    },
    async enableBiometrics() {
      return exclusive(async (ticket) => {
        const session = unlocked();
        if (!biometrics || !(await biometrics.available()))
          throw new Error('Strong enrolled biometrics are unavailable. Use the master password.');
        current(ticket);
        biometricPrompt = true;
        try {
          await biometrics.write(
            JSON.stringify({
              id: session.meta.id,
              revision: session.meta.revision,
              binding: JSON.stringify(session.meta),
              key: toHex(session.key),
            }),
          );
          current(ticket);
        } catch {
          await biometrics.remove();
          throw new Error('Biometric setup did not complete. Unlock with your master password.');
        } finally {
          biometricPrompt = false;
        }
      });
    },
    async disableBiometrics() {
      if (biometrics) await biometrics.remove();
    },
    async unlockBiometrics() {
      return exclusive(async (ticket) => {
        if (!state.locked) throw new Error('Vault is already unlocked.');
        if (!biometrics || !(await biometrics.available()))
          throw new Error('Strong biometrics are unavailable. Use your master password.');
        const saved = await repo.metadata();
        if (!saved) throw new Error('Set up the Vault first.');
        biometricPrompt = true;
        try {
          const raw = await biometrics.read();
          current(ticket);
          if (!raw) throw new Error('Biometric key unavailable.');
          const value = JSON.parse(raw);
          if (
            value.id !== saved.id ||
            value.revision !== saved.revision ||
            value.binding !== JSON.stringify(saved)
          )
            throw new Error('Biometric key is stale.');
          const dataKey = track(fromHex(value.key, 32));
          value.key = '';
          try {
            current(ticket);
            timeout = await repo.timeout(saved.id);
            current(ticket);
            meta = saved;
            key = dataKey.slice();
            state = { ...state, locked: false, ready: true, configured: true };
            lastActivity = clock();
            publish();
          } finally {
            wipe(dataKey);
          }
        } catch {
          key?.fill(0);
          key = null;
          state = { ...state, locked: true };
          publish();
          throw new Error(
            'Biometric unlock did not complete or the key was invalidated. Use your master password.',
          );
        } finally {
          biometricPrompt = false;
        }
      });
    },

    async generatePassword(
      length: number = 24,
      groups: string[] = ['lower', 'upper', 'digits', 'symbols'],
    ) {
      const ticket = generation;
      unlocked();
      const sets = {
        lower: 'abcdefghijklmnopqrstuvwxyz',
        upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        digits: '0123456789',
        symbols: '!@#$%^&*()-_=+[]{}:,.?',
      };
      if (
        !Number.isInteger(length) ||
        length < 16 ||
        length > 128 ||
        !groups.length ||
        new Set(groups).size !== groups.length ||
        groups.some((g) => !Object.hasOwn(sets, g))
      )
        throw new Error('Choose 16–128 characters and at least one character group.');
      const selected = groups.map((g) => sets[g as keyof typeof sets]);
      const alphabet = selected.join('');
      // Rejection sampling for bytes and for required groups keeps the accepted distribution unbiased.
      for (let attempt = 0; attempt < 1024; attempt++) {
        let password = '';
        while (password.length < length) {
          const bytes = await crypto.random(256);
          try {
            current(ticket);
            for (const byte of bytes)
              if (byte < 256 - (256 % alphabet.length) && password.length < length)
                password += alphabet[byte % alphabet.length];
          } finally {
            bytes.fill(0);
          }
        }
        if (selected.every((chars) => Array.from(password).some((char) => chars.includes(char)))) {
          current(ticket);
          return password;
        }
      }
      throw new Error('Password generation failed. Try again.');
    },

    async exportBackup(password: string) {
      return exclusive(async (ticket) => {
        const session = unlocked();
        masterPassword(password).fill(0);
        const items = await repo.items(session.meta);
        for (const row of items) {
          await decrypt(session.key, row);
          current(ticket);
        }
        const now = new Date().toISOString();
        const h = header({
          format: 1,
          id: toHex(await crypto.random(16)),
          revision: 1,
          salt: toHex(await crypto.random(32)),
          kdf: 'scrypt',
          N: 131072,
          r: 8,
          p: 1,
          dkLen: 32,
          createdAt: now,
          updatedAt: now,
        });
        const clear = new TextEncoder().encode(
          JSON.stringify({
            format: 1,
            metadata: session.meta,
            items,
            dek: toHex(session.key),
          }),
        );
        track(clear);
        const bytes = track(masterPassword(password));
        let derived;
        try {
          derived = track(await crypto.derive(bytes, fromHex(h.salt, 32)));
          current(ticket);
          const sealed = await crypto.seal(
            derived,
            clear,
            aad(['portable-backup', ...JSON.parse(new TextDecoder().decode(wrapAad(h)))]),
          );
          current(ticket);
          const output = JSON.stringify({
            format: 'maivelle-vault-backup',
            header: h,
            envelope: sealed,
          });
          if (output.length > MAX_BACKUP_BYTES)
            throw new Error('Encrypted backup exceeds the size limit.');
          return output;
        } finally {
          wipe(clear);
          wipe(bytes);
          wipe(derived);
        }
      });
    },
    /** Empty-Vault restore only: never replaces or clears an existing Vault. */
    async restoreBackup(text: string, backupPassword: string, newMaster: string) {
      return exclusive(async (ticket) => {
        if (await repo.metadata())
          throw new Error(
            'Restore requires an empty Vault. Existing credentials will never be overwritten.',
          );
        masterPassword(newMaster).fill(0);
        if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES)
          throw new Error('Backup is too large.');
        const file = JSON.parse(text);
        if (
          file.format !== 'maivelle-vault-backup' ||
          Object.keys(file).sort().join(',') !== 'envelope,format,header'
        )
          throw new Error('Unsupported Vault backup.');
        const h = header(file.header);
        envelope(file.envelope, MAX_BACKUP_BYTES);
        const bytes = track(masterPassword(backupPassword));
        let derived;
        let clear;
        try {
          derived = track(await crypto.derive(bytes, fromHex(h.salt, 32)));
          current(ticket);
          clear = await crypto.open(
            derived,
            file.envelope,
            aad(['portable-backup', ...JSON.parse(new TextDecoder().decode(wrapAad(h)))]),
          );
          track(clear);
          current(ticket);
          const data = JSON.parse(new TextDecoder().decode(clear));
          if (
            data.format !== 1 ||
            !Array.isArray(data.items) ||
            data.items.length > MAX_ITEMS ||
            Object.keys(data).sort().join(',') !== 'dek,format,items,metadata'
          )
            throw new Error('Invalid backup manifest.');
          const oldHeader = header(data.metadata?.header);
          envelope(data.metadata.wrapped);
          const dataKey = track(fromHex(data.dek, 32));
          data.dek = '';
          try {
            const now = new Date().toISOString();
            const next = await wrap(dataKey, newMaster, 1, toHex(await crypto.random(16)), now);
            current(ticket);
            const ids = new Set();
            const nonces = new Set();
            const restored: ItemRow[] = [];
            for (const item of data.items) {
              if (
                item.vaultId !== oldHeader.id ||
                ids.has(item.id) ||
                nonces.has(item.envelope?.nonce)
              )
                throw new Error('Invalid or duplicated backup item.');
              ids.add(item.id);
              nonces.add(item.envelope.nonce);
              const value = await decrypt(dataKey, item);
              current(ticket);
              restored.push(
                await encrypt(
                  dataKey,
                  {
                    id: item.id,
                    vaultId: next.id,
                    revision: 1,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                  },
                  value,
                ),
              );
              current(ticket);
            }
            await repo.setup(next, restored);
            meta = next;
            state = { ...state, configured: true, ready: true };
            service.lock();
          } finally {
            wipe(dataKey);
          }
        } finally {
          wipe(bytes);
          wipe(derived);
          wipe(clear);
        }
      });
    },
  };
  return service;
}
