# Production database encryption candidate — 21 October 2026

This implements the provisioning/recovery candidate authorized in the Phase 13 continuation. It is **not selected by the live application**. `connection.js` still blocks production with `ENCRYPTION_REQUIRED`. No existing database, Vault key, migration or live storage pointer was converted/replaced. The implementation is reviewable code, not a production-security certification.

## Device key and ownership

**Stage 13A update:** the selector/provider and selected format-2 Settings backup service are now integrated, with explicit first-intent recovery and retained-candidate cancellation. No production selection, live key creation or conversion was performed. Descriptions elsewhere in this document saying the candidate is disconnected are historical. See the [current integration/recovery/security handoff](stage-13a-security-handoff.md) and [QA results](phase-13-test-results.md) for exact behavior and remaining gaps.

`productionStorage.native.js` adapts the existing SQLCipher factory to SDK 58 SecureStore. Each generation receives 32 independent native-random bytes. The protected record binds the generation name, record version and `sqlcipher4-raw256-v1` policy. SecureStore writes are read back before SQLite opening; the installed Android implementation uses synchronous SharedPreferences `commit()` for the encrypted item. Its wrapping key is Android Keystore-backed. This is device-bound protection without per-access biometric authentication, allowing ordinary modules/background access independently of Vault authorization. It is not a StrongBox guarantee.

`modules/maivelle-storage` is a separate local Expo module with no external dependencies and no changes to `maivelle-crypto`. Its native file lease rejects competing runtimes/processes. The lease is retained for the owner's entire lifetime, including short-lived keyed writers and dedicated snapshot handles. The nonsensitive journal lives in Android's no-backup directory. AtomicFile publication syncs the file; the containing directory is explicitly fsynced after publication. App backup remains disabled. Never unlink an ownership lock file while it can be held.

`productionOwner.js` separates explicit provisioning from opening. It journals intent before publishing a key, migrates and verifies a freshly keyed generation, closes/reopens it, verifies again, then atomically publishes active selection. Opening requires a valid journal and existing key/file/ledger. Missing, damaged or wrong keys never trigger new-key creation, an empty replacement, a reset, or a fallback to plaintext.

`replace` creates a new keyed file. The old generation remains active until authenticated import, constraints, page authentication, integrity and Vault verification all succeed, including reopened verification. Publication records the old generation as previous. An unfinished candidate remains pending; restart continues to select the unchanged active generation. A failed first provisioning has no active generation and blocks access for explicit recovery. No candidate/key is automatically deleted or promoted after an interruption.

All keyed handles apply their key before schema queries/PRAGMAs/migrations; exclusive writers use the existing injected opener before foreign keys and BEGIN. SQLCipher compatibility is explicitly 4, memory security is enabled, synchronous mode FULL is requested, and native cipher status/page HMAC/SQLite integrity/FK checks must succeed. The installed driver reports `cipher_status` as TEXT `"1"`; either INTEGER 1 or TEXT `"1"` is accepted. Other values fail closed. A device probe caught the initial overly strict INTEGER-only check; it was corrected from observed evidence.

## Portable format 2

`portableArchive.js` is separate from the existing format-1 Settings backup UI. Format 2 uses `maivelle-offline-backup`, `logical-records`, schema 10, a random archive ID and 32-byte salt, and the **unchanged native background scrypt N=131072/r=8/p=1/32-byte policy**. AES-256-GCM seals each record with its own random 12-byte nonce and 16-byte tag. Every header field and the frame index are authenticated as canonical associated data. Nonce reuse inside an archive is rejected. An authenticated footer records the exact number and byte total; missing/reordered/appended/spliced/tampered frames fail validation.

Limits are 512 KiB per clear frame, 64 MiB of logical record bytes and 100,000 records. These are application safety limits, not a claim of release-scale performance. Production file callbacks must enforce the line bound exported by the format and an overall archive limit; the current format-1 file reader has a smaller limit and must not be silently reused for format 2. The device probe uses a deliberately small in-memory ciphertext archive, not a large-database allocation pattern.

`portableRecords.js` exports one row at a time from a **dedicated** consistent read transaction. The reviewed allowlist covers all module tables, app settings, Vault envelopes/settings and the exact migration ledger, including original applied timestamps. Device-derived `medicine_notification_jobs` are excluded. Schema/column metadata is validated against the freshly initialized destination; SQL received from an archive is never executed. Inserts are parameterized. Import requires empty staging tables and runs transactionally with deferred FK enforcement; incomplete authentication rolls the import back. Unsupported tables/columns/ledger/record order/values fail validation. Numbers that cannot round-trip exactly through JavaScript are refused.

