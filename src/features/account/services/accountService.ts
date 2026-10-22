import { envelope, fromHex, toHex } from '../../vault/services/vaultFormat.ts';
import type { Envelope, VaultCrypto } from '../../vault/services/types.ts';
import { profileInput, validatePassword, validatePin } from '../model/accountInput.ts';
import type { Profile, SignUpInput } from '../model/accountInput.ts';

type Verifier = { salt: string; sealed: Envelope };
type AccountRecord = {
  version: 1;
  id: string;
  profile: Profile;
  password: Verifier;
  pin: Verifier;
  signedIn: boolean;
  failures: number;
  blockedUntil: number;
};
type AccountState = {
  ready: boolean;
  profile: Profile | null;
  signedIn: boolean;
  unlocked: boolean;
  canChangePin: boolean;
  busy: boolean;
  error: string;
  epoch: number;
};
type Dependencies = {
  store: { read: () => Promise<string | null>; write: (value: string) => Promise<void> };
  crypto: VaultCrypto;
  initialProfileCreated: boolean;
  markProfileCreated: () => Promise<void>;
};

const encoder = new TextEncoder();
const proof = 'Maivelle/local-access/verifier/v1';
const kdf = { algorithm: 'scrypt', N: 131072, r: 8, p: 1, dkLen: 32 } as const;

