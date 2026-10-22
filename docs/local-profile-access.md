# Local profile, login and PIN access

Implemented 22 October 2026. This is a device-local profile, not a remote account,
multi-user database or replacement for the Vault master password.

## User flow

1. Single-screen welcome → Get started → local signup.
2. Signup collects full name, nickname, PIN and password. The nickname is the
   login username: 3–32 ASCII letters, digits, dots, underscores or hyphens,
   matched without case. Full name allows 1–80 characters. No email, social
   login, fake terms checkbox or external authentication is included.
3. Passwords require at least 12 characters and at most 900 UTF-8 bytes. PINs
   contain 6–12 digits. Signup creates the profile once and remembers sign-in,
   then requests PIN verification before exposing Home.
4. Opening/restarting/backgrounding the app requires the PIN again, not repeated
   username/password entry. Foreground PIN inactivity locking is now optional:
   Lock PIN while idle defaults to Off. When enabled, it uses the existing
   inactivity timeout. Ordinary navigation and idle locking do not sign out.
5. Privacy and Security offers Lock now and Sign out. Sign out preserves records
   and keys. Username/password login then requires the PIN before opening Home.
6. A forgotten PIN can be changed after a successful password login. The
   password authorization is memory-only, lasts at most two minutes and expires
   when the app locks or backgrounds. The new PIN must then be entered to unlock.

Existing installations with no profile will be asked to create one without
changing their module records. The dashboard greets the user by nickname.

Welcome, signup, login and PIN entry now have no scroll containers. The account
frame uses viewport-aware logo sizing, reduced spacing and inline field labels
for compact layouts. While typing, decorative headers, footer and optional hints
yield to inputs and actions; Done typing dismisses the keyboard, as does the
primary submit action. Font scaling is still enabled. No credential, key or
session behavior changes are included in this layout adjustment.

Actual HONOR fit/keyboard behavior has not been physically verified because
device testing remains paused. Extreme system font sizes, very small windows
and unusually tall keyboards may exceed a fixed non-scrolling layout; universal
fit is not claimed and no global font-scaling restriction was introduced.

## Storage and cryptography

- `features/account/model` owns runtime validation and public types;
  `services` owns protected persistence/verification; `providers` owns session,
  background lifecycle and the modal gate; `components`/`hooks` own the forms.
- One versioned record lives in the new, separate
  `maivelle.local-account.v1` SecureStore namespace. Android protects this using
  Keystore-backed SecureStore storage. It is never stored in SQLite, backup
  exports, AsyncStorage or persistent UI state. Names and remembered sign-in
  metadata are part of that protected record.
- The password and PIN are not stored. Each has an independent random 32-byte
  salt and AES-GCM verifier envelope with a unique native random nonce. Keys
  are derived through the existing native background scrypt adapter with its
  unchanged N=131072, r=8, p=1, dkLen=32 policy. No synchronous JavaScript KDF,
  native dispatcher edit, reduced work factor or insecure fallback was added.
- Version 1 fixes that exact KDF policy; the policy, record identity, name,
  nickname, purpose and salt are authenticated as associated data. Inputs are
  domain separated from Vault inputs and between password/PIN operations.
  Verifiers encrypt only a public proof string; they are not Vault keys.
- Derived keys and temporary byte buffers are cleared best effort. Passwords
  and PINs only enter transient form/service memory, are cleared from form state
  on completion/background, and are never logged. JavaScript strings and OS
  keyboard buffers cannot be guaranteed erased.
- Authentication operations are serialized. Attempts are reserved in protected
  storage before KDF execution, survive process restart, and add exponential
  delays from the fifth attempt (30 seconds, capped at 30 minutes). This uses
  device wall time and is not hardware-backed rate limiting. A compromised or
  rooted device is outside the access gate's assurance.
- Only remembered sign-in persists. Actual PIN-unlocked authorization never
  persists. Background locking (and optional inactivity locking) invalidates in-flight authorization
  and locks the Vault without replacing its keys. The existing optional Android
  device-authentication lock remains an additional independent boundary.
- Root navigation stays mounted under an opaque native modal, with hidden
  content noninteractive/inaccessible while locked. Account/PIN forms acquire
  the existing screenshot-protection lease before showing credential fields.

`localProfileCreated` is a nonsecret boolean in existing `app_settings`. A
protected record missing while this marker exists fails closed, rather than
silently allowing signup over the current data. A setup interrupted between
protected-record and marker persistence can retry loading and repair the marker;
it does not recreate verifiers or discard data. No schema migration was required.

## Recovery and limitations

This gates access to the app. It does not encrypt the development SQLite database,
provision production SQLCipher keys or authorize Vault decryption. The existing
production storage release gate remains.

The device profile/session/verifiers are not portable backup material. On another
device, create its local profile before restoring a supported application backup;
Vault recovery still uses the existing independent portable material and master
password. Restoring module data on this device does not replace this profile.
The SQLite marker can be present in backups; without the protected record it
blocks access and does not prove a password identity. Keystore loss/missing or
corrupt protected records have no automatic reset/bypass path in this change.
Do not clear application data as recovery. No forgotten-password reset or
profile-removal feature is implemented; signed-out users need their password.

Full-cost PIN verification can take several seconds; a busy state is shown and
work stays in the existing native background dispatcher. This new flow has not
been independently security-reviewed or physically verified. Do not use real
sensitive data during the development security gate.

## Verification scope

Lint and TypeScript checks are the only verification for this development task.
Both passed: zero lint warnings and successful application/tooling type checks.
Automated suites, native/physical HONOR tests, permission prompts, builds, installations
and destructive operations remain paused. Signup/login/PIN success and failure,
cooldowns, restart/background behavior, keyboard layout, screenshot protection,
forgotten-PIN replacement, storage interruption and backup/profile interactions
still require execution when testing resumes. Existing native KDF evidence
applies to the underlying unchanged adapter, not to the unexecuted new UI flow.

References: [Expo SDK 58 SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/),
[Expo SDK 58 Crypto](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/).
