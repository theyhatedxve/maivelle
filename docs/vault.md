# Password Vault — Phase 11

This is a development implementation for fictional records. It is not independently reviewed or approved for production credentials. The existing application database remains an unkeyed synthetic database, and production startup still fails with `ENCRYPTION_REQUIRED`. Vault fields are separately encrypted before SQLite receives them. Compiling SQLCipher alone does not encrypt the main database.

## Key lifecycle

Setup generates a 32-byte random data-encryption key (DEK) and a separate 32-byte salt using Expo Crypto's native `getRandomBytesAsync`. A master password must contain at least 12 Unicode code points and no more than 1024 UTF-8 bytes. Spaces and case are preserved; there is no hidden normalization or truncation.

The verified Android adapter remains unchanged for key derivation: Bouncy Castle 1.86 scrypt with `N=131072,r=8,p=1,dkLen=32`, on `Dispatchers.Default`, serialized by its existing mutex. The wrapping key encrypts the random DEK using Expo Crypto AES-256-GCM. Every encryption explicitly requests a fresh native 12-byte nonce and a 16-byte authentication tag. No JavaScript crypto fallback is used in the Android app.

Only the salt, fixed KDF identifiers, version, timestamps, wrapper revision, nonce, tag and wrapped ciphertext are persisted. Master passwords and unwrapped keys are never written to SQLite, AsyncStorage or UI persistence. Canonical array-based associated data binds the wrapper to its purpose, Vault ID, revision, salt, work factors and timestamps. Unsupported policies fail before deriving a key.

Changing the master password authenticates the current wrapper, derives a new wrapping key with a new salt, and atomically replaces the wrapper around the same DEK. Credential ciphertext and creation dates remain unchanged. The biometric shortcut is removed before the wrapper commits. If that removal fails, the password change stops. If the database commit subsequently fails, the old password remains valid but the biometric shortcut may be unavailable. A successful password change locks the Vault.

There is no password-reset service, recovery question or administrator key. Wrong passwords and corrupted data never trigger a database reset.

## Schema and repositories

Migration **10**, `010-vault.js`, adds:

- `vault_metadata`: one Vault slot, stable opaque ID, wrapper revision, fixed-policy header and encrypted DEK envelope.
- `vault_items`: opaque IDs, parent Vault reference, revision, authenticated timestamps, nonce and encrypted credential envelope.
- `vault_settings`: nonsensitive inactivity preference, limited to 60 or 300 seconds.

Migrations 1–9 remain intact. The existing transactional migration ledger verifies exact historical SQL and prevents reapplication. The migration creates no Vault or key automatically.

All account name, username, email, password, website, notes, category and favorite fields are encrypted together. IDs, item counts, timestamps, revisions and ciphertext lengths remain observable in SQLite. Item associated data binds ciphertext to the Vault/item IDs, revision and timestamps. Changing those values without re-encrypting fails authentication. Live item nonces have a per-Vault uniqueness constraint; native random nonces also have the usual probabilistic collision bound. This is not a formal guarantee of no collision across deleted historical records.

`vaultRepository` accepts ciphertext only and binds every stored value. Multi-row setup/recovery and wrapper changes use exclusive transactions. Explicit parent/revision checks and `foreign_key_check` account for Expo's temporary transaction handles. Creation dates remain stable; edits use optimistic revisions to reject stale forms. There is no plaintext SQL search or credential index.

## Session and interface

`VaultProvider` owns one service per initialized database. Its public state contains only readiness, configured/locked/busy flags and a generation counter. The DEK stays in the service closure; decrypted credential lists/forms stay only in mounted components. Search occurs locally while unlocked. Library results expose account summaries rather than passwords; details load one credential. The library uses FlatList and has a 500-item bound to make full local decryption predictable.

The Vault locks on process restart, leaving its navigation stack, app background/inactive events and inactivity. A lock clears the owned DEK bytes, increments the generation and unmounts the secret navigator/forms. Late derivations/decryptions cannot publish an unlocked session or return plaintext to a new generation. Overlapping service operations, setup and derivations are rejected; the native mutex independently bounds KDF memory concurrency. UI touches and field edits refresh the monotonic activity clock.

Before any master-password or credential form renders, the Vault layout awaits Android screen-capture protection. Failure blocks forms. Password fields are masked by default, with explicit reveal and copy controls. Screen protection also hides the Android recents snapshot while active. The exact window behavior and biometric prompts must still be verified on each supported device/OS.