/** Single local profile; persistent sign-in is distinct from in-memory PIN authorization. */
export function createAccountService({
  store,
  crypto,
  initialProfileCreated,
  markProfileCreated: saveProfileMarker,
}: Dependencies) {
  let record: AccountRecord | null = null;
  let profileMarker = initialProfileCreated;
  const hasProfileMarker = () => profileMarker;
  async function markProfileCreated() {
    await saveProfileMarker();
    profileMarker = true;
  }
  let state: AccountState = {
    ready: false,
    profile: null,
    signedIn: false,
    unlocked: false,
    canChangePin: false,
    busy: false,
    error: '',
    epoch: 0,
  };
  let pending = false;
  let generation = 0;
  let foreground = true;
  let passwordAuthorizationUntil = 0;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<AccountState>) => {
    state = { ...state, ...patch };
    listeners.forEach((notify) => notify());
  };

  async function persist(next: AccountRecord) {
    await store.write(JSON.stringify(next));
    record = next;
  }
  function current() {
    if (!record) throw new Error('Create your local profile first.');
    return record;
  }
  function assertActive(token: number) {
    if (!foreground || token !== generation)
      throw new Error('Maivelle was locked. Please try again while the app is visible.');
  }
  async function exclusive<T>(work: (token: number) => Promise<T>): Promise<T> {
    if (pending) throw new Error('Please wait for the current security operation.');
    pending = true;
    publish({ busy: true });
    const token = generation;
    try {
      return await work(token);
    } finally {
      pending = false;
      publish({ busy: false });
    }
  }
  const associatedData = (
    row: Pick<AccountRecord, 'id' | 'profile'>,
    kind: 'password' | 'pin',
    salt: string,
  ) =>
    encoder.encode(
      JSON.stringify([
        'Maivelle/LocalAccess',
        1,
        row.id,
        row.profile.name,
        row.profile.nickname,
        kind,
        salt,
        kdf,
      ]),
    );

  async function withKey<T>(
    secret: string,
    salt: string,
    kind: 'password' | 'pin',
    work: (key: Uint8Array) => Promise<T>,
  ) {
    // Domain separation also lets the short PIN use the unchanged native KDF input policy.
    const input = encoder.encode(`Maivelle/LocalAccess/${kind}/v1\0${secret}`);
    let key: Uint8Array | undefined;
    const saltBytes = fromHex(salt, 32);
    try {
      key = await crypto.derive(input, saltBytes);
      return await work(key);
    } finally {
      input.fill(0);
      saltBytes.fill(0);
      key?.fill(0);
    }
  }
  async function makeVerifier(
    secret: string,
    kind: 'password' | 'pin',
    row: Pick<AccountRecord, 'id' | 'profile'>,
  ): Promise<Verifier> {
    const salt = toHex(await crypto.random(32));
    const clear = encoder.encode(proof);
    try {
      const sealed = await withKey(secret, salt, kind, (key) =>
        crypto.seal(key, clear, associatedData(row, kind, salt)),
      );
      return { salt, sealed };
    } finally {
      clear.fill(0);
    }
  }
  async function verify(secret: string, kind: 'password' | 'pin', row: AccountRecord) {
    const verifier = row[kind];
    await withKey(secret, verifier.salt, kind, async (key) => {
      const clear = await crypto.open(
        key,
        verifier.sealed,
        associatedData(row, kind, verifier.salt),
      );
      try {
        if (new TextDecoder().decode(clear) !== proof) throw new Error('Invalid access proof.');
      } finally {
        clear.fill(0);
      }
    });
  }
  async function reserveAttempt(row: AccountRecord) {
    if (Date.now() < row.blockedUntil) {
      const seconds = Math.ceil((row.blockedUntil - Date.now()) / 1000);
      throw new Error(`Too many attempts. Try again in ${seconds} seconds.`);
    }
    const failures = Math.min(row.failures + 1, 30);
    // Reserve before deriving so a process restart does not erase failed attempts.
    const delay = failures >= 5 ? Math.min(30 * 60_000, 30_000 * 2 ** (failures - 5)) : 0;
    await persist({ ...row, failures, blockedUntil: Date.now() + delay });
  }
  function parse(raw: string): AccountRecord {
    if (raw.length > 6000) throw new Error('Invalid local profile size.');
    const value = JSON.parse(raw) as AccountRecord;
    if (
      !value ||
      value.version !== 1 ||
      typeof value.signedIn !== 'boolean' ||
      !Number.isSafeInteger(value.failures) ||
      value.failures < 0 ||
      value.failures > 30 ||
      !Number.isSafeInteger(value.blockedUntil) ||
      value.blockedUntil < 0
    )
      throw new Error('Unsupported local profile metadata.');
    fromHex(value.id, 16);
    const normalized = profileInput(value.profile.name, value.profile.nickname);
    if (normalized.name !== value.profile.name || normalized.nickname !== value.profile.nickname)
      throw new Error('Invalid profile metadata.');
    for (const kind of ['password', 'pin'] as const) {
      fromHex(value[kind].salt, 32);
      envelope(value[kind].sealed, 256);
    }
    return value;
  }

  return {
    syncProfileMarker(value: boolean) {
      if (value) profileMarker = true;
    },
    subscribe(notify: () => void) {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    getState: () => state,
    async refresh() {
      if (pending) return;
      return exclusive(async () => {
        try {
          const raw = await store.read();
          if (!raw && hasProfileMarker())
            throw new Error(
              'The protected local profile is missing. Access stays locked; no data was reset.',
            );
          record = raw ? parse(raw) : null;
          if (record && !hasProfileMarker()) await markProfileCreated();
          publish({
            ready: true,
            profile: record?.profile ?? null,
            signedIn: record?.signedIn ?? false,
            unlocked: false,
            canChangePin: false,
            error: '',
          });
        } catch {
          publish({
            ready: false,
            error:
              'Protected profile could not load. Access is blocked. Retry without clearing application data.',
          });
        }
      });
    },
    async setup(input: SignUpInput) {
      return exclusive(async (token) => {
        if (!state.ready || record || hasProfileMarker())
          throw new Error('A profile already exists or storage is unavailable. Sign in instead.');
        // Resolve an uncertain previous write before ever attempting another setup.
        const existing = await store.read();
        if (existing) {
          record = parse(existing);
          await markProfileCreated();
          publish({ profile: record.profile, signedIn: record.signedIn, unlocked: false });
          throw new Error(
            'Your local profile is already saved. Continue with sign-in or PIN unlock.',
          );
        }
        const profile = profileInput(input.name, input.nickname);
        validatePassword(input.password);
        validatePin(input.pin);
        const identity = { id: toHex(await crypto.random(16)), profile };
        const password = await makeVerifier(input.password, 'password', identity);
        assertActive(token);
        const pin = await makeVerifier(input.pin, 'pin', identity);
        assertActive(token);
        await persist({
          version: 1,
          ...identity,
          password,
          pin,
          signedIn: true,
          failures: 0,
          blockedUntil: 0,
        });
        try {
          await markProfileCreated();
        } catch {
          publish({
            ready: false,
            error:
              'Your profile was saved, but its local marker could not be saved. Retry protected profile loading; no data was reset.',
          });
          throw new Error(
            'Profile setup needs protected-storage recovery. Please retry profile loading.',
          );
        }
        publish({ profile, signedIn: true, unlocked: false, canChangePin: false });
      });
    },
    async signIn(username: string, password: string) {
      return exclusive(async (token) => {
        const row = current();
        validatePassword(password);
        await reserveAttempt(row);
        // Always derive, even for a mismatching username.
        try {
          await verify(password, 'password', row);
        } catch {
          throw new Error(
            'Username or password is incorrect, or the protected profile is damaged.',
          );
        }
        if (username.trim().toLowerCase() !== row.profile.nickname.toLowerCase())
          throw new Error('Username or password is incorrect.');
        assertActive(token);
        await persist({ ...current(), signedIn: true, failures: 0, blockedUntil: 0 });
        assertActive(token);
        passwordAuthorizationUntil = performance.now() + 120_000;
        publish({ signedIn: true, unlocked: false, canChangePin: true });
      });
    },
    async unlock(pin: string) {
      return exclusive(async (token) => {
        const row = current();
        if (!row.signedIn) throw new Error('Sign in with your username and password first.');
        validatePin(pin);
        await reserveAttempt(row);
        try {
          await verify(pin, 'pin', row);
        } catch {
          throw new Error('PIN is incorrect, or the protected profile is damaged.');
        }
        assertActive(token);
        await persist({ ...current(), failures: 0, blockedUntil: 0 });
        assertActive(token);
        publish({ unlocked: true, canChangePin: false });
      });
    },
    async changePin(pin: string) {
      return exclusive(async (token) => {
        if (!state.canChangePin || performance.now() > passwordAuthorizationUntil) {
          publish({ canChangePin: false });
          throw new Error('Sign in with your password before changing the PIN.');
        }
        validatePin(pin);
        const row = current();
        const verifier = await makeVerifier(pin, 'pin', row);
        assertActive(token);
        await persist({ ...row, pin: verifier, failures: 0, blockedUntil: 0 });
        publish({ unlocked: false, canChangePin: false, epoch: state.epoch + 1 });
      });
    },
    async signOut() {
      return exclusive(async () => {
        generation += 1;
        publish({ unlocked: false, canChangePin: false, epoch: state.epoch + 1 });
        await persist({ ...current(), signedIn: false });
        publish({ signedIn: false });
      });
    },
    lock() {
      generation += 1;
      publish({ unlocked: false, canChangePin: false, epoch: state.epoch + 1 });
    },
    setForeground(active: boolean) {
      foreground = active;
      if (!active) {
        generation += 1;
        publish({ unlocked: false, canChangePin: false, epoch: state.epoch + 1 });
      }
    },
  };
}
