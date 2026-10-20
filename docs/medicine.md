# Medicine — Phase 7

Medicine is a local SQLite medication library, daily dose tracker and Android local-reminder queue. It does not recommend medication, dosage, treatment or responses to a missed dose. Users supply their own instructions. No push tokens, remote notifications, backend, analytics or calendar copies are used.

## Security boundary

**The existing development database is unencrypted. Enter fictional, nonsensitive records only.** SQLCipher support, SecureStore dependency, disabled backups and the production fail-closed database gate are preserved. These do not establish encrypted storage: production key provisioning/recovery remains unresolved, and release startup remains blocked. Reminder titles/bodies are generic; medication names and instructions never appear in notification content or application logs. Native notification data contains only internal identifiers and delivery metadata. The channel requests private lock-screen visibility; Android/user settings ultimately control visibility. HONOR reports system-default channel visibility, while the delivered notification itself was verified as PRIVATE. Generic content remains the primary notification privacy protection.

## Navigation and ownership

- `/medicine`: searchable active/inactive/all library, reminder capability and add action.
- `/medicine/today`: today's doses, date navigation, Taken/Skipped, live daily totals.
- `/medicine/new`, `/medicine/edit/[id]`: validated form, daily/selected-weekday schedules, multiple times, optional inclusive dates, unsaved-change protection.
- `/medicine/[id]`: details, schedules, edit, deactivation/reactivation and history.
- `/medicine/history/[id]`: navigable seven-day history windows, recorded actions and derived pending/due/missed state.

Thin Router screens compose `src/features/medicine/components`. Hooks own refresh and editor state; services own validation, bounded occurrence generation and mutations; `medicineRepository` owns parameterized SQL. `DatabaseProvider` supplies the existing owned connection. No persistent store is duplicated in Zustand. FlatLists render library/dose rows; theme tokens and shared layout/buttons/cards are reused.

## Schema and migration safety

Migration **6** appends four tables to migrations 1–5 without rewriting them:

| Table | Purpose |
| --- | --- |
| `medicines` | Stable UUID, user text, active status, inclusive dates, optimistic revision, UTC creation/update timestamps |
| `medicine_schedules` | Immutable schedule revisions, weekday/time JSON, optional schedule dates, snapshots of medicine boundaries/name/instructions, local effective/retirement boundaries, current-definition flag |
| `medicine_dose_logs` | Stable occurrence primary key, schedule/medicine composite FK, scheduled local time and UTC instant/timezone, Taken/Skipped, separate actual UTC action time, historical text snapshots |
| `medicine_notification_jobs` | Occurrence/schedule/native IDs, UTC trigger time, delivery mode, reconciliation timestamp |

Indexes cover active-name lists, schedule revisions/ranges, dose history and reminder schedules. Medicine/schedule deletion is restricted so history cannot cascade away. The UI deactivates records instead of deleting them. The existing transactional migration ledger, foreign keys and WAL settings remain in force; repeated startup never resets data.

Parent edits and schedule revision replacement use an exclusive async SQLite transaction. Expo uses a temporary native handle for this transaction; the repository explicitly checks foreign-key integrity before commit because connection PRAGMAs may not be inherited. Optimistic parent revisions reject stale editors. Schedule changes, name/instruction changes, medicine dates and activation changes retire old schedules and create new definitions atomically. Form/notes-only edits retain schedule IDs. Removing all schedules is supported. Reopening an inactive medicine uses its preserved current definitions. Future production key provisioning must also cover Expo's exclusive-transaction handle before lifting the existing encryption gate.

## Time, occurrences and history

- Dates are civil `YYYY-MM-DD`, times are 24-hour `HH:mm`, weekday numbers are Sunday=0 through Saturday=6. All selected weekdays means daily. Medicine and schedule bounds intersect; endpoints are inclusive.
- Each occurrence ID is `schedule UUID/YYYY-MM-DDTHH:mm`. It remains stable across app restarts and timezone changes for that schedule's local slot. A unique `(schedule_id, scheduled_local)` constraint also prevents duplicate logs.
- Initial schedules begin at midnight on the creation date: earlier times that day can be reviewed retrospectively. Edited schedules begin at the save's local timestamp, including milliseconds; older revisions continue to supply earlier occurrences. No earlier dates are fabricated before initial creation.
- Local effective boundaries are nondecreasing per medicine even if the phone clock moves backwards. A new revision then waits until the prior boundary, preventing overlaps with history. Correct the phone clock before editing; do not use clock changes to rewrite dose history.
- Times follow the **current phone timezone**, not a fixed home timezone. Spring-forward nonexistent times are skipped. Fall-back repeated times produce one occurrence at the first matching instant. No automatic make-up dose is generated. These conventions describe tracking, not medical advice.
- Recorded actions retain their original scheduled UTC instant and timezone even if the phone timezone later changes. Unrecorded occurrences are reinterpreted on the current local clock. Reopen Maivelle after changing timezone/date/time so native one-off UTC triggers can reconcile. While JavaScript is stopped, the queue cannot recompute its timezone interpretation.
- **Missed** is derived when an unlogged occurrence is at least **60 minutes** past its scheduled instant. It means no recorded action, not proof that medication was not taken. Pending is before the scheduled time; Due is the following grace period. Missed is never written as a fabricated dose action.
- Taken/Skipped are available at/after scheduled time, and preserve a separate actual action timestamp. The first saved action is final in this phase. Duplicate taps/actions are rejected, not silently overwritten. A notification firing never marks Taken.
- Reads allow 1–93 days, at most 1,000 relevant schedule revisions and 5,000 dose occurrences/history rows. Library searches allow 500 matching medicines. Guardrails fail visibly rather than silently truncating records. Schedule limits are eight per medicine and twelve times each; overlapping weekday/time slots are rejected.

