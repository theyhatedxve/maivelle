# Phase 13 production storage review - 21 October 2026

This is an internal implementation/QA review, not an independent security audit. No independent reviewer has signed off. Production access remains blocked by `ENCRYPTION_REQUIRED`. The live development database is still unkeyed. No live conversion, production-key provisioning, Vault-key replacement, uninstall or data clearing was performed.

## Candidate inspected and verified

**Stage 13A superseding checkpoint:** provider/selection/Settings format-2 integration, first-intent repair and retained-generation cancellation now have new implementation/tests. Historical counts and disconnected-candidate/no-recovery-API findings below describe the prior checkpoint. The [current handoff](stage-13a-security-handoff.md) records precise coverage, unresolved cross-format/operator-recovery gaps and the still-unexecuted live migration. No independent sign-off or production activation is implied.

The candidate owner, native file lease, durable generation journal, SecureStore adapter, parameterized logical-record import, and authenticated portable format are described in [production database encryption](production-database-encryption.md). The installed debug APK SHA-256 is `e436481b1a3d403368e17e10689b89c7d5a207936c47ca7cf593043ebb9a4ce7`, matching the local debug artifact; package/version remain `com.devdb01.maivellelocalapp` / 1.0.0 (code 1). Tests ran on the physical HONOR, Android 17/API 37, with localhost Metro over USB. No new native build was needed for this continuation's JavaScript diagnostic additions.

The current production probe passed 15 assertions plus fixture cleanup: migration of a disposable schema-1 source through schema 10 into an independently keyed generation without changing source records/ledger; competing-owner rejection; format-2 ciphertext and bounded private-file read-back; wrong backup passphrase and tag rejection; encrypted header; protected-key reopening; missing/wrong-key refusal; all-eight-module and encrypted Vault rekey/recovery; previous-generation retention; derived reminder reconciliation with a recording adapter; durable selection reopening; and JS timer servicing during native KDF work. The separate eight-check encrypted-factory probe also passed, including missing and empty file rejection. These are test-owned databases and key services, not live provisioning.

## Actual process death and key loss

`productionInterruptionChecks.js` never imports the live connection manager. It persists only a nonsensitive random probe scope/stage in cache, then deliberately pauses a separately owned candidate. The host backgrounds Maivelle and terminates its own process with `run-as ... kill -9`; it does not force-stop the package or clear Android alarm state. Fresh PIDs and a new native lease are required before verification.

| Checkpoint | Observed result |
| --- | --- |
| First provisioning, after preparation and before selection | PID 21756 -> 22210. Active remains null; pending database/key retained; ordinary opening refuses explicit recovery; cleanup passed. |
| Replacement staging before selection | PID 594 -> 1633 in a fresh stable-server run. Original note/generation reopened; pending candidate retained; another replacement refused; cleanup passed. |
| After replacement publication completed | PID 26884 -> 27553. New note/generation reopened; previous file/key retained; cleanup passed. |
| Deleted disposable device key | Ordinary opening refused. An explicitly supplied passphrase archive restored the fictional note into a new independently keyed generation; inaccessible original retained until test cleanup. |

The key-loss fixture contains a fictional Note. Recovery of all eight modules and Vault is a separate rekeying fixture. These tests do not establish transfer to a second physical device or survival of uninstall. The first two kill points are outside an active SQL migration transaction; the third is after completed journal publication. They do not test a torn AtomicFile write, every syscall boundary, actual power loss or a kill inside a native SQLite migration. Host tests cover transactional migration/import failures, journal publication/key/open failures, and interrupted selection separately.

Probe cleanup removes owned database files, journals and SecureStore items through their APIs. It does not assert retirement of every Android Keystore wrapping alias or physical erasure on flash; no global Keystore cleanup was attempted. The competing-owner probe is same-process rejection, while process-death tests prove later lease reacquisition; simultaneous ownership attempts by two live OS processes remain untested.

## Capacity failure found and fixed

A new real-SQLite host test restricts staging `max_page_count` to its current allocation and imports a valid 99,990-character fictional Note. SQLite raises `SQLITE_FULL` and automatically ends its transaction. The previous catch handler then tried another `ROLLBACK`, hiding the intended recovery error behind `cannot rollback - no transaction is active`.

