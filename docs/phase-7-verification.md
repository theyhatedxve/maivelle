# Phase 7 verification — Medicine

Verified on 20 October 2026. Scope stops at Medicine; no Time Tracker work is included.

## Environment and preservation

- Windows, Node 24, Temurin JDK 17, Android command-line SDK, physical HONOR VKJ-NX9 (`AFAM026324010734`). No emulator or cloud build.
- Installed Expo 58.0.16, Router 58.0.24, Notifications 58.1.5, SQLite 58.0.13, SecureStore 58.0.2, React Native 0.88.0. The Expo/Router/Notifications package and lockfile changes existed before this task; they were preserved.
- Read `AGENTS.md`, architecture, storage, development and prior verification documents; inspected actual migrations/providers/repositories, Medicine placeholder, dashboard and Calendar. Consulted matching official SDK Notifications/SQLite and Android alarm/notification permission documentation.
- Migrations 1–5, branding assets, existing routes and SQLCipher/SecureStore/backup/security gates are unchanged. Migration 6 adds Medicine tables only. No app data was cleared, uninstalled or reset.
- Prebuild regenerated the outdated ignored Android template after the preexisting Expo update. All native changes come from app config/plugins. Local compilation succeeded in **8m 13s**, 506 actionable tasks. Updated development APK installed on HONOR.
- Old Metro 8083 was bound but unresponsive; preserved it and started a working USB-only Metro on **8084**. The development client is launched against `127.0.0.1:8084` through ADB reverse. SDK 58 rejects combining `--port` and `--no-bundler`, so build and USB launch are separate.

## Automated checks

| Check | Result |
| --- | --- |
| `npm.cmd run test:database` | **79/79 passed**: 59 existing database/Notes/Tasks/Calendar tests and 20 Medicine/reminder tests |
| `npm.cmd run typecheck` | Passed; checked JavaScript/JSDoc, no TypeScript application files |
| `npm.cmd run lint` | Passed, zero warnings |
| `npm.cmd run check:dependencies` | Dependencies up to date |
| `npm.cmd run doctor` | **20/20 passed** |
| `git diff --check` | Passed; repository LF/CRLF notices only |

Medicine host tests exercise real SQLite creation/CRUD, filtering, timestamps, optimistic conflicts, daily/weekday/multiple-time generation, date intersections, Taken/Skipped, actual versus scheduled timestamps, grace boundary, future/duplicate action rejection, immutable snapshots, schedule edits and deactivation/reactivation. Transaction rollback and migration idempotency/preservation/failure rollback are tested. History deletion restrictions, composite references, duplicate slots and invalid statuses are tested directly. A separate process reopens a file database and reads definitions/logs/job IDs. New York spring gaps/fall-back behavior, exact-minute edits and backwards-clock edits are tested. Bounded generation rejects malformed/range inputs.

Injected notification tests cover denied/granted permission, exact/inexact transitions, cancellation scope, missing native requests, stale jobs after edits/actions, stable IDs after interrupted ledger writes, queue limits and surfaced cancellation failures. A dedicated test proves startup/foreground rearming replaces the same native ID even if Expo retains a serialized request after Android clears its alarm. Unchanged periodic reconciliation avoids rewriting the SQLite ledger. These tests do not by themselves prove Android delivery.

## HONOR results

Executed successfully:

- New native build and Router/JavaScript loading over USB, with no Wi-Fi requirement.
- Isolated native Medicine diagnostics: migration 6 preserves an older note, repeated initialization, async SQLite transactions/CRUD, daily and weekday schedules, multiple times, missed calculation, Taken/Skipped, duplicate prevention, schedule history, deactivation, foreign-key integrity and persistence after closing/reopening SQLite.
- Initial notification permission denied; contextual prompt denial keeps library available, subsequent grant reports allowed.
- Exact-alarm system settings request and authorization report allowed; Android `AlarmManager` shows a pending alarm-clock trigger for the Medicine occurrence.
- Create a fictional medicine, reject blank name, display details, search by name locally, record Taken and Skipped, and update dashboard totals from SQLite.
- Unsaved-change warning/Keep editing, edit medicine notes and schedules without creating another parent, preserve earlier dose actions, cancel/replace stale reminder.
- Airplane mode **1** and Wi-Fi **0** explicitly verified. Library/search/details and dose persistence after force-stop/relaunch worked through USB Metro.