## Password generation and clipboard

The generator supports 16–128 characters and selected lower/upper/digit/symbol groups. Byte rejection sampling avoids modulo bias. Rejection of candidates missing a selected group keeps the accepted distribution uniform over the required-group set. No weak PRNG or hardcoded password is used.

Password copying is an explicit action through the local Android module. The clip has Android's sensitive-content flag and an opaque owner marker. Cleanup after 30 seconds and on lock only clears a clip still carrying that marker. It does not read another application's clipboard payload. Cleanup is best effort: Android restrictions, process termination, clipboard history, keyboards and other applications can retain data. The implementation does not promise guaranteed expiry or complete deletion outside Maivelle.

## Optional biometric shortcut

Enabling requires an already master-unlocked session and strong enrolled biometrics. A standalone LocalAuthentication success prompt does not unlock credentials. SecureStore stores the device shortcut under an isolated keychain service with `requireAuthentication:true`; Android Keystore and the biometric CryptoObject gate access to the protected key material. A separate nonsensitive marker is only a UI preference, never authorization.

The protected value binds the DEK to the Vault ID, wrapper revision and exact persisted wrapper metadata. Cancellation, unavailable/weak hardware, lockout, key invalidation, mismatched metadata and enrollment changes fail closed. Master-password unlock remains available. The shortcut is device-local and excluded from exports. StrongBox/hardware-backed attestation and enrollment-invalidation behavior are not claimed without device evidence.

## Portable encrypted backup and recovery

Export requires an unlocked Vault and a separate password subject to the same password/work-factor policy. A fresh salt, derived backup key and AES-GCM envelope authenticate the complete manifest: Vault metadata, encrypted items and DEK. The DEK exists only inside that authenticated encrypted outer envelope. Domain-separated associated data distinguishes portable backups from master wrappers and credentials. The app writes only ciphertext through Android's local folder chooser.

Recovery validates the file size (32 MiB maximum), exact version/KDF policy and envelope before expensive derivation. It authenticates the entire backup, validates item count/IDs/nonces and decrypts every item before any database write. Recovery creates a new Vault identity and wrapper under the chosen new master password, and re-encrypts authenticated items with fresh nonces. The import commits atomically. Any invalid item aborts the whole operation.

Recovery is available **only when no Vault exists**. It never deletes, merges or replaces an existing Vault. Use a fresh installation/device for recovery testing; do not uninstall or clear an existing application's data as a development workaround. Opening Android file selection locks the Vault; only an encrypted recovery-file buffer may survive that transition in memory. The selected file must be local and report a bounded size. No cloud service or network API is used.

Losing the master password and all usable backups/passwords can permanently lose access. Biometrics are not portable recovery. Old backups still retain their old export password and historical/deleted credentials after a master-password change or deletion.

## Limits and review work

JavaScript strings, React/development tooling, native key objects, bridge copies, keyboards and garbage collection prevent a promise of complete memory zeroization. Owned byte arrays are overwritten where possible; no secrets are intentionally logged. AES-GCM integrity does not prevent a privileged attacker from deleting records or replaying an entire old database/backup; there is no external trusted monotonic counter. Sensitive record fields are encrypted, but metadata/count/length leakage remains.

Production database key provisioning/recovery, dependency advisory assessment, independent review of the envelope protocol/native binding, release-build hardening and supported-device biometric/screenshot/clipboard checks remain prerequisites for a production-security claim. Keep real credentials out of this build.

## Files and validation

Routes: `src/app/vault/{_layout,index,new,[id],security}.js`. Components and pure services live under `src/features/vault`; SQL lives in `src/database/repositories/vaultRepository.js`. Native crypto, biometric and clipboard adapters live in `src/services/security`. The KDF dispatcher/work factors from the prior investigation are preserved.

Run `npm run test:vault`, `npm run test:database`, `npm run lint`, `npm run typecheck`, `npm run check:dependencies` and `npm run doctor`. Development `/vault-diagnostics` runs the service against native SQLite and verified native cryptography on isolated fictional databases; it never resets the application database. `/vault-security-check` retains the separate primitive checks. Changes to DocumentPicker or the local Android clipboard adapter require a local rebuild/replacement install.

See [Phase 11 Vault verification](phase-11-vault-verification.md) for executed results and manual follow-ups. Earlier crypto-gate reports are historical records, not the current implementation status.
