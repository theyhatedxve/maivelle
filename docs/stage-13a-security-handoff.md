# Stage 13A storage integration and security handoff

This is an internal implementation handoff, not independent security approval. No live conversion, production key provisioning, data reset, uninstall or Vault-key replacement is authorized by this document. Stage 13B and Phase 14 are outside this work.

**Decision: Stage 13A NOT READY for production activation.** Implemented integration passed 210 host tests, nine physical native suites, ten new disposable integration assertions plus cleanup, eight SQLCipher checks, native crypto/KDF responsiveness, lint/JS, Expo Doctor 20/20, compatibility and Android JavaScript export. Unresolved compatibility, operator-recovery, protected UI and review/fault gates are documented below and in [current QA results](phase-13-test-results.md). This is not a production-security claim.

## Integrated ownership and activation

`connection.js` lazily builds `createStorageSelection`. It reads the production journal under the existing native lease before opening application storage. A valid active selection routes `getDatabase()` to the keyed owner. A pending first installation, damaged journal, orphan encrypted file, unavailable key or decryption failure blocks access. None of these failures invokes provisioning or a plaintext fallback. A missing journal does not authorize a production empty database: production startup returns `ENCRYPTION_REQUIRED`; existing development installations retain the legacy connection/control journal. No production journal or device key was created by this continuation.

`DatabaseProvider` uses the same selected handle for all repositories. Its confirmed restore handler pauses registered Vault/timer/reminder consumers, retires and drains the service handle, activates the verified encrypted candidate or uses the existing legacy cutover, then rebuilds services/providers. Replacement errors now propagate to the calling form instead of being swallowed. Device biometric shortcuts are removed after successful selection, not before a failed restore. Provider remount restarts the existing reminder reconciliation. The disposable integration check tests the shared selector/owner/service path; it does not mount the entire React provider in encrypted mode or claim a live conversion.

Every keyed opener applies its protected key before querying SQLite. The exclusive-writer factory is registered before initialization, so initialization cannot install an unkeyed writer. An encrypted-named handle without a protected writer factory is rejected. Existing FK/WAL/transaction and schema-1-through-10 migration policies remain; migration history has not changed.

## Key lifecycle and Keystore boundary

The verified native random source generates a separate 256-bit SQLCipher key for each generation. A versioned SecureStore record binds it to the database name and cipher policy. Publication/read-back precedes SQLite opening. Android SecureStore protects the record using Android Keystore-backed material; it is not portable, not a StrongBox assertion, and does not require per-access biometrics. App authentication and Vault authorization remain separate. Existing Bouncy Castle 1.86 background scrypt and work factors are unchanged.

Keys are never written into the journal, portable archives, logs, AsyncStorage or persistent UI state. JavaScript strings, native/bridge copies and a compromised unlocked process cannot be guaranteed to be zeroized or protected by file encryption. Owned byte buffers are cleared where supported. Uninstall/device loss/Keystore loss can destroy database access. A Vault password alone cannot reconstruct a SQLCipher key.

## Provisioning and recovery state machine

| Durable state | Ordinary startup | Explicit recovery |
| --- | --- | --- |
| No production journal and no encrypted artifacts | Legacy development selection or production provisioning gate | `provision` only after the adapter's new-install guard rejects all existing Maivelle databases |
| Existing plaintext installation | Preserve current development storage; production migration gate | Separately approved non-destructive migration; never infer approval from a missing journal |
| Active keyed generation | Open with existing protected record, file, ledger and integrity checks | No rekey/create fallback on errors |
| First intent, no active generation | Block with `PROVISIONING_INCOMPLETE` | `resumeFirst(verify)` reuses the already recorded protected key, finishes initialization transactionally, reopens and checks intended content before publication |
| First intent with unavailable/invalid key | Block | No automatic retry with a new key. Retain artifacts; reviewed portable recovery/new-generation procedure is still required |
| Active plus pending replacement | Keep active; never promote pending on restart | Reverify in-session or explicitly abandon pending selection while retaining its file/key |
| Journal missing but encrypted files present | Block even in development | Investigate/recover the journal; no implicit legacy fallback |