Additional live results:

- **08:17**: exact-authorized notification arrived with the app backgrounded/screen off. The native record was PRIVATE and showed the generic Maivelle title. Its tap opened the correct medicine. Taken count remained unchanged; firing did not log a dose. Airplane mode was off at the later check, so this is not counted as an offline-delivery pass.
- Exact permission revocation was detected on relaunch; one approximate reminder remained scheduled and the reliability warning appeared. Restoring permission returned to one exact reminder without duplicates. Android's revocation restart can return this debug build to its development-client launcher; reconnect the existing local USB Metro URL.
- **08:51**: a notification arrived with **airplane mode 1 and Wi-Fi 0 verified immediately before and after delivery**. The native record was PRIVATE, generic, and timestamped approximately 89 ms after the scheduled minute. This single observation is not a delivery guarantee.
- Deactivation changed the live pending count to zero and cancelled the native reminder. Reactivation created one replacement. Earlier Taken/Skipped records survived both device restarts and all schedule edits.
- Startup rearming was verified against Android's actual `AlarmManager` after force-stop/relaunch, not only against Expo's serialized request list. The restored future alarm reported `window=0` and `exactAllowReason=permission`.
- Native Notes/database, Tasks and Calendar diagnostic suites passed on the new build. The existing Phase 3 restart probe was still FOUND.
- Medication history navigation and back navigation passed; Taken/Skipped totals remained unchanged after notifications. The main fictional `Phase7-Fictional` fixture was left **inactive**, with history preserved and **zero pending reminders**. Isolated diagnostic databases were cleaned up after passing.

The original device settings were restored and read back: airplane mode **0**, Wi-Fi **0**, plugged-in stay-awake **0**. Notification and exact-alarm permissions remain granted for Maivelle. USB Metro remains available on port **8084**.

### Reboot reliability limitation

**Automatic reboot recovery did not pass on this HONOR.** The first 08:26 attempt was inconclusive because its due time elapsed before inspection. For the longer 08:38 attempt, boot had completed before the deadline, but no restored native alarm or delivered notification was found. The serialized request remained, notification/exact permissions were granted, and the primary app was not stopped. No definitive Expo error established the cause. Airplane mode also returned to off across the reboot, so neither boot attempt establishes offline boot delivery.

