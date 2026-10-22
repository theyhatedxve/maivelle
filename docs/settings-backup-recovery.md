# Settings, privacy and recovery — Phase 12

Maivelle's settings and portable backups work locally using the installed Expo SDK 58 dependencies. No dependency upgrades, overrides, script approvals, cloud services or native cryptographic changes are required. See [the dependency baseline](dependency-security-review.md) and [Vault protocol](vault.md). This remains a development build for fictional records: production storage is still blocked by `ENCRYPTION_REQUIRED` until main-database encryption key provisioning and recovery are implemented and independently reviewed.

## Preferences and appearance

The existing `app_settings` table stores versioned `preferences.v1.*` entries; no duplicate preferences table or main-database migration is needed. Existing migrations 1–10 and their exact SQL ledger are preserved. Unknown preference keys are ignored for forward compatibility; invalid known values block startup with a retry state rather than bypassing a configured lock.

Preferences include Light/Dark/System appearance, app lock, app inactivity timeout (60 or 300 seconds), app-wide screenshot protection, Medicine reminders and the explanation before external backup export. Sensitive credentials, keys, raw PINs and master passwords are never preference values. Existing Vault timeout/settings continue to use `vault_settings`; the app-wide timeout is intentionally separate.

The theme provider resolves System through React Native `useColorScheme`. Shared styles are now palette factories consumed by hooks, so colors update without recreating navigators or discarding editors. Light colors retain Maivelle's primary purple and lavender surfaces. The dark palette uses lighter purple text/controls over dark lavender surfaces. Existing component layout, typography, business rules and record behavior are preserved. Brand assets and user-assigned category/project colors are not rewritten.

## App access and Vault authorization

App lock uses Android-owned device authentication (strong biometrics with Android device-credential fallback). There is no app PIN database or stored raw device credential. Enabling/disabling app lock, changing its inactivity timeout, changing app-wide screen protection and confirming database replacement require device reauthentication. The device must have a secure Android lock configured; cancellation and unavailable authentication do not change preferences.

When enabled, app lock starts locked, locks on backgrounding and checks inactivity with a monotonic clock. Pending unlocks carry a generation and cannot reopen an app that was backgrounded during authentication. An opaque, non-dismissible modal covers a mounted root navigator; covered content is hidden from accessibility and cannot receive touches. Removing the root navigator after locking proved unreliable on the tested Android navigation stack, so it remains mounted. Locking explicitly clears the Vault session, whose own gate unmounts credential forms. Device access does not unwrap a Vault key or authorize credential decryption: the existing Vault master-password/secure biometric-key service remains the only Vault authorization path. Android's current device credential controls this convenience access gate; it is not an independent Maivelle password.

Vault screens always retain their own capture protection. Backup passphrase forms also wait for capture protection before rendering. The optional app-wide capture preference blocks app content until its protection lease is ready. Protection leases use the existing serialized native adapter; they do not relax Vault protection. Keyboard buffers, JS strings, native copies and garbage collection still prevent a complete memory-erasure guarantee.

If device authentication becomes unavailable, configure a secure Android lock again. App lock does not provide a hidden bypass or erase data as a recovery shortcut. It also does not encrypt the existing unkeyed development database.

## Notifications

Settings displays Android notification/channel and exact-alarm permission status using the existing Notifications adapter. It exposes the Medicine reminder preference, permission requests and Android App info navigation. Revoking permission or disabling reminders never deletes medicine schedules or dose history. Derived native requests and the `medicine_notification_jobs` ledger may be cancelled/rebuilt by the existing reconciler.

Reminder presentation honors the saved preference in the foreground. Android owns channel sound/importance settings. A bounded reminder window, existing owner markers and existing alarm delivery behavior are retained. Replacement pauses/drains the old reconciler; new providers reconcile restored schedules after connection reopening. If permission is denied, the schedules remain and are rearmed after permission/preference enablement. Settings reports reconciliation failures instead of claiming reminders were armed.

## Portable backup format

Format 1 is an ASCII newline-delimited JSON archive named `Maivelle-Backup-<time>.json`. This is distinct from Phase 11's Vault-only backup format. Only an exact supported header/policy is accepted; a Vault-only backup cannot be mistaken for a whole-app backup.

The header records:

- `format: maivelle-offline-backup`, `version: 1`, random 16-byte ID and UTC creation time;
- source `schema: 11` (schema 10 remains importable), exact snapshot byte length, chunk count and fixed 128 KiB chunk size;
- `kdf: scrypt`, `N: 131072`, `r: 8`, `p: 1`, `dkLen: 32`, fresh random 32-byte salt.