`resumeFirst` is an operator API, not an automatic startup effect or an end-user repair screen. Its verifier must establish the intended first-install content. Checking only an empty schema is insufficient when provisioning originally imported a recovery source. It can create the missing first-intent file using its **existing** key; it must never be called for an active missing database. A missing protected key cannot be repaired this way.

Restore preview uses `stage`, leaving active selection unchanged. `activate` requires the exact candidate verified in the current owner session and explicit UI confirmation/device authentication. Owner close/restart invalidates that capability. Failed/canceled staging is retained, not deleted. Journal v1 remains readable; v2 adds a bounded retained-generation list. Previous recovery generations remain indexed across repeated replacements. At 64 retained generations, further retirement is a maintenance/review gate; no automatic deletion is permitted. The native journal remains bounded to 8192 bytes. Atomic publication acknowledgement failure requires reopening/inspection; callers must not report success or erase either generation.

Older v1-only owner implementations cannot read a v2 journal and must fail closed. Application downgrade compatibility therefore needs explicit review before activation; never remove retained history or rewrite a journal to make an older binary open it.

Unknown/orphan diagnostic generations also trigger the fail-closed startup guard. A process-death diagnostic must retain its scoped recovery checkpoint and clean only its own artifacts before normal startup can be assumed. Do not delete arbitrary encrypted files to bypass this guard. A reviewed recovery entry point independent of unavailable application storage is still needed for operator repair on an otherwise blocked installation.

## Portable backup and restore

Normal Settings resolves its backup service from the same selected owner. Encrypted mode uses bounded, authenticated logical format 2; it does not call SQLite backup into an unkeyed file. The existing Settings passphrase/preview/REPLACE/confirmation/device-authentication forms are reused. Complete file authentication precedes staging intent; restore authenticates again while importing, verifies constraints/schema and original Vault master authorization, closes/reopens the candidate, and only then exposes preview. Cancellation keeps live data unchanged and retains the canceled generation/key. Storage estimates are conservative admission checks, not guarantees against later ENOSPC.

The recorded full-cost scrypt policy derives archive keys from a dedicated backup passphrase and random salt. Unique AES-GCM nonces, associated metadata, record sequence and footer authentication remain unchanged. Archives contain module records, original migration ledger, encrypted Vault envelopes and portable password-wrapped Vault key material. They contain no device SQLCipher/Keystore keys or decrypted Vault credentials. Destination recovery generates a different database key. Vault content still needs its original master password; device biometric/app-lock authorization is not transferred. Derived notification IDs are excluded and reconciled after replacement.

**Compatibility boundary:** legacy installations continue to create/read existing format-1 encrypted SQLite snapshots. Selected encrypted installations create/read format-2 logical archives. Previous format-2 archives remain readable. Cross-format conversion is explicitly unsupported in the new encrypted service; it fails validation without modifying active data. Do not decrypt a legacy snapshot into a plaintext production staging file to hide this limitation. A reviewed legacy-backup conversion/recovery path is required before broad activation. Neither existing backup files nor their passphrases were changed.

The new native integration test uses private-file callbacks instead of Android's human picker; it verifies the actual selected backup service, streaming/read-back, preview/cancel/confirm primitives and exact recovery. Earlier physical picker/confirmation checks remain historical evidence for the unchanged forms and legacy service. Full protected encrypted-mode React UI/SAF confirmation, process death during the new staging/first-recovery flow, and true second-device recovery are not claimed by that test.

## Live migration proposal — separate approval required

1. Obtain independent review of the exact source/native binary, key lifecycle, storage selector, recovery entry point and archive compatibility policy. Verify a usable encrypted archive and original Vault master authorization. Establish capacity and an interruption plan.
2. Explicitly authorize a one-time copy of the currently selected plaintext database into a new independently keyed generation. Pause/drain all consumers; use a dedicated consistent source snapshot/transaction. Preserve original file, WAL as required, journal and all Vault envelopes.
3. Apply approved migrations only to staging. Compare supported records, exact ledger, balances, FK/integrity, Vault unlock and recovered notification intent. Close/reopen keyed staging and verify again. Publish production selection only after explicit authorization and verification; reopen services and reconcile reminders.
4. On failed validation, keep the original selected and every recovery artifact. On interrupted publication, inspect the durable journal rather than creating an empty database. Retire plaintext sources/snapshots only under a **separate** reviewed, approved policy; flash secure erasure cannot be promised.