The app now explicitly instructs the user to **open Maivelle after restarting the phone**. Startup/foreground rearming restores future reminders with stable native IDs; elapsed reminders are not backfilled as alerts or marked Taken. Review [HONOR's alarm startup/background guidance](https://www.honor.com/global/support/content/en-us00409667/) and retest on the device before relying on automatic boot delivery. No global battery policy or lock-security setting was changed to make the test pass. A secure PIN-lock delivery test remains manual: the observed primary-user state was not securely locked, although the screen-off/background test passed.

Only fictional fixtures are used. The first short reminder's scheduled minute elapsed during UI verification before the intended screen-off step; the expected pending count correctly became zero. The delivery test was rescheduled rather than treating this timing mismatch as an application failure. Test helpers were corrected for retained scroll positions, clipped button bounds and taps consumed by scroll momentum. SDK ADB 41 also encountered an older ADB 39 server during reconnection; the device was reauthorized/reconnected without resetting application data.

## Native configuration and platform limits

The merged installed manifest declares `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` and `SCHEDULE_EXACT_ALARM`, without `USE_EXACT_ALARM`. Permission is requested only by explicit Medicine buttons. Exact-authorized date triggers use `alarmClock`; unauthorized triggers use Expo's `bestEffort` fallback. The Medicine channel uses high importance/default system sound and requests private visibility. HONOR reports system-default channel visibility, while the delivered notification itself was verified as PRIVATE; generic title/body remains the primary privacy protection. No medication text appears in notification content.

The SDK 58 channel API initially warned that the string `sound: 'default'` was a missing custom resource. The final code omits channel.sound to select Android's default; no custom asset/package or warning suppression is used. Prebuild also reported the existing optional `expo-system-ui` recommendation for native `userInterfaceStyle`; it was not added to expand this phase's dependencies. Native build warnings include upstream Gradle/Kotlin/CMake deprecations and cross-volume hard-link copy fallbacks; compilation still succeeded.

The queue is limited to seven local dates and 100 earliest reminders. Reopening/foreground/mutations reconcile it; no indefinite background refill is implemented. Android/HONOR battery policy, Doze, force-stop, reboot/unlock, channel blocking and exact-alarm revocation can delay/prevent reminders. Reopen after clock/timezone changes. See [medicine.md](medicine.md) for recurrence, history and grace conventions. Exact delivery is not guaranteed.

Development storage is still **unencrypted and synthetic-only**. SQLCipher availability does not verify file encryption. Production key provisioning/recovery and exclusive-transaction key initialization must be established before lifting the existing production gate. The development client needs USB Metro for JavaScript cold startup; standalone release behavior remains unverified/blocked by that gate.

## Changed files

| Area | Files and purpose |
| --- | --- |
| Database | `src/database/migrations/006-medicine.js`, migration index, `repositories/medicineRepository.js`, `DatabaseProvider.js`: append schema, transactional revisions, CRUD/history/jobs, service wiring |
| Routes | Replace `src/app/medicine.js` with `medicine/_layout.js`, `index.js`, `today.js`, `new.js`, `[id].js`, `edit/[id].js`, `history/[id].js`; root layout adds notification lifecycle wrapper |
| Validation/services | `src/features/medicine/validation/medicineInput.js`, `services/medicineService.js`, `services/doseOccurrences.js`, module `package.json` |
| Hooks | `useMedicine.js`, `useMedicineEditor.js`: refresh subscriptions/focus/foreground, loading/errors, editor/unsaved protection |
| UI | `MedicineLibrary`, `MedicineToday`, `MedicineDetails`, `MedicineEditor`, `MedicineFields`, `MedicineControls`, `DoseCard`, `UpcomingMedicine`, `medicineStyles` under `src/features/medicine/components` |
| Notifications | `src/services/notifications/localNotifications.js`, `medicineReconciler.js`, `MedicineNotificationsProvider.js`, module `package.json`; app.json native plugin/permission |
| Dashboard | `HomeDashboard.js`, `ModuleGrid.js`, `UpcomingItems.js`, `dashboardData.js`: live medication summaries/upcoming items, suppress obsolete Medicine sample |
| Verification | `tests/database/medicine.test.cjs`, SQLite adapter transaction support, approved-table assertion; `nativeMedicineDiagnostics.js` and diagnostics route button |
| Documentation | `medicine.md`, this report, architecture, local-database and development-setup updates |

`package.json` and `package-lock.json` remain the user's preexisting dependency updates, not new Phase 7 package edits. No additional dependency was installed during implementation.

## Remaining manual acceptance

Automatic reboot recovery, secure PIN-lock delivery, long-duration HONOR battery saver/Doze suppression, queue exhaustion/refill over seven real days, dense queues, notification-channel blocking, accessibility/TalkBack/enlarged fonts, alternate keyboards, device timezone/DST/clock changes and low-disk/interrupted native writes still require manual acceptance. Host adapters cannot simulate all OEM behavior. Historical recorded actions are intentionally final in this phase; no correction or destructive deletion workflow is added. No real health data should be used until encryption and retention policy are verified.