The dedicated user-supplied backup passphrase uses the existing 12-character/1024-UTF-8-byte policy. The verified Bouncy Castle 1.86 scrypt dispatcher derives the key on its background native dispatcher. No lower-cost or JavaScript fallback is introduced. All header values are authenticated as canonical array-based AES-GCM associated data with the domain `Maivelle/OfflineBackup`, format version and exact chunk position. Header bounds/version/KDF checks run before derivation.

Each snapshot chunk is independently AES-256-GCM encrypted with a fresh native random 12-byte nonce and 16-byte tag. A final authenticated empty envelope at position `complete` proves completion. Missing, duplicated, reordered, oversized or trailing chunks fail validation. An in-file nonce set rejects collisions, including the footer. The snapshot is limited to **64 MiB**, the encoded archive to **192 MiB**, and each line is bounded. Nonces are random, not counters reused across files.

Expo SQLite's native backup API creates a transactionally consistent snapshot. The source remains available for normal app use; later edits are not part of that snapshot. The snapshot contains every supported module's tables, preferences, exact migration ledger and Vault wrapped-key/ciphertext records. Device-derived medication notification IDs are removed from the copy. Android Keystore/SecureStore device keys are never exported. In particular, no unwrapped Vault DEK is added to the whole-app archive.

The original Vault master password is therefore still required to verify/unlock its wrapped key after restore. Knowing only the whole-app backup passphrase does not bypass the Vault master password. The Phase 11 Vault-only export has a different recovery design; see [Vault recovery](vault.md).

The encrypted archive is written sequentially through async native file handles. Neither the complete database nor a large plaintext JSON export is loaded into JavaScript. Owned plaintext byte chunks and derived-key/password byte arrays are overwritten after use; strings/native copies have the documented zeroization limits. Temporary snapshot and staging files reside in the app-private SQLite directory and are deleted on ordinary operation failure/completion when no longer needed. They are unkeyed in this development build because the source database is unkeyed; this is not production encryption at rest.

The app authenticates the cached encrypted output, asks for an Android folder grant, copies encrypted bytes to a newly created document, then reopens and authenticates the saved document. A provider that cannot support bounded reads/writes or read-back verification produces an error. An interrupted external write can leave an incomplete document; restore rejects it. The verified cache copy remains available until cache cleanup/Android cache eviction. No background upload or network operation is used.

Choose a local Android folder. Android may expose cloud-provider apps in its chooser; Maivelle cannot control a provider's synchronization. Users may manually move encrypted files to other devices or storage. The UI explains this boundary before export by default; it never silently uploads a backup.

## Restore and recovery journal

1. Select a local document (`content://` or `file://`) with a reported bounded size. Retain only its URI across the external picker, not a decrypted database or password.
2. Validate header/version/cost bounds and free storage. Conservatively require at least four snapshot sizes plus 16 MiB free space for staging and workspace. This is a preflight, not a guarantee against concurrent disk consumption; I/O failures abort safely.
3. Authenticate/decrypt chunks into a unique private staging file. Reject incomplete/footer/trailing-content errors before opening it as a database. The active database is not modified by this step.
4. Compare all application tables, indexes, triggers, views and their SQL with a freshly created known schema. Validate the exact migration ledger, apply the normal reviewed migration runner idempotently, run SQLite integrity and foreign-key checks, and validate preferences. Format 1 currently accepts source schema 10 only; unknown/future schemas are rejected. Adding future compatible schemas requires an explicit reviewed format/migration change, not best-effort guessing.
5. If a Vault exists, require its original master password, authenticate its wrapped key and decrypt/validate every supported credential before accepting staging. Lock/clear the temporary Vault session afterward. Do not transfer app-lock authorization or Keystore shortcuts. App lock is disabled in the staged portable data and must be explicitly re-enabled for the new device.
6. Show record counts and Vault-verification status. Require typing `REPLACE`, then an explicit native confirmation and Android device reauthentication. Cancel/dismiss resolves false before authentication or storage work. Confirmation text is cleared when staging changes or the app locks/backgrounds. There is no automatic merge. See the verification report for an unexpected earlier automated replacement/cancellation interaction and technical recovery; repeat this revised flow in an isolated environment before release.
7. Pause/drain old reminder work, retire the guarded database generation and reject late async repository calls. Close the process-owned connection. Remove the optional device biometric shortcut before switching (failure aborts); wrapped Vault keys and the complete prior database are retained. This removes only a shortcut, not the recoverable key envelope.
8. Use the separate private `maivelle-storage-control.db` journal to select the verified candidate with `pending=1` and the old active filename as `previous`. Open/initialize/check the candidate, then finalize `pending=0`. New repositories/providers mount against that connection and rebuild derived state/reminders. Never overwrite or rename the old live database over another file.