`productionRecovery.js` coordinates export/read-back authentication and recovery into a newly keyed generation. Vault payloads remain encrypted under their original Vault data key; the original Vault master password must verify before selection. App lock is reset only in the explicitly restored staging copy: authorization on another device is not transferable. Notification identifiers must be rebuilt after selection. The candidate test uses the real reconciler with a recording adapter; it does not claim new Android alarm delivery testing.

No SQLCipher key, Android Keystore key, Vault plaintext or master password is included in a portable archive. A lost device key cannot be recovered using the Vault password alone. Recovery needs an intact archive and backup passphrase; access to Vault content additionally needs its original master password. Without the device key or a usable archive, application records may be unrecoverable. There is no reset/backdoor or secure-flash-erasure promise.

## Review and live conversion boundary

The new owner/recovery API is deliberately **not wired into DatabaseProvider, the live connection selector or the current format-1 Settings forms**. First-install provisioning refuses existing Maivelle database files rather than treating a missing production journal as an empty installation. The legacy owner and all existing keys remain unchanged.

Before enabling it, review and implement the coordinated app-owner handoff and format-2 file/UI adapter: pause/drain all consumers and writers, authenticate/verify a recovery archive, copy the selected unkeyed source into a new keyed generation, compare exact supported records/ledger/balances and Vault authorization, then publish selection with rollback/restart rules. Keep the untouched source, its journal and verified archive. Do not use SQLCipher `rekey`, overwrite the original, rewrite migration history, uninstall or clear data. Retirement of plaintext copies is a different approved operation.

**Separate explicit approval remains necessary for the actual live conversion/selection and creation of live production key material.** This work has only created independently owned disposable test keys/databases. A release also needs independent security review, actual process-death/power-loss/storage-failure testing across publication boundaries, release-scale bounded-stream profiling and the consumer/file/UI handoff. Host fault injection and same-process competing-owner tests are not proof of cross-process kill/power-loss behavior. Pending-candidate recovery is intentionally fail-closed; an operator recovery UI/protocol has not been certified.

JavaScript strings, bridge/native copies and provider allocations cannot all be reliably zeroized. Owned key/password byte arrays are cleared where supported. An unlocked compromised device can still access ordinary app data through authorized code. These limits remain even with an encrypted file.

## Sources

- [Expo SDK 58 SQLite and SQLCipher](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#sqlcipher)
- [Expo SDK 58 SecureStore and key-loss/backup limits](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/)
- [Expo native module API](https://docs.expo.dev/modules/module-api/)
- [Android AtomicFile](https://developer.android.com/reference/android/util/AtomicFile) and [FileLock](https://developer.android.com/reference/java/nio/channels/FileLock)
- [SQLCipher API: raw keys, cipher status and page integrity](https://www.zetetic.net/sqlcipher/sqlcipher-api/)
- [Earlier provisioning proposal](database-encryption-provisioning.md)

## Verification update - 21 October 2026

**Host:** 191 tests passed across database (162), Vault (14), Settings (9), and integration (6). Lint and JavaScript type-check passed. `npx.cmd expo export --platform android` succeeded, producing a 6.2 MB Hermes bundle. The source-level production encryption changes do not alter package files or live storage.

**Device:** The previously built local debug candidate was installed in-place without uninstall/data clear (prior checkpoint). The latest production probe additions (schema-1 fixture conversion, staged schema preservation, and bounded backup-file read/read-back) remain unverified because ADB currently fails before device discovery while resolving `\\.android` (`adb_utils.cpp: Cannot mkdir ... Permission denied`). An earlier probe revision passed 13 disposable-device assertions; it must not be represented as covering these additions.

**Unchanged boundary:** live database access remains guarded by `ENCRYPTION_REQUIRED`. No live database key was created, selected, or migrated; no user data, Vault keys, or migration history was changed. Production enablement, live generation cutover, and retirement of any unencrypted generation require explicit approval. Expo Doctor and SDK dependency compatibility were attempted but could not reach the required npm/Expo endpoints (`EACCES`); the installed package tree remains unchanged.


## Current physical verification - 21 October 2026

The current candidate passed 15 physical assertions plus cleanup after the capacity-error fix; three actual process-death checkpoints and explicit lost-test-key portable recovery also passed. Final host count is 193. SDK ADB/Doctor/network EACCES limitations in the prior checkpoint were execution restrictions or transport conflicts; host-access Doctor is now 20/20 and SDK dependencies are compatible. scrcpy's competing server was closed by the user. All nine native suites and native crypto/KDF checks passed on the identified APK.

The candidate remains disconnected from the live provider/format-1 forms. A first-provision pending generation intentionally refuses opening and still needs a reviewed operator recovery workflow. See [the internal review, exact process-kill boundaries, capacity fix, remaining faults and live-approval plan](phase-13-production-security-review.md). No real database or Vault key was changed. Earlier small-memory-only probe descriptions are historical: the current probe also uses the bounded private-file format-2 reader.
