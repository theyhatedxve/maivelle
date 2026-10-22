# Maivelle release readiness — Phase 13

## TypeScript migration — 22 October 2026

**TypeScript/organization work verified; Phase 13 remains NOT READY for production release.** All 214 host tests, strict application/plugin checks, Node tooling checks, zero-warning lint, nine physical native suites, native crypto/KDF responsiveness, eight SQLCipher checks, ten encrypted integration assertions plus cleanup, config introspection, Doctor 20/20, SDK compatibility and accepted Android JavaScript export passed. The migration preserved routes, migration SQL, native implementations, dependencies, live data and Vault keys. See [current TypeScript validation and exact limitations](typescript-migration.md#executed-validation).

No live migration/production-key activation or native/release APK build occurred. Existing encryption rollout, legacy-backup compatibility, storage-independent operator recovery, independent review and remaining fault/release-scale gates remain. The documented 26 npm findings are unchanged; the lockfile is byte-identical. No Phase 14 feature work was started.

## Stage 13A — latest integration checkpoint

**Stage 13A / overall Phase 13: NOT READY for production activation or release.** No release APK, Stage 13B or Phase 14 work occurred.

The real database selector/provider and Settings backup lifecycle now select an existing verified keyed owner without plaintext fallback, empty replacement or automatic provisioning. Existing development storage remains unchanged and unkeyed; no production selection journal exists. First-intent recovery explicitly reuses protected key material; preview/activation is session-bound, and abandoned/previous generations are retained. These changes resolve the earlier code-disconnection gap, not the live encryption release gate.

New verification: **210 host tests; 9/9 physical native suites** (Vault 27, Settings 18); **10 selected-owner backup/recovery assertions plus cleanup; 8 SQLCipher checks**; native load/random/AES/tamper and full-cost background scrypt responsiveness (3944 ms gate); lint, JS checks, **Doctor 20/20**, SDK compatibility and Android production JavaScript export passed. Transport/observer retries and precise coverage limits are recorded in [QA results](phase-13-test-results.md).

Before approval/activation: independent review; safe legacy format-1-to-encrypted recovery compatibility; storage-independent operator recovery; isolated full encrypted-provider React/SAF/authentication/confirmation coverage; remaining native publication/Keystore/power/storage-failure and release-scale tests. The documented live copy/verify/publish migration and later plaintext retirement each require explicit approval. Neither was executed. Existing 26 dependency advisories remain; no dependency edits were made.

Review [Stage 13A key lifecycle, threat model, recovery/fault boundaries and exact migration proposal](stage-13a-security-handoff.md). Current debug APK/package/native crypto/migration hashes remain preserved. User font 0.85, airplane Off/Wi-Fi On and Home were verified at completion. Historical sections below retain earlier results and are superseded where they describe the candidate as disconnected.

## Historical resumed QA checkpoint - 21 October 2026

**Phase 13: NOT READY for production/release.** The candidate's physical-device and final regression/diagnostic gaps have substantially improved, but production key provisioning is not connected to the live app and no real-data migration is approved or performed.

Debug APK SHA-256: `e436481b1a3d403368e17e10689b89c7d5a207936c47ca7cf593043ebb9a4ce7`. Installed and local APK hashes match. Package `com.devdb01.maivellelocalapp`, version 1.0.0/code 1, installed update 21 October 17:52:25; physical HONOR VKJ-NX9, Android 17/API 37. This continuation reused that local development binary and loaded current JavaScript through USB/localhost Metro 8087; no native source/package change required a rebuild. The accepted manifest-only fontScale handling remains; MainActivity has no forced-layout override.

Fresh evidence: **193 host tests**, **9/9 native suites** (Vault 27/Settings 18), **8 SQLCipher factory checks**, **15 candidate assertions plus cleanup**, three actual process-death checkpoints, explicit lost-test-key portable recovery, native RNG/AES/tamper gates, scrypt **4429 ms/265 JS ticks**, Vault unlock/background/cold lock, 20 enlarged route/label checks, lint/JavaScript checks, Doctor **20/20**, SDK compatibility, and production JavaScript export passed. Earlier observer/USB/launcher interruptions are recorded, not hidden.

Required next actions:

1. Obtain independent security review of [the candidate and fault evidence](phase-13-production-security-review.md). The report is an internal review, not certification. Complete explicit pending-first-provision repair/recovery and the live consumer/provider plus format-2 document/UI handoff.
2. Complete the remaining native migration/journal/key-publication interruption, Keystore loss/invalidation, real storage-failure, maximum-size/lower-memory and second-device matrix on disposable environments. Host capacity and three selected process kills do not replace these tests.
3. Present the exact live-conversion plan for explicit approval before generating a live production key or changing selection. Require an independently usable authenticated archive, source preservation, exact record/ledger/Vault checks and verified rollback. Plaintext retirement is another approval; never claim full at-rest protection while unkeyed copies remain.
4. Finish the applicable populated-screen visual/accessibility and release/OEM/auth lifecycle matrix. TalkBack was declined and secure-window screenshots were not bypassed. Preserve user font 0.85 and existing protection settings. Twenty route/label checks are not full accessibility certification.
5. Keep the 26-advisory baseline until concrete tested remediation is approved. No major updates, blanket overrides, force audit fix or script approvals.

The current app remains an offline development application using unkeyed synthetic storage behind a production gate. No release APK or Phase 14 was started. [QA results](phase-13-test-results.md), [known issues](phase-13-known-issues.md), [candidate design](production-database-encryption.md), and [dependency review](dependency-security-review.md) preserve the historical checkpoints.

---

Historical evidence is preserved below; this checkpoint supersedes its status summaries.


## Historical decision - 21 October 2026

**Phase 13: NOT READY for production/release.** The requested final development-build verification passed. The release blocker is production database key provisioning, portable recovery and approved non-destructive migration; these are not implemented or enabled. No release APK was generated and Phase 14 has not started.

New execution on the accepted manifest-only debug build: **174 automated tests**, **all nine native suites**, eight physical SQLCipher proofs, 18 native Settings checks, read-only live integrity, offline core navigation, original fictional Vault unlock/background lock/cold lock, native RNG/AES-GCM tamper rejection and full-cost background scrypt passed. KDF took **3,867 ms with 231 JS timer ticks** (3,910 ms whole gate). Lint/JS checks, Doctor **20/20**, dependency compatibility and Android production JavaScript export passed. A JavaScript export is not a production APK or production-security certification.

Font handling is accepted for tested 1.0/live-and-cold-1.3/cold-2.0 HONOR flows: measured glyphs grow, routes/drafts survive, and no duplicate-linking warning was observed. The forced-layout hook is absent. Earlier failures used a constant-height proxy and were corrected with native text measurements. Foreground-only JS metadata lag, wider TalkBack/200%-screen/device/release coverage and screenshot overlay limits remain documented.

Required release gates:

1. Obtain explicit approval and independent review for the production owner, native cross-process provisioning lock, durable protected key/generation publication and portable recovery format. **Do not bypass ENCRYPTION_REQUIRED.** Current device-bound fixture provisioning does not complete these production paths.
2. Implement and test the approved recovery/loss/interruption protocol on disposable copies, then separately approve live conversion into a new encrypted generation and journal selection. Preserve the untouched original and verified archive. Retirement of old plaintext generations is a separate approval. Never replace a missing key or failed database with an empty one.
3. Retain prior isolated picker/confirmation/restore evidence and fresh Settings regression; complete release-scale storage/low-memory/actual process-death, alarm/OEM/auth/TalkBack checks on fictional data. No live-provider restore or production encryption cutover was executed in this continuation.
4. Maintain the **26-advisory dependency baseline** until a concrete compatible remediation is approved and tested. No Expo/Reanimated change, blanket overrides, force audit fix or unreviewed install scripts.
5. Stop after Phase 13. Phase 14 and any release APK require explicit approval.

See [current results](phase-13-test-results.md), [known issues](phase-13-known-issues.md), [production key/recovery proposal](database-encryption-provisioning.md) and [dependency review](dependency-security-review.md). The prototype's verified Keystore protection is device-bound; portable recovery must not assume those keys transfer. No real-data migration or Vault-key replacement occurred.



## Historical paused decision - 21 October 2026

**Phase 13: NOT READY.** Production encryption remains disabled, and the live font-change defect is unresolved. The installed debug binary contains an unaccepted font remeasurement prototype; it must be removed/reworked and rebuilt before final QA. No release APK, live data conversion, key replacement, uninstall, reset or Phase 14 work is authorized by this checkpoint.

Progress: **174 host tests passed**, eight isolated physical SQLCipher checks passed, and real Android protected backup forms/pickers/confirmation Cancel, wrong/corrupt backup rejection, rollback and successful fictional eight-module/Vault restore passed. Three sandbox native reminder requests matched their rebuilt ledger and were cleaned. The live provider was never replaced. The successful restore's Android authentication returned success; the user's later canceled/failed reply was clarified as a prompt already gone, not an explicit cancellation test.

Final gates still required: production key publication/recovery and portable encrypted-SQLCipher backup review; separately approved non-destructive cutover; a font fix that actually scales text; rerun all nine native suites and responsive native crypto on the accepted binary; final diagnostics/export and remaining release lifecycle/large-backup/storage-pressure review. The 26 npm advisories remain documented without dependency modifications. See [provisioning design](database-encryption-provisioning.md) and [latest QA checkpoint](phase-13-test-results.md).

The eight-check encrypted factory is authorized disposable design/proof work, not approval to enable production or migrate live records. The older proposal below retains that live-cutover approval boundary.


**Phase 13 recommendation: NOT READY for unconditional signoff or a final production APK.** The resumed rebuilt-app Settings/native tests now pass, but production storage security, the full restore UI workflow and a newly observed live font-change issue remain unresolved. No final APK was built, signed or released, and Phase 14 has not started.

Required gates before release work:

1. Resolve production main-database key provisioning, recovery and encryption for every connection and staging/recovery generation. Preserve the verified background Bouncy Castle scrypt policy and Vault wrapping design. Independent security review is required; neither a clean Doctor result nor encrypted Vault rows proves whole-app production security.
2. Close the historical restore-confirmation issue with a traced, clean isolated end-to-end UI test. Verify Cancel/Back never authenticate or replace, typed confirmation binds the intended stage, wrong secrets/tampering preserve current records, successful cutover remounts consumers, rollback preserves later records and derived reminders are rebuilt. Do not clear the existing installation.
3. Resolve/review the live font-scale recreation/duplicate-linking warning. Normal themes and cold-start 1.3× layout/keyboard/scroll now pass, but a live change is not signed off. Complete remaining interactive auth/permission/reminder/reboot, TalkBack and capture/recents checks. Test full-size backups, real disk-full/interruption and lower-memory behavior on fictional data. Re-provision optional biometric shortcuts only through the existing secure authorization path.
4. Review the 26 dependency findings and native/build supply chain before any approved change. Preserve SDK 58/Reanimated; do not force audit fixes, add blanket overrides or approve unreviewed install scripts. Re-test a concrete remediation in isolation.
5. Obtain explicit approval before Phase 14. Any eventual release build requires a local Windows/physical-device workflow and replacement install preserving data; no emulator/cloud assumption. Standalone offline behavior without Metro needs its own authorized release-build verification.

Evidence: [Phase 13 results](phase-13-test-results.md), [known issues](phase-13-known-issues.md), [test plan](phase-13-test-plan.md), [dependency baseline](dependency-security-review.md), [backup/recovery](settings-backup-recovery.md) and [native crypto investigation](phase-11-crypto-investigation.md).

Current continuation QA: **166/166 host tests**, all **nine rerun offline native suites**, 12 cross-module checks, read-only current-data integrity, native AES/KDF/randomness/loading and normal module UI checks passed on the existing SystemUI development rebuild. Expanded Settings passes 18 native checks including all eight modules' exact fixture records, encrypted Vault recovery, tamper rejection and controlled rollback. KDF took 3,864 ms with 231 JS timer ticks. Doctor 20/20, compatibility, lint, JavaScript checking and production JavaScript export passed; audit remains 26 findings. The historical Settings error was not reproduced and its cause is not established. No data reset, native crypto or dependency change was needed.

## Production storage remediation proposal — approval required

This is a proposal, not an implemented security migration. Physical inspection confirmed SQLCipher **4.17.0 community** is available, while application development connections remain unkeyed. Existing production access fails closed. Preserve that gate until the complete design, recovery tests and independent review pass.

1. Specify a separate cryptographically random main-database key and its Android secure-storage authorization, loss/reinstall behavior and recovery policy. Keep it independent of the Vault data key and app-lock convenience gate. No embedded key, automatic new-key fallback after key loss or device-specific Keystore export is acceptable.
2. Define one reviewed connection-opening policy that obtains/authorizes the correct key and applies it before schema queries, PRAGMAs requiring database access or BEGIN. Cover the process owner, each exclusive writer, snapshots, staged restores and retained generations. Verify missing/wrong keys fail closed. Review the native key-binding/logging boundary rather than constructing secret-bearing SQL logs. See [SDK 58 SQLCipher requirements](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#sqlcipher).
3. Approve and test a versioned portable backup evolution that preserves schema metadata and authenticated recovery material without exporting raw keys or assuming Keystore transfer. Existing format 1 contains unkeyed SQLite pages inside an authenticated encrypted archive; it cannot simply be relabeled as production encrypted-at-rest storage. Retain reviewed full-cost native KDF and Vault wrapping; independently assess any new database-key envelope and stream/snapshot conversion.
4. Only after approval, migrate a copied disposable fixture through a **new encrypted generation**, using a reviewed SQLCipher export/conversion path. Verify schema/ledger, IDs, timestamps, record equality, balances, references, Vault unlock and encrypted-file reopening before journal cutover. Preserve the current database and a verified recovery archive. Provision durable key metadata before publishing a generation; inject failures at each key/journal/open boundary and prove rollback. Never reset or rekey the user's only copy in place to obtain a pass.
5. Define protected retention/retirement of old plaintext development snapshots and recovery generations. Retaining an unkeyed prior generation prevents a whole-app encryption claim. Do not delete those files or dependent key material until encrypted recovery is independently verified and the user approves retirement; do not promise secure physical erasure on flash. Production enablement requires explicit approval and a broader security review after these gates pass.

No implementation of this proposal or security-sensitive schema migration is authorized by this report. Existing migrations and user data remain intact.

## Production-encryption continuation update - 21 October 2026

The isolated production provisioning and recovery candidate is implemented and has 191 passing host tests. Lint, JavaScript type-check, and Android production JavaScript export passed. It remains unselected and is not connected to the live connection/provider; current production access remains blocked by `ENCRYPTION_REQUIRED`. No live key creation, database conversion, app-data clearing, or Vault-key replacement occurred.

The expanded physical probe is not yet verified: ADB fails before device discovery with `Cannot mkdir '\\.android': Permission denied`. Expo Doctor and SDK compatibility checks could not be refreshed because the environment denied the required network requests. Earlier probe/build evidence covers only the earlier candidate revision.

Phase 13 remains **NOT READY** pending physical verification of the current candidate, reviewed loss/recovery and interruption behavior, live migration approval, and independent security review. Do not switch live storage or retire the existing generation without explicit approval.
