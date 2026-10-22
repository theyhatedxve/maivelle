# Phase 13 known issues — 21 October 2026

## TypeScript migration — 22 October 2026

The language/structure migration passed its executed checks: 214 host tests, strict app/plugin checks, separate tooling checks, zero-warning lint, nine physical native suites, crypto/KDF responsiveness, eight SQLCipher checks, ten encrypted integration assertions plus cleanup, Doctor/compatibility and accepted Android export. The native KDF import-resolution regression is **resolved**, with source and exported-graph guards. The initial cleanup error and failed/cold-start observer attempts remain recorded in [migration validation](typescript-migration.md#executed-validation).

No new production security approval is implied. The 26 dependency findings and Stage 13A encryption/recovery/compatibility/review/fault gates below remain. Tests/tooling intentionally retain a dynamic non-strict harness configuration; application/plugin/diagnostic source remains strict. The Windows Node 24 LTS toolchain is required for the documented native TypeScript harness/config workflow. Full human SAF/biometric UI, live font/TalkBack and standalone-release tests were not newly repeated.

## Stage 13A — current issues and approval boundaries

**NOT READY for production activation.** The selector, actual provider handoff and selected format-2 backup service are now connected. Explicit first-intent recovery and non-destructive pending-candidate retention exist. The earlier disconnected-candidate/no-recovery-API findings below are historical, not current.

| Severity / state | Current finding and next action |
| --- | --- |
| BLOCKER — not executed / pending approval | Live data is still unkeyed. No production journal or live device key was created. Independent review and explicit authorization are required before the proposed copy/verify/publish migration; plaintext-copy retirement is a separate approval. |
| HIGH — compatibility gap | Legacy storage retains format-1 snapshot backup support; encrypted storage supports portable format 2. Cross-format restore into encrypted storage is refused. Review/implement a recovery conversion without plaintext production staging before broad activation. Existing backup files are preserved. |
| HIGH — recovery entry point | `resumeFirst(verify)` explicitly recovers an interrupted first intent with the same available key. Missing/invalid keys remain fail-closed. A reviewed repair/recovery entry point outside the unavailable database/provider tree is not implemented. Orphan encrypted diagnostic files also block fallback; recover only their recorded owner, never delete arbitrary files to bypass this guard. |
| HIGH — physical coverage | New keyed selector/backup APIs passed 10 checks plus cleanup, but do not mount the entire encrypted-mode React provider or exercise human SAF/authentication/confirmation through it. Legacy UI checks remain previous evidence. Add isolated full protected UI coverage. |
| HIGH — security review / faults | No independent review; no actual power loss, native key/journal syscall crash, hardware Keystore invalidation, actual phone ENOSPC, maximum-size/second-device recovery or concurrent live-process contention proof. Host injection and prior process-kill checkpoints are scoped evidence. |
| MEDIUM — retention | Journal v2 keeps canceled/older generation names and keys, capped at 64 retained entries under the native journal bound. No automatic deletion. Define an approved, capacity-aware retirement policy; reaching the cap blocks further retirement/replacement rather than erasing data. No secure-erasure guarantee. |
| MEDIUM — dependencies | Existing 26 documented npm findings remain. Package/lock hashes unchanged. No updates, broad overrides, force fix or install-script approval. |
| Observer failures — resolved, retained | Batch native observer lost Settings dump when Metro stopped; all 18 terminal PASS lines were subsequently captured. First SQLCipher observer lost its route during reload; fresh 8/8 retry passed. Sandbox Expo checks returned EACCES; host-access compatibility and Doctor 20/20 passed. These interruptions are not application-security failures or substituted passes. |

New evidence: 210 host tests, nine native suites, 10 Stage 13A integration assertions plus cleanup, eight SQLCipher checks, crypto/KDF gate, lint/JS, Doctor/compatibility and Android JS export passed. See [results](phase-13-test-results.md) and [security handoff and migration proposal](stage-13a-security-handoff.md). Previously accepted font changes and accessibility limitations remain unchanged; no new font/TalkBack tests were performed.

## Historical resumed QA checkpoint - 21 October 2026

**NOT READY.** Current candidate physical verification and diagnostics passed; live production encryption is still disabled.

| Severity | Current finding / next action |
| --- | --- |
| BLOCKER | Production owner/provider and format-2 document/backup UI handoff remain unimplemented. Keep ENCRYPTION_REQUIRED; do not select a new live key/generation. Complete reviewed integration and get separate live-conversion approval. |
| HIGH | Interrupted first provisioning deliberately fails closed, but no operator repair/quarantine workflow exists for a pending first generation. Implement explicit artifact-preserving recovery; do not reset/retry automatically. |
| HIGH | Independent security review not completed. Internal review is documented separately and is not independent signoff. Review native durability/ownership, key lifecycle, recovery authorization and all storage paths. |
| HIGH | Actual native-transaction/torn-journal/power-loss/Keystore-invalidation and phone ENOSPC/I/O fault matrix remains incomplete. Three real process-death checkpoints and explicit lost-test-key archive recovery pass; those do not cover every boundary. |
| MEDIUM | Accessibility: glyph/live/cold tests and 20 enlarged route/label checks pass; JS foreground fontScale metadata still lags until resume. Full populated visual/target/TalkBack/other-device/release coverage remains incomplete. User declined TalkBack. Secure-window screenshot failure prevented public draft pixel inspection; protection preserved. |
| MEDIUM | Backup maximum-size/lower-memory/second-device/release profiling pending. Real host SQLite quota regression now passes; actual device full-storage and power-loss tests were not performed. Current format-1 UI evidence remains historical; format 2 has private-file evidence only. |
| MEDIUM | 26 npm findings unchanged (19 high, 7 moderate), reviewed tooling paths; source-map absence does not certify build/install/native supply chain. No overrides/fixes/script approvals applied. |
| MEDIUM / infrastructure recovered | scrcpy replaced the SDK ADB server and removed forwarding. User closed it; SDK server/USB restored. Regression observer interruptions are documented; nine fresh native suites ultimately passed. Do not assert a root cause for the older Settings event. |
| LOW | Old developer crypto-screen footer still describes the Vault as unavailable; actual native gates and Vault unlock/locking pass. It is outdated diagnostic copy, not a measured runtime gate. Existing sample dashboard copy remains labeled. |

Newly executed: 193 host tests; nine native suites; current candidate 15 assertions plus cleanup; eight encrypted-factory checks; three process-death checkpoints; explicit lost-key recovery; full-cost scrypt 4429 ms/265 timer ticks; lint/JS, Doctor 20/20, compatibility and export passed. No live storage or Vault keys changed. See [current QA evidence](phase-13-test-results.md) and [review/approval plan](phase-13-production-security-review.md).

---

Historical evidence is preserved below; this checkpoint supersedes its status summaries.


## Historical status after completed device verification - 21 October 2026

**Phase 13: NOT READY for release.** This section supersedes the historical checkpoint summaries and issue table below.

| Issue | Current state | Evidence / remaining action |
| --- | --- | --- |
| P13-01 | BLOCKER, pending approval/implementation | Eight encrypted-fixture physical checks pass again, but production owner/key-publication journaling, portable encrypted-database recovery and live cutover remain unimplemented. ENCRYPTION_REQUIRED remains intact; live development storage is unkeyed. See the exact approval boundary in the provisioning design. |
| P13-02 | Scoped UI/backend evidence passed; historical cause undetermined | Prior full isolated Android picker/confirmation/rollback/eight-module Vault recovery passed. Fresh 18 native Settings checks pass, including rollback/journal recovery. No live provider replacement or actual OS process death during cutover was attempted. Historical Phase 12 input sequence remains unavailable. |
| P13-10 | Manifest-only handling accepted for tested HONOR flows | Corrected native glyph measurements pass at 1.0, live/cold 1.3 and cold 2.0; activity/editor/draft retained, zero observed Router warning. Forced-layout override removed. Earlier fixed-height assertion was misleading, not proof that glyphs failed to resize. |
| Font metadata | Tracked limitation | Synthetic foreground font changes resize native text but JS fontScale updates on resume. Do not use stale JS metadata to manually rescale fonts. Full 200% populated-screen/TalkBack/other-device/release matrix remains unexecuted. External bubble limited an upper-right screenshot region. |
| P13-07 | Documented dependency baseline | 26 advisories (19 high/7 moderate), no dependency changes. Tool packages absent from inspected Android map does not eliminate host/build/install/native supply-chain exposure. No force fix, overrides or script approvals. |
| P13-04 / P13-05 / P13-06 | Remaining release validation | Maximum backups, actual disk-full/power-loss, low-memory/release profiling, larger ledgers, full alarm/OEM/biometric/TalkBack matrix remain limited or historical. Do not lower KDF cost to obtain a pass. |
| P13-03 / P13-08 / P13-09 | Existing status retained | Prior System theme fix preserved; sample dashboard day/copy still labeled; SDK ADB and localhost Metro worked through the completed tests. Do not attribute the unknown historical Settings failure to ADB. |

Newly executed: 174 host tests; all nine native suites; read-only live integrity; eight SQLCipher proofs; native load/random/AES and full-cost scrypt (3,867 ms/231 responsive JS ticks); offline core screens and Vault unlock/background/cold lock; lint/JS checks, Doctor 20/20, compatibility and Android JavaScript export passed. No release APK or Phase 14 work. See [full results](phase-13-test-results.md).

Production enablement/key creation for live generations, non-destructive live conversion/cutover and plaintext retirement require separate explicit approval and review. No user data or Vault keys were reset/replaced.



## Historical paused checkpoint - 21 October 2026

**NOT READY.** Current updates supersede the older table's test-status descriptions below:

- **P13-01 remains BLOCKER:** secure provisioning design and an isolated factory now have eight host and eight physical SQLCipher checks. Production is still disabled; portable encrypted-SQLCipher recovery and crash-safe production provisioning/cutover require review and approval. Existing development data is unkeyed and unchanged.
- **P13-02 improved, scoped:** actual protected forms/pickers/typed confirmation/Cancel, wrong/corrupt input, authenticated rollback and successful eight-module/Vault restore passed with a separate fictional owner/journal. Three own native reminder requests were verified then canceled. Live-provider replacement and real process death during cutover were not executed. The historical Phase 12 event is not retrospectively explained. Android authentication cancellation was not executed; the user clarified a late canceled/failed reply meant the prompt was already gone.
- **P13-10 remains OPEN:** two native font candidates avoided recreation and retained draft/navigation but failed actual text-growth validation. The latest debug binary/plugin still contain an unaccepted fontScale plus root-remeasurement prototype. Remove/rework and rebuild before signoff; do not call warning absence a fix. SDK dependencies were not changed.
- Host tests now **174 passed**; lint/JavaScript checks pass. Doctor/compatibility/export passed earlier in this run, audit unchanged at **26**. Final export and all nine native suites/crypto checks on the newest prototype binary remain pending. Earlier native passes remain historical.

The user requested pause. Sandbox files/cache/native reminders were cleaned; exported fictional documents remain in the selected folder. Phone cleanup restores font 1.0, airplane Off and Wi-Fi On. See [latest results](phase-13-test-results.md).


| ID | Severity / state | Finding and required action |
| --- | --- | --- |
| P13-01 | BLOCKER / confirmed open | Physical SQLCipher 4.17.0 community is linked, but no main-database key is provisioned. The original development file has the SQLite plaintext signature; source opens it without a key. ENCRYPTION_REQUIRED deliberately blocks production access. Snapshots/retained development generations remain unkeyed. Do not bypass the gate. Follow the non-destructive proposal in release readiness; security-sensitive implementation/migration requires approval and review. |
| P13-02 | HIGH / open | Phase 12's attempted Cancel interaction resulted in a completed replacement; the input sequence was not captured. Original storage was recovered then. This continuation passes 18 native Settings checks, exact eight-module snapshot recovery, controlled rollback and the harmless shared confirmation Cancel UI. These do not explain the historical event or execute the complete chooser/preview/typed-confirmation/auth/provider-remount flow. Repeat that traced UI flow in an approved disposable Android user/profile or separate physical test installation, never the user's only data copy. |
| P13-03 | MEDIUM / fixed and verified | Approved expo-system-ui 58.0.6 plus automatic appearance/plugin compiled and replacement-installed locally. System follows Android Light/Dark live and explicit themes pass on HONOR. Original System/Dark restored. Package/lock reconstruction proves no unrelated dependency changes. |
| P13-04 | MEDIUM / open | Full development-process PSS reached approximately 681 MiB in coarse repeated-KDF/Settings samples. Full 64 MiB backups, low-memory devices, actual disk-full, hardware-durability failures and interrupted OS process cutover still need dedicated release/isolated testing. Do not lower scrypt cost to conceal memory use. |
| P13-05 | MEDIUM / open | Finance/Budget reports read the full ledger; 1,000 transactions measured about 123/129 ms on the development device. Larger ledgers and real release frame profiling remain unvalidated. No cache or speculative rewrite added. |
| P13-06 | MEDIUM / open | Fresh Phase 13 manual reminder delivery/reboot/permission-revocation, biometric enrollment/lockout, full device app-lock prompts and standalone release lifecycle matrix are not all automated. Prior-phase passes remain historical evidence. Android/OEM alarm restrictions and app force-stop behavior still apply. |
| P13-07 | MEDIUM / tracked baseline | npm audit remains 26 findings (19 high/7 moderate), primarily Expo/Metro/Xcode tooling. Affected roots are braces 3.0.3, node-forge 1.4.0 and uuid 7.0.3. The generated Android map excludes those tool packages; this does not dismiss build/install exposure, Maven/native risks or future call paths. Follow the dependency review before any remediation. unrs-resolver script approval remains unchanged. |
| P13-08 | LOW / open | Dashboard greeting/date still include explicitly labeled sample copy. Do not interpret the sample day as a live scheduling date. Replace this presentation copy in an approved follow-up if desired. |
| P13-09 | MEDIUM / environment recovered; historical error undetermined | One SDK ADB server and IPv4 localhost Metro remained stable through the continuation's completed tests; hwtransport was absent. All nine native suites and final normal UI checks now pass on the rebuild. Settings passed 14 original checks on reproduction and 18 expanded checks later. The earlier exact FAILED message/root cause could not be reproduced or recovered; do not claim ADB caused it. Keep the earlier failure as historical evidence and use current-script cold launches. |
| P13-10 | MEDIUM / open | Live Android font-scale changes caused activity recreation, an initially failed route assertion and Expo Router's development duplicate-linking-handler warning. One app Router root is configured; deeper teardown cause and release behavior remain unverified. Cold-start 1.3× editor layout, keyboard, scroll and validation passed, then the user-requested 1.0×/normal Home was restored. Do not suppress the warning or downgrade dependencies to claim a fix. Isolate native/Router recreation in an approved scoped follow-up and repeat foreground/background font changes. |

Fixed: HIGH native exclusive-writer FK enforcement; MEDIUM stale Notes count, Calendar key-collation latency and Notes preview overfetch. See [results](phase-13-test-results.md) for reproductions, scope and measurements. No existing data was reset to address a failure.

The previous optional Vault biometric shortcut was revoked during Phase 12 restore testing and was not silently recreated. Master-password recovery remains. Re-enable it from Vault Security with appropriate on-device authorization if desired; Phase 13 does not change or reprovision existing keys.

## Production-encryption continuation status - 21 October 2026

The Phase 13 item 1 candidate is implemented in isolated owner/storage/recovery modules and host tested. It is not integrated into the active database provider; `ENCRYPTION_REQUIRED` remains. No production key material, live database, Vault key, or migration history was altered.

Latest host checks passed: 191 tests, lint, JavaScript type-check, and Android production JavaScript export. The expanded device probe is pending because ADB cannot initialize its config path (`\\.android`, permission denied) before device discovery. Expo Doctor and SDK compatibility could not be freshly checked because network calls are denied in this environment. Earlier device-probe results apply only to the earlier candidate revision.

Release status remains **NOT READY**. Explicit approval and independent review are still required before any live database conversion, active-generation publication, or plaintext-generation retirement.
## QA workstream paused — 22 October 2026

At the user's request, physical-device testing is paused and diagnostic screens
have been removed from the application's route tree. Existing release blockers
documented above are retained. This pause does not mark Phase 13 as passed. See
[current development focus](development-focus.md).

