# Time Tracker — Phase 8

The `/timer` placeholder is now an offline Time Tracker. `/timer/projects` manages activities, `/timer/history` lists completed sessions, `/timer/new` adds manual time, `/timer/[id]` edits a saved session, and `/timer/statistics` shows current-day, Monday-based week and month totals. The dashboard Timer shortcut and focus quick action keep their existing URLs. Only the Timer summary becomes live; earlier module summaries remain intact.

## Storage and state transitions

Migration **7**, `007-time-tracker.js`, appends three tables without modifying migrations 1–6 or resetting any data:

| Table | Purpose and constraints |
| --- | --- |
| `time_projects` | UUID, nonblank name, description, validated hex color, archive flag, UTC creation/update timestamps. |
| `time_sessions` | UUID, nullable project FK with SET NULL, activity name/color snapshot, title, timer/manual source, running/paused/completed status, revision, UTC creation/update timestamps. A partial unique index permits only one running or paused session. Manual sessions are completed. |
| `time_session_segments` | UUID, session FK with CASCADE, integer UTC epoch milliseconds for start and optional end, nonnegative duration. A partial unique index permits one open segment per session. Triggers reject missing parents, overlapping inserted segments and closing sessions with an open segment. |

The repository owns SQL. All record values use bindings. Multi-record operations use SDK 58 `withExclusiveTransactionAsync` and its supplied transaction handle. Writes are serialized within the repository; the service rejects concurrent mutations. Expected revisions prevent stale screen actions from toggling state twice. SQLite constraints remain the final safeguard against another writer. Transaction failures roll back parent and segment changes together. Because Expo's temporary exclusive handle may not inherit connection PRAGMAs, the repository explicitly handles dependent deletions and runs `foreign_key_check` before commit. The existing owned connection still enables WAL and foreign keys.

| Action | Required state | Atomic change |
| --- | --- | --- |
| Start | No active session, unarchived activity | Insert running session and open segment. |
| Pause | Running, expected revision | Close open segment; mark paused. |
| Resume | Paused, expected revision | Mark running; insert a new segment. |
| Stop | Running or paused, expected revision | Close open segment if present; mark completed. |
| Reviewed recovery | Running, expected revision | Close open segment at the user-entered UTC end; mark completed. |
| Discard | Running or paused, expected revision | After UI confirmation, delete its segments and session transactionally. |

Creation timestamps and stable session IDs are preserved on edit. Update timestamps never regress. Timer history editing retains separate active segments rather than converting the entire span, including pauses, into tracked time. Editing keeps the timer/manual source. Segment IDs may change during an explicit completed-session edit; segment replacement and parent edits are one transaction. Segment inputs must be ordered, non-overlapping, nonnegative and not in the future. Zero-duration entries are permitted in history and contribute no analytics time. Sessions can overlap other sessions (for example a retrospective manual entry); analytics explicitly count these independently.

Activities can be edited, archived, restored or deleted. Archived activities disappear from new-session selection but existing timers can finish and existing history can retain the activity. Deletion is blocked while that activity has an active timer. Deleting otherwise nulls session references while preserving snapshots and segments. Reassign a deleted activity before saving edits to one of its historical sessions. Live activity statistics use current name/color when the activity still exists; deleted activities use snapshots. History retains the saved activity name. Deletion and discard require confirmation; editor navigation warns about unsaved changes.

## Persistence, reboot and clock limitations

Persisted segment timestamps are the source of truth. Elapsed milliseconds are the sum of closed segment durations plus `max(0, now - openStart)` for a running segment. No incrementing counter, continuous writes, background task, foreground service, alarm, new permission or network connection is needed. Display intervals refresh only while their screen is focused and the app is active; foreground/focus reloads restore SQLite state. Dashboard summaries also refresh after successful mutations and periodically while active.

A running timer includes elapsed wall-clock time while the app is backgrounded, force-closed, or the device is powered off. Reopening finds the same active session and open segment. This is **an estimate**, not proof that the user worked throughout the gap. No automatic boot receiver or JavaScript execution at boot is required: recovery happens when Maivelle opens. The running screen always explains this and offers a reviewed UTC end time. Use **Use current time**, adjust as needed, then **End at reviewed time**; the confirmation saves that end. Remaining historical timestamps can be corrected in the editor.

