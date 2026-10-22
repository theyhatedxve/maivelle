# Phase 12 verification — 20 October 2026

Phase 12 implements Settings, privacy controls and bounded encrypted SQLite backup/staged recovery. See [the format, recovery model and exact HONOR instructions](settings-backup-recovery.md). No Phase 13 work is included. Existing Expo dependencies, Reanimated and native crypto/KDF implementations are preserved; `package.json` and `package-lock.json` hashes match the dependency-review baseline. No overrides, install-script approvals, force audit fixes, cloud services, real credentials, live-data reset or app uninstall were used.

## Implementation map

| Area | Files created or changed |
| --- | --- |
| Preferences | New `src/features/settings/preferences.js`, `SettingsProvider.js`, `src/database/repositories/settingsRepository.js`; uses existing versioned `app_settings` keys without a new main schema migration |
| App access/privacy | New `appLockService.js`, `deviceAuthentication.native.js`, `AppSecurityGate.js`; integrates existing Vault locking/capture protection without granting Vault keys |
| Backup/recovery | New `backupFormat.js`, `backupValidation.js`, `backupFiles.native.js`, `backupService.native.js` under `src/features/settings`; `src/database/storageControl.js`, `cutover.js`, `maintenance.js` |
| Connection lifecycle | `src/database/connection.js`, `DatabaseProvider.js`: guarded generations, pause/drain, transactional pointer selection, closure/reopening and retained recovery generation |
| Routes/UI | Replace placeholder `src/app/settings.js` with `src/app/settings/{_layout,index,appearance,security,notifications,backup,storage,about}.js`; components under `src/features/settings/components` |
| Appearance | New `src/theme/ThemeProvider.js`, dark tokens in `colors.js`; shared UI, layouts, tabs and existing module style consumers converted to palette hooks so they react without navigator replacement. No module business rules or branding assets changed |
| Reminder integration | Existing `MedicineNotificationsProvider.js`, `localNotifications.js`: preference-aware presentation/reconciliation and maintenance pause/drain. Medicine schedules/history are retained |
| Diagnostics/tests | New development-only `src/app/settings-diagnostics.js`, `src/features/settings/nativeSettingsChecks.js`, `tests/settings/phase12.test.cjs` |
| Documentation | This report, `settings-backup-recovery.md`, architecture/database/development guide updates |

Migrations 1–10 are unchanged. The separate storage journal contains only validated internal database filenames and pending state. It does not duplicate app preferences, store keys, or bypass production encryption gating. Settings routes remain thin; SQL is outside presentation components.

## Executed host checks

- **9/9 Settings tests passed:** preference validation/disk persistence, full-cost chunked AEAD round trip, wrong password/ciphertext/tag/nonce/header/order/footer/trailing-content rejection, size/KDF/schema/free-space rejection before derivation, consistent SQLite snapshot preservation, original-master Vault recovery, migration idempotency/schema mismatch rejection, cutover rollback/startup journal recovery, guarded late-write rejection, app-lock generation/inactivity/overlap checks, reminder preference/permission record preservation/reconciliation, and replacement cancellation/dismissal decisions. A test-only subsequent migration is applied twice and preserves prior Note/Vault records; no production migration was added.
- **137/137 database/module tests passed.**
- **14/14 Vault tests passed.**
- Lint and strict JavaScript/JSDoc checks passed. Production Android JavaScript export succeeded. There are **160 host tests** in total.
- Expo dependency compatibility reports dependencies up to date; **Expo Doctor 20/20 passed**.

The host cryptographic backend is independent Node/OpenSSL with the full fixed scrypt cost; it is not included in the Android adapter or used as an app fallback. Insufficient-storage tests simulate the preflight branch rather than filling the phone.

## Physical HONOR evidence

The existing native development build runs the changed JavaScript through USB Metro on port 8087. All used native modules were already installed in Phase 11; no native rebuild is needed for these source-only changes. Android is HONOR VKJ_NX9, API 37. Ignored `.expo/phase12-*` files store local summaries/build-independent diagnostic output.

- The isolated native Settings suite passed **14 checks**: preference restart persistence; encrypted output inspection; incorrect backup password and incorrect Vault master rejection; live-record preservation after failed staging; staged snapshot restoration and repeated migrations; device authorization not transferred; original-master encrypted Vault recovery; notification ID exclusion; failed-cutover old-data reopening; rollback preservation of post-snapshot changes; interrupted pointer startup recovery; finalized recovery-generation retention; actual connection closure/reopening against staged records.
- Physical Light and Dark selections immediately updated the preview; System selection worked. The theme changed without replacing the navigator. Further system-theme/device checks are recorded below.
- The user completed Android authentication for app-lock enablement/unlock. The Vault still required its own master password afterward. Cold restart showed the persisted app-lock gate.
- An initial inactivity observation failed, and explicit locking revealed an unreliable presentation when the root navigator was removed. The implementation was changed to retain navigation beneath a non-dismissible opaque modal and explicitly clear Vault authorization. Automated inspection and the user confirmed the corrected lock modal is visible. Failed observations were not counted as successful checks.
- With the corrected modal, cold restart, untouched inactivity beyond 70 seconds, Android Back rejection and Home/background/return locking passed. The user authenticated and restored App lock to Off afterward.
- Native file testing found SQLite absolute paths needed normalization to `file://` for SDK 58 FileSystem. Temporary-file cleanup was corrected to check existence and preserve original errors. The native snapshot/restore suite passed after those fixes. No user database was replaced to debug these failures.
- All **nine native suites passed with airplane mode on and Wi-Fi off**: database/Notes, Tasks, Calendar, Medicine, Time Tracker, Finance, Budget, Vault and Settings. Original connectivity was restored to airplane Off/Wi-Fi On. These are local USB development-build checks, not a standalone release-APK claim.
- Real Android folder selection/export completed and saved-document read-back authentication passed. The user selected the resulting whole-app archive; staging verified it, including original-master Vault recovery, and showed a replacement preview.
- Notifications, Storage Information and About routes passed physical checks. Android reported notification permission allowed; the original Medicine reminders On preference remained. The original Finance balance of PHP 2,580.00 was visible after recovery. Light/Dark preview and System selection were tested; changing Android's own theme while System is selected remains a manual follow-up.

