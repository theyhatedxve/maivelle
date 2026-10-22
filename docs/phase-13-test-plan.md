# Phase 13 test plan — 21 October 2026

Scope: integration, measured performance and QA of the existing application. No final APK build, release, Phase 14, package changes, production encryption redesign or live-data replacement is authorized. Preserve the verified native KDF and migrations 1–10.

Approval addendum: after System following failed physically, the user explicitly approved only SDK-matched `expo-system-ui ~58.0.6`, automatic appearance/config plugin, and a local replacement development build with regression checks. npm lifecycle scripts remain disabled for installation. This scoped exception does not approve unrelated dependencies, overrides, crypto changes or a final release APK.

Baseline: capture hashes of source, native modules, config and manifests before edits; run existing 160 host tests, lint, JS checks, Expo Doctor and dependency compatibility. Inventory existing database, Vault/crypto, Settings and nine native regression suites. Previous device evidence is historical, not a new Phase 13 pass.

New coverage uses the real SQLite host adapter and separate native fictional databases: service invalidation/dashboard counts, Task/Calendar projection, Finance/Budget reconciliation after edits/deletion, timer service restart and transaction rollback. Reuse existing medicine, crypto and backup suites rather than copying them. Compare full migration ledgers and FK/integrity checks.

Measure five samples of 50-row Notes/Tasks reads with 1,000 records, Calendar day/week/month with an old recurring series, timer summary and Finance/Budget aggregation. Report dataset, median/max and host/device distinction. Measure loaded financial data separately if needed; empty-ledger measurements must be labeled. Record Android Activity startup separately from JS-ready time. Development UI automation is not a release frame benchmark.

Run native suites on the physical HONOR with airplane mode on/Wi-Fi off; restore original settings in finally. Test process/reboot persistence using an explicitly isolated timer database. Do not confirm replacement against application data. Sensitive-screen and crypto checks use public fictional fixtures and report timing/protection state without secret values. Restrict UI inspection to Maivelle; fingerprint and document grants require the user.

Manual matrix: theme/system appearance, compact layout/font scale, keyboard, permissions/exact alarms, real reminder delivery after reboot, app/Vault locking, local folder export and revised restore confirmation on a clean isolated installation. Mark unexecuted rows pending. Stop instead of clearing data, uninstalling, collecting another app's screen or guessing a pass.

Severity: BLOCKER = security, unrecoverable loss or major unavailable functionality; HIGH = significant functional/reliability defect; MEDIUM = recoverable correctness/usability; LOW = cosmetic. Release recommendation must include production storage gate, unresolved restore interaction and dependency advisories. Exact results and remaining issues go into the companion Phase 13 reports.

## Reproduction commands and HONOR checks

From the application folder in Windows PowerShell, with the existing installed development build and USB Metro running:

```powershell
npm.cmd run lint
npm.cmd run typecheck
node --test --test-concurrency=1 tests/database/*.test.cjs tests/vault/*.test.cjs tests/settings/*.test.cjs tests/integration/*.test.cjs
node scripts/phase13-benchmark.cjs .expo/phase13-performance-host.json
npm.cmd run doctor
npm.cmd run check:dependencies
$adbTool = 'C:\Android\Sdk\platform-tools\adb.exe'
& $adbTool devices -l
& $adbTool -d reverse tcp:8087 tcp:8087
& $adbTool -d shell am start -a android.intent.action.VIEW -d 'maivelle:///integration-diagnostics' com.devdb01.maivellelocalapp
```

1. Tap **Run cross-module checks**; require 12 PASS labels ending with migration/integrity validation. Tap **Inspect application integrity** for a read-only audit of current storage. **Measure isolated queries** seeds only its disposable fixture and reports five-sample measurements. These actions never replace current storage.
2. Tap **Seed isolated lifecycle timer** only if no previous test is running. Force-stop/reopen Maivelle and tap **Verify isolated lifecycle timer**. Reboot, unlock/authorize USB, restore reverse forwarding, reopen and verify again. Finally tap **Clean isolated lifecycle fixture**; it deletes only that dedicated test database, not normal timer records.
3. At `/database-diagnostics`, explicitly run the seven existing native module checks. At `/vault-diagnostics` and `/settings-diagnostics`, explicitly run their suites. Use airplane mode On/Wi-Fi Off, retaining local USB Metro, and restore original connectivity afterward. For `/vault-security-check`, run native background KDF and authenticated encryption; public timing labels contain no keys.
4. On Appearance, record original app/Android modes. Test Light, Dark and System, then change Android Light/Dark while System is selected. Verify previews and other module surfaces; restore originals. A native appearance change requires the approved development rebuild, not just Metro reload.
5. On a fictional Vault, unlock with its master password, then Home/background/return and cold restart. Require the master gate again. Device app authentication must not authorize the Vault key. Check Android screenshot/recents restrictions; complete biometric/credential prompts physically. Restore optional preferences without bypassing authentication.
6. Exercise Notes/Tasks empty/error/editor keyboard states at increased Android font scale and a compact supported display. Do not save test drafts into unrelated records. Check accessible names, 48dp buttons, back navigation, safe areas, wrapping and TalkBack order. Restore display/font settings.
7. Review notification/exact-alarm permissions. With fictional Medicine schedules, test denied/re-enabled permission, preference toggles and actual delivery after reboot before opening the app. Compare schedule/history and derived request counts. Distinguish OS delivery from mocked/reconciler tests; do not change real medicine records.
8. Follow [the backup instructions](settings-backup-recovery.md#physical-honor-verification-instructions) for a local folder grant and read-back authentication. On a separate clean fictional installation only, trace the full revised replacement dialog, Cancel/Back, authentication, successful cutover, migration/Vault recovery and failed/interrupted rollback. Never confirm replacement on the user's current database to fill a test gap. Real disk-full and maximum-size archives require isolated storage testing.

For a blank development launch, first check `http://127.0.0.1:8087/status` on Windows. A running Node process alone does not prove Metro responds. Start the USB server with `node --dns-result-order=ipv4first node_modules/expo/bin/cli start --dev-client --localhost --port 8087`, then recreate reverse forwarding after any USB/ADB restart. Use `C:\Android\Sdk\platform-tools\adb.exe` consistently. Do not clear application storage to repair a development-server connection. If USB disappears mid-offline test, restore the recorded connectivity settings physically and mark unfinished checks pending.