Device wall-clock changes can distort the estimate. While the timer screen remains mounted, a wall-clock/performance-clock difference over five seconds raises a warning; the performance clock is only a diagnostic, not persisted truth. After process death or reboot there is no cross-boot monotonic anchor, so a forward jump cannot be reliably distinguished from real elapsed time. Negative provisional durations are clamped to zero. Backwards-clock transitions that would produce negative or out-of-order segments fail visibly; recovery can end a running segment at its own start when the current clock is earlier. A paused timer can stop without adding time even after rollback. Resume requires a clock at or after the last segment end. No claim of exact timing during shutdown, clock edits or long suspension is made.

## History and analytics

History uses a paginated `FlatList` (50 per page), activity and timer/manual filters, and optional UTC overlap-range filters. Apply filters explicitly. UTC fields use `YYYY-MM-DDTHH:mm:ss.sssZ`; `Z` means UTC, not the phone's local clock. The optional end is exclusive. The UI displays local dates alongside history, but canonical UTC inputs avoid silently resolving ambiguous DST local timestamps. A session matching a range shows its full active duration; statistics instead clip each segment to the selected period. Completed history excludes the separately displayed active session.

Analytics read persisted segments from SQLite, clip open segments at the current time, exclude pauses, and split at local calendar midnight. Calendar arithmetic, rather than adding 24 hours, handles 23/25-hour DST days. Changing the phone timezone regroups the same UTC instants into that timezone's dates. A session count counts distinct sessions contributing positive time to the period, even with multiple segments. Daily totals, activity totals and the selected-period total use integer milliseconds. Formatting truncates only the displayed seconds; no floating-point hours are persisted. The installed `react-native-svg` renders responsive bar charts with exact text totals alongside them; no chart dependency was added.

## Security and Android build

The existing SQLCipher native configuration, SecureStore dependency and production `ENCRYPTION_REQUIRED` gate are preserved. The development database remains **unencrypted and synthetic-only**. SQLCipher being compiled does not encrypt it. Do not enter real personal or sensitive activity data. Key provisioning, encrypted connections (including temporary transaction handles), backup and recovery policy remain separate unresolved security work. This phase does not enable production storage.

No dependency, manifest, native plugin or permission changes are required for Phase 8. The already installed Phase 7 development build has SQLite, SQLCipher, SVG and Router. Reload JavaScript through USB Metro; a native rebuild is needed only if that installed build lacks those modules or if native configuration changes. No emulator or cloud build is involved. Development-client cold launches still need Metro over USB; this does not establish a standalone production release. Medicine's previously documented automatic reboot notification recovery limitation remains unchanged.

## Physical HONOR manual checks

Use synthetic fixtures only. Keep the USB Metro reverse port configured as in `development-setup.md`.

1. Open Timer → Activities. Create a fictional activity, edit its description/color and select it on Timer. A blank session title must fail without starting anything.
2. Start a session. Double-tap Start/Pause/Resume/Stop; only one active session/segment should result. Pause, wait, resume twice and stop. History should exclude all paused intervals.
3. While running, go Home, wait, return. Force-stop Maivelle, launch the same development client over USB and return to Timer. The same title and elapsed estimate should recover.
4. While running, reboot the phone, unlock it and re-establish USB debugging/reverse as needed. Open Maivelle and Timer. Review the recovered estimate, including the power-off interval, and use a reviewed end if that time should not count. No boot-time app execution is expected.
5. Add a manual session with UTC start/end in the past. Edit its title/activity/timestamps. Try invalid dates, reversed/future/overlapping segments and blank titles. Verify an unsaved-change warning on Back. Cancel a delete, then confirm it.
6. Enter a nonsensitive session spanning local midnight. Check both daily totals and this week's/month's activity distribution. A paused timer's gaps must not appear in the totals.
7. Archive its activity, verify new Start excludes it, and verify history/totals remain. Restore it. Delete an inactive activity after confirmation and verify history remains with its snapshot name.
8. Enable airplane mode and disable Wi-Fi; verify actual settings, then create/stop/edit/filter a session and view Statistics over USB Metro. Restore the original device settings afterward.
9. Check Home's live Timer duration/status and Notes/Tasks/Calendar/Medicine summaries; open those routes. Use `/database-diagnostics` to run isolated native suites. Never Clear storage, uninstall or reset the application to resolve a test issue.

See `phase-8-verification.md` for executed results and checks still requiring manual verification.

## Official references consulted

- [Expo SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/) — async bindings, exclusive transactions, persistence and SQLCipher configuration.
- [Expo SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/) — routes and `usePreventRemove`.
- [Expo SDK 58 SVG](https://docs.expo.dev/versions/v58.0.0/sdk/svg/) — compatible installed native chart primitives.
- [React Native AppState](https://reactnative.dev/docs/appstate) and [timers](https://reactnative.dev/docs/timers) — foreground refresh and display intervals.