## Unexpected replacement during the cancellation test

The automated interaction intended to tap Cancel instead resulted in a completed restore and provider remount. The post-cancellation preview assertion failed; subsequent inspection showed the explicit restore-completed notice and the active storage journal pointing at the staged generation. This is **not counted as a passing cancellation test**. There is insufficient interaction trace to attribute it to a wrong coordinate, timing or another input; no authentication bypass is claimed. The production path requires Android authentication and its success result, but the precise interaction sequence was not captured.

The old database had not been overwritten. Maivelle was force-stopped, the nonsensitive pointer journal was copied for investigation, and its validated active/previous selection was changed back to the original `maivelle-phase3-synthetic.db`. Both database generations were retained. Relaunch, original App lock Off, Medicine reminders On and the recorded Finance balance were verified. No application database was deleted, reset or overwritten during recovery.

Replacement now additionally requires typing **REPLACE**, bound to the exact staged generation and cleared on background locking and confirmation. The native decision dialog is shared through `replacementConfirmation.js`; Cancel and dismissal resolve false before authentication/storage work. A development-only harmless dialog check on the HONOR identified Android's Cancel button by resource ID and passed without authentication/storage action; Android Back dismissal also passed. Host tests cover Cancel, dismissal, explicit approval and late duplicate callbacks. This reduces accidental confirmation risk; the original failed interaction remains an unresolved test-trace limitation. Repeat the complete revised flow on a fresh isolated installation before release.

Successful cutover revoked the optional device biometric Vault shortcut as designed. The original wrapped Vault data key and master-password recovery remain; re-enable the optional shortcut from Vault Security after master-password unlock if desired. It was not silently recreated during technical rollback.

## Security and recovery boundaries

Full-app backup format 1 authenticates all header fields, fixed full-cost KDF policy, ordered 128 KiB chunks and a completion footer. Maximum source database is 64 MiB; the parser bounds reads and line sizes and rejects unsupported schema/format/cost values. No complete database is loaded into JS memory. The snapshot contains encrypted Vault payloads and its wrapped DEK; no unwrapped Vault key or Android Keystore key is exported. The backup passphrase and original Vault master password are both needed for Vault-bearing restores.

Staging validates authentication, known schema SQL/migration ledger, SQLite/FK integrity, settings and actual Vault unlock before preview/confirmation. Replacement requires device reauthentication, retires/drains old consumers, preserves the prior database and uses a pending pointer journal. Failed/interrupted cutover selects the old generation; failure never triggers a data reset. Device app-lock authorization is not portable and is disabled in staging. The optional biometric shortcut is revoked at cutover; wrapped keys and both database generations remain recoverable by the original master passwords. New providers rebuild derived module views and Medicine notification requests subject to permissions.

The main development database and private staging/recovery copies remain unkeyed; encrypted archives/Vault fields do not resolve production database key management. Production `ENCRYPTION_REQUIRED`, SQLCipher configuration and Android backup-disable settings are retained. Complete memory erasure, filesystem durability against all hardware failures, anti-rollback against a privileged attacker, and independent protocol/native certification are not claimed. Use fictional data only.

## Manual follow-ups and limits

Use the exact steps in [Settings backup/recovery](settings-backup-recovery.md#physical-honor-verification-instructions). Real folder export, document selection and preview were exercised. On a fresh isolated environment, repeat the revised typed-confirmation/cancellation/provider-remount journey, verify module records and permissions, then test a saved external archive with the original Vault master. Normal replacement/rollback tests use separate fictional databases; the unexpected application-level replacement and recovery are disclosed above. The previous generation is retained for technical recovery, not advertised as a portable backup or one-tap undo.

Additional coverage still needed includes physical biometric/device-credential cancellation/lockout/enrollment changes, actual disk-full I/O failure, OEM capture/recents behavior and standalone release APK behavior without Metro. Prior Vault clipboard and production-security review limitations continue to apply. No new npm dependency issues were introduced; the documented **26 findings** remain the baseline, primarily assessed as tooling exposure rather than a blanket security clearance.

Final state: Home is visible, Vault is locked, App lock is Off, System appearance and Medicine reminders On are preserved, and original connectivity is restored. The active journal was read back and confirms the original database with no pending cutover; the restored generation is retained. Final lint, JavaScript checks, all 160 host tests, Expo Doctor 20/20, dependency compatibility and Android JavaScript export passed. Dependency manifest/lock hashes match the review baseline. `git diff --check` passed; Git emitted its existing Windows LF/CRLF conversion notices. No native rebuild was required or performed for Phase 12.