## Android local reminders

Installed versions inspected for this phase: Expo **58.0.16**, Router **58.0.24**, Notifications **58.1.5**, SQLite **58.0.13**, React Native **0.88.0**. The user had already installed the Expo/Router updates and Notifications package before Phase 7 changes.

`app.json` configures the Notifications plugin, purple default color/channel, `enableRemoteNotifications: false` and `android.permission.SCHEDULE_EXACT_ALARM`. The library contributes `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED`. `USE_EXACT_ALARM` is deliberately not requested. Expo's Android library includes remote/Firebase-related native classes/metadata, but Maivelle does not configure Firebase, fetch push tokens, register with a push server or call remote notification APIs.

`MedicineNotificationsProvider` loads infrastructure after database initialization, creates `maivelle-medicine`, checks notification/channel and exact-alarm capability without prompting, reconciles on startup, medicine changes, foreground and every minute while active, and handles notification taps into the matching Medicine details screen. Permission requests occur only when the user presses Enable reminders or Allow exact alarms. Notification denial does not prevent dose tracking.

With exact-alarm authorization, one-off date triggers use SDK 58 `delivery: 'alarmClock'`; otherwise they use `bestEffort`. Expo falls back to inexact Android alarms without authorization. The UI reports permissions, pending count, reliability limits and errors. Android app settings provide channel/system controls. Exact-alarm permission revocation may restart the process and remove alarms; reopening reconciles from SQLite and the actual native queue.

The rolling horizon is the rest of today through the following six local dates, up to **100** earliest pending reminders. Near the cap, users are explicitly told to open daily. The queue is replenished only while Maivelle runs; **open at least weekly**, more often for dense schedules. There is no indefinite background scheduler. Expired, taken, skipped, inactive and replaced occurrences are excluded. A fixed native identifier and owner marker allow recovery if scheduling succeeds but the SQLite ledger write is interrupted. Reconciliation inspects Expo's native persisted requests, repairs missing requests/ledger entries, removes stale entries and cancels only Medicine-owned notifications. Android can remove an actual alarm while Expo still retains its serialized request, so startup/foreground and explicit refresh rearm stable native IDs. This replaces existing alarm identities without duplicates; periodic unchanged refresh avoids extra SQLite writes. Other modules' notifications are never bulk-cancelled.

Expo persists native scheduled requests and includes a boot receiver intended to restore them after reboot/package replacement. **Automatic reboot recovery did not pass on the tested HONOR**: a serialized request and granted permissions remained, but no native alarm was restored before its due time. No definitive error established the cause. **Open Maivelle after restarting the phone to restore future reminders.** The UI states this requirement. Retest automatic boot delivery after reviewing HONOR App launch/battery settings with the device owner; Maivelle does not silently bypass those controls. Recovery can restore only the bounded queue, not an unlimited future schedule. Android Doze, OEM battery management, user channel settings, exact-alarm revocation, force-stop and restart/unlock policies can affect delivery. Force-stop prevents reminders until the app is reopened. **Delivery is not guaranteed**, including with exact permission.

## Local native rebuild

Adding Notifications and its native permissions/plugin requires prebuild and a new local Android development build. JavaScript reload alone is insufficient. From a terminal configured as in [development-setup.md](development-setup.md):

```powershell
$env:ANDROID_HOME = 'C:\Android\Sdk'
npx.cmd expo prebuild --platform android --no-install
npm.cmd run start:usb -- --port 8084
# A second terminal, with the physical phone authorized:
adb devices -l
adb -d reverse tcp:8084 tcp:8084
npx.cmd expo run:android --device AFAM026324010734 --no-bundler
```

Substitute the actual serial/Metro port. SDK 58 does not allow `--port` together with `--no-bundler`; launch the installed development client against the existing USB Metro URL using the development guide. Prebuild may regenerate an outdated ignored Android template. No hand edits to generated native files are required. Installing an update preserves storage; do not uninstall or clear data.

The development client needs USB Metro for JavaScript on cold start. This phase does not demonstrate standalone release startup: the production encryption gate intentionally blocks it.

## Verification and manual acceptance

Run `npm.cmd run test:database`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run check:dependencies` and `npm.cmd run doctor`. Host tests use the real SQLite engine, injected notification adapters and deterministic clocks; they cannot prove delivery by Android. Development-only Database diagnostics adds native Medicine fixtures in an isolated file, including migration/reopen preservation. Normal records are never reset to run diagnostics.

See [phase-7-verification.md](phase-7-verification.md) for actual results, changed files and remaining device checks. Required acceptance includes notification permission denial/grant, exact-alarm denial/grant/revocation, channel blocking, short reminders while backgrounded/locked, tap navigation, device restart before delivery, airplane mode with Wi-Fi off, timezone/DST changes, HONOR battery controls, queue refill after seven days, accessibility/font scaling and low-disk/interrupted writes. Test with fictional records only.

## Official references

- [Expo SDK 58 Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) — local scheduling, permission APIs, delivery modes, channels, boot receiver and notification response navigation.
- [Expo SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/) — async statements and exclusive transactions.
- [Android alarms](https://developer.android.com/develop/background-work/services/alarms/schedule) — authorization and alarm lifecycle restrictions.
- [Android notification permission](https://developer.android.com/develop/ui/views/notifications/notification-permission) — Android 13+ user permission.
- [HONOR third-party alarm troubleshooting](https://www.honor.com/global/support/content/en-us00409667/) — review the app's startup/background permissions and battery controls, then retest; this does not establish the cause of the observed boot failure.