No step above was executed on live storage. Production rollout remains blocked by independent review, legacy-backup portability, operator recovery and unexecuted fault/release coverage.

## Threat model, remaining evidence and limitations

At-rest protection targets offline file extraction without the device-protected key. It does not defeat root, injected code in an unlocked authorized process, compromised OS/keyboard, memory acquisition, coerced authentication, supply-chain compromise or users choosing a cloud document provider manually. Historical plaintext copies and old backups retain their original exposure and passwords.

The handoff must include source diff and hashes, unchanged package/native crypto/migration fingerprints, exact debug APK identity, complete host/native outputs, archive bounds and compatibility decisions, and a reviewed threat model. An independent reviewer must inspect native lease lifetime/AtomicFile/fsync, SecureStore failure behavior and key binding, every opener/writer, activation ambiguity, generation-retention limits, import allowlists, authorization boundaries and unsafe repair shortcuts.

Host fault injection is not actual flash failure or power loss. Remaining tests include kill during active initialization/migration/native key or journal publication; genuine invalidated/locked Keystore; actual ENOSPC/I/O; maximum-sized archives; encrypted-mode protected UI/SAF and second-device recovery; blocked-storage recovery UI; cross-process lease contention. The 26 documented npm findings remain, and dependency remediation has not been approved.

Official references consulted: [Expo SDK 58 SQLite/SQLCipher](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/), [SecureStore and backup/key-loss limits](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [bounded FileSystem handles](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/). These document API behavior, not a security certification for Maivelle.

## Files inspected and changed

Inspected: AGENTS, package/config/lock, architecture and Phase 13 QA/release/security reports, dependency baseline, all direct SQLite open sites, initialization/migration/transaction/repository contracts, provider lifecycle, native storage lease/journal, protected-key adapter, native KDF/AES gate, both backup formats/readers/import paths, Settings forms, notification reconciliation and existing fixture tests.

| Changed files | Purpose |
| --- | --- |
| `src/database/connection.js`, new `storageSelection.js` | Shared lazy selector, keyed opening and fail-closed legacy/first-install policy |
| `src/database/DatabaseProvider.js` | Selected-owner confirmed activation, consumer drain, failure propagation and post-selection biometric shortcut invalidation |
| `src/database/encryptedConnection.js`, `transactions.js` | Explicit first-intent same-key recovery; register keyed writers before initialization; reject encrypted writer fallback |
| `src/database/productionOwner.js` | Staging/confirmation capability, explicit first recovery, journal-v2 bounded retained history and cancellation without deletion |
| `src/database/productionStorage.native.js` | Update runtime ownership comment only; existing native/SecureStore/key behavior unchanged |
| `src/database/productionRecovery.js` | Verified encrypted staging and module/Vault preview |
| `src/features/settings/backupService.native.js`, new `encryptedBackupService.native.js` | Selected-owner facade plus bounded format-2 encrypted backup/restore service; keep legacy format-1 path |
| `src/features/settings/components/BackupSettings.js` | Explain content limit and cross-format review boundary; existing confirmation/authentication retained |
| New `src/database/testing/nativeStage13AChecks.js`, `src/app/storage-security-check.js` | Explicit development-only disposable integration diagnostic |
| `tests/database/production-owner.test.cjs`, `encrypted-connection.test.cjs`, new `storage-selection.test.cjs`, `encrypted-writers.test.cjs` | Seventeen added regression cases |
| `docs/phase-13-test-results.md`, `phase-13-known-issues.md`, `release-readiness.md` | Current results, precise unexecuted coverage and NOT READY determination |
| `docs/architecture.md`, `production-database-encryption.md`, `phase-13-production-security-review.md`, new `stage-13a-security-handoff.md` | Current architecture and security/migration review handoff; preserve historical evidence |

Local ignored `.expo/stage13a-*` scripts, snapshots, diagnostic outputs and Android JavaScript export hold reproducible working evidence. They are not a release artifact. No package/lock, native implementation, app identity, migration definition or unrelated feature source changed during this stage.