`portableRecords.js` now treats only that exact confirmed engine state as already rolled back. Other rollback failures produce an explicit error that staging rollback could not be confirmed and the candidate must not be reused. Tests verify original source preservation, unchanged destination migration ledger, no partial Note, and continued transaction usability. A separate injected I/O failure verifies the unconfirmed-rollback error. This is a SQLite quota simulation on the host, not an actual full phone filesystem or failing flash device. Final host count: 193 passing tests (164 database, 14 Vault, 9 Settings, 6 integration).

## Remaining decisions and release gates

| Severity | Finding / exact next action |
| --- | --- |
| BLOCKER | Production owner is not connected to DatabaseProvider or the current Settings backup/restore forms. Implement a reviewed consumer-drain/close/reopen handoff and format-2 document/UI integration before any production enablement. Keep the existing production gate. |
| HIGH | Interrupted first provisioning fails closed with a pending generation, but the current owner API has no operator repair/quarantine workflow for that state. Define and verify explicit recovery preserving all pending files/keys; do not delete a journal or silently retry provisioning. |
| HIGH | No independent security review. Obtain review of the native locking/durability boundary, key-to-generation binding, every keyed opener/writer/snapshot, portable framing/import, recovery authorization, and retained-generation policy. |
| HIGH | Remaining fault matrix: kill during an active SQLite migration and native journal/key publication, real power loss, unavailable/invalidated Keystore, actual ENOSPC/I/O failure, and verified rollback/recovery after those events. Do not weaken KDF policy to pass. |
| HIGH | Actual live plaintext-to-keyed conversion and plaintext-copy retirement are separate approval gates. Retaining any unkeyed source/snapshot prevents a whole-app encryption claim. No secure erasure guarantee on flash. |
| MEDIUM | Maximum archive/frame limits, lower-memory/release behavior and second-device recovery need further physical testing. Current format-2 private-file reader is bounded; current user-facing format-1 forms must not be relabeled as production format 2. |
| MEDIUM | JavaScript strings/bridge/provider copies cannot be reliably zeroized. SecureStore's Android Keystore protection is device-bound, without per-read biometrics for ordinary module/background access; it is not a StrongBox guarantee. Vault authorization remains independent. |
| MEDIUM | 26 npm advisories remain (19 high, 7 moderate), primarily reviewed tooling paths. Source-map absence is not a native/build/install supply-chain audit. No dependency fixes, overrides or install-script approvals were applied. |

## Exact operation requiring a later approval

This is a proposal; do not execute it merely because fixture tests passed.

1. Identify the selected live database and retained generations. Inventory required space and ongoing consumers, transactions, timers and notification work without exposing record contents or keys.
2. Complete the reviewed provider/file/UI and pending-state recovery implementation above. Produce and authenticate a portable backup using a dedicated user-provided backup passphrase; verify the original Vault master against the backup. Retain a user-controlled intact copy independently of the working database.
3. With explicit user approval, pause/drain live consumers and create a new independently random 32-byte SQLCipher generation key in Android Keystore-backed SecureStore. Publish durable preparation intent and read back protected metadata before any sensitive database operation. Do not rotate Vault keys.
4. Copy the live records into a new keyed staging generation through validated logical export/import. Preserve source files, IDs, timestamps, exact migration ledger, balances, references and encrypted Vault envelopes. Verify cipher/page/SQLite/FK integrity, exact supported records and Vault unlock before and after keyed reopening.
5. Only after all checks succeed, atomically publish the new selection and remount consumers using the reviewed handoff. Reconcile device-derived notification IDs. A failure before publication must leave the untouched source selected; a post-publication interruption must follow the tested recovery protocol and retain both generations and all dependent keys.
6. Do not delete old plaintext databases, snapshots or dependent keys in this operation. Their retention/retirement needs another explicit decision after recovery verification. Lost device key plus no usable archive/passphrase can mean permanent data loss; Vault master alone cannot recover the main database key.

No live operation in this proposal has been executed or approved by these reports. The SQLCipher and portable candidate is reviewable test evidence, not production-security certification.

Sources: [Expo SDK 58 SQLite/SQLCipher](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#sqlcipher), [SDK 58 SecureStore lifecycle and Android backup exclusions](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), and [production candidate design](production-database-encryption.md).