The control database contains only validated internal filenames and transaction state, not user records or secret keys. It is not exported. Initial startup points to the existing `maivelle-phase3-synthetic.db`; introducing the journal does not move or reset it. The production connection gate still runs before opening application storage.

If cutover fails, close the candidate, select/reopen the old generation and retain both files. If the process dies while `pending=1`, startup selects the old generation before opening application data. Death after finalization selects the verified restored generation. A rollback/reopening failure blocks with an explicit error; users must restart/investigate without clearing storage. There is no promise that uninstalling, hardware loss, a full disk, filesystem corruption or OS data deletion is recoverable.

After successful replacement, the previous database remains an app-private technical recovery point; it is not a portable backup or a one-tap undo feature. Storage cleanup never deletes it. Preserve a verified portable archive before replacement. Restoring an old snapshot also restores historical business records: review running timer history, balances, budgets and reminder permissions afterward. Derived notification IDs are regenerated rather than replayed.

## Storage management

Storage Information shows active database size, WAL size, latest retained recovery-generation size, available local space and Maivelle-owned encrypted backup cache size/count. It does not pretend to enumerate external backups from a folder grant. Cache cleanup requires confirmation and only removes `backup-<32 hex>.json` inside Maivelle's own encrypted backup cache directory. It does not clear all Android cache, SQLite files, recovery generations, user-selected documents or keys. No factory-reset action is introduced.

## Physical HONOR verification instructions

Use the existing USB development workflow, the installed native development build and local Metro. No emulator or cloud build is involved. All Phase 12 changes use existing native packages; no native rebuild is required solely for these JavaScript changes. Cold-start after provider/service changes to avoid retained Fast Refresh state.

1. Open Settings. Select Light and Dark, then System. Verify readable purple controls/cards in each module, tabs, editors and keyboard views. Restart and verify the selected preference persists. With System selected, change Android appearance and confirm it follows.
2. Enable app lock and complete Android authentication. Unlock Maivelle; verify Vault still requests its own master password. Leave the app, return and verify app lock. Restart and verify it starts locked. Leave the phone untouched for longer than the selected timeout; authenticate again. Exercise cancellation and unavailable-device authentication without disabling the gate.
3. Review Notifications. Temporarily disable/re-enable Medicine reminders and compare schedule/history records; verify only derived native requests change. Review Android denied/channel/exact-alarm states. Re-enable original settings afterward. Do not create real medication fixtures.
4. In Backup and Restore, use a fictional passphrase (at least 12 characters), choose a local folder and allow access. Confirm saved-document read-back authentication succeeds. Keep the backup passphrase and original Vault master password separately. Never use real credentials in this development build.
5. On an isolated fictional test environment, choose that file. Try a wrong backup passphrase, damaged tag/header/chunk and wrong Vault master password; current records must remain unchanged. Then verify the intact file and review counts. Verify replacement is disabled until `REPLACE` is entered; open the confirmation and cancel once. Verify no authentication/cutover starts and current records remain unchanged. Confirm only after an independently verified recovery archive exists.
6. Exercise replacement/connection reopening on isolated fixtures, never by clearing a live installation. Check Notes, Tasks, Calendar, Medicine history, Timer, Finance, Budget, preferences and Vault under the original master password. Re-provision optional device biometrics; app authentication must not authorize the Vault.
7. Run the development `/settings-diagnostics` suite for isolated native snapshot/Vault/journal/rollback checks. It never replaces the application's database. Existing `/database-diagnostics` and `/vault-diagnostics` cover regressions. Simulated insufficient space/interruption tests avoid filling the phone or killing a live-data restore.
8. Test offline with airplane mode on and Wi-Fi off; USB Metro remains a local development transport. Verify reminder rebuilding with permission granted, then restore the phone's original connectivity. A standalone release APK without Metro still requires separate release verification.

Host commands: `node --test tests/settings/*.test.cjs`, `npm run test:database`, `npm run test:vault`, `npm run lint`, `npm run typecheck`, `npm run check:dependencies`, `npm run doctor`. See [Phase 12 verification](phase-12-verification.md) for actual executed results and remaining manual checks.

## Official references

- Expo SDK 58 [SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/), [Crypto](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/), [FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/), [legacy SAF APIs](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem-legacy/), [DocumentPicker](https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/), [Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) and [Local Authentication](https://docs.expo.dev/versions/v58.0.0/sdk/local-authentication/).
- React Native [Appearance](https://reactnative.dev/docs/appearance) and [AppState](https://reactnative.dev/docs/appstate).
- Installed SDK sources were also checked for async file-handle modes, content-URI support, SQLite path representation and native backup/connection behavior. SDK-compatible packages and Reanimated were not changed.
