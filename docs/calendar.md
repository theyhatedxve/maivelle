# Calendar — Phase 6

The current Plan/calendar presentation was redesigned on 22 October 2026.
See [Plan interface redesign](plan-redesign.md) for current controls, editor
dialogs, scheduling labels, reminder limitations and verification scope. The
storage, date and recurrence contracts below remain in effect.

Calendar is an in-app offline calendar, built with the existing React Native controls, Expo Router, theme and SQLite connection. No Android system calendar permission, external synchronization, cloud service or additional dependency is used. Local event reminders reuse the installed Expo Notifications package; see [Plan reminder behavior and limitations](plan-redesign.md). **Storage remains unencrypted and synthetic-only; the production encryption gate and SQLCipher/SecureStore configuration are preserved.**

## Navigation and presentation

- `/calendar` remains the Plan bottom tab. Month shows four to six complete weeks and selected-day agenda; Week shows a seven-day strip and the entire week's chronological agenda; Day shows the selected day's agenda. Selecting a week date opens Day view. Previous/Next move by the current view's period; Today selects the current local date.
- `/event/new?date=YYYY-MM-DD` creates an event on the selected date.
- `/event/[id]` edits the parent event/entire series. `/event/[id]?occurrence=YYYY-MM-DDTHH:mm` edits one recurrence instance using its **original** start, even if that occurrence has moved.
- `/event/series` lists all stored parents with pagination, including series whose visible occurrences are cancelled. Open a series to restore its saved exceptions.

The agenda is virtualized with FlatList. Colored event markers and checkbox task markers appear in the grid. Events show their category color/name, times, location, recurrence indicator and edited-instance label. Task deadlines show a checkbox and status, and open the existing Task Details route. Search matches effective event title/description/location and task title/description inside the displayed range. Unicode lower-case substring matching is local; `%` and `_` have no wildcard behavior.

The dashboard Calendar card and Upcoming events section read live SQLite occurrences over the next 30 days, including ongoing events. Notes/Tasks integrations remain intact; the old sample Calendar upcoming item is suppressed. Views refresh on focus, foreground, relevant mutations and every 30 seconds while focused.

## Dates and timezone convention

Dates are civil `YYYY-MM-DD` values. Timed boundaries are **floating local wall-clock** `YYYY-MM-DDTHH:mm` values interpreted in the device's current timezone, matching Task deadlines. They are not UTC instants or timezone-bound appointments. Changing the device timezone changes the interpretation. Date arithmetic uses UTC solely as a civil-calendar calculator, avoiding accidental UTC-midnight day shifts and 23/25-hour day arithmetic.

The editor's all-day end is the **last included date**. Storage uses a half-open interval `[start, end)`, with the end at midnight of the following date. All-day dates never depend on whether local midnight exists. Timed and multi-day events overlap a day only when `start < nextDay` and `end > dayStart`; an event ending at midnight does not appear on the next day. Boundary reads allow adjacent-year grid spillover, and an exclusive end may enter year 9999 so the last supported all-day date remains usable.

Titles are required (1–240 trimmed characters). Descriptions allow 100000 characters and locations 500. Start/end must be valid and ordered. Event duration is limited to 366 civil days. Supported input dates are 1900–9998; query ranges are 1–93 days. The editor rejects nonexistent local timed boundaries during a daylight-saving gap. Repeated fallback times remain floating wall times, without choosing an absolute offset. Recurring timed slots whose start or end falls into a DST gap are skipped; the nominal slot still consumes an occurrence-count limit. No alarm or real-time scheduling promise is made.

## Recurrence and exceptions

Daily, weekly, monthly and yearly rules support intervals 1–365. Weekly rules select Sunday=0 through Saturday=6; the first occurrence is the first matching weekday on/after the parent start. An optional inclusive end date **or** valid occurrence limit (1–10000) can stop a series. Leaving both empty makes the rule logically ongoing, but expansion is always bounded by the query window.

Monthly rules retain the start day-of-month; nonexistent dates are skipped rather than clamped. Yearly February 29 recurs only in leap years, including Gregorian century rules. Invalid month/leap dates do not consume COUNT. Daily/weekly generation scans at most the query window plus the maximum event duration; monthly/yearly generation jumps directly to candidate periods. Month-end COUNT ordinals use a bounded Gregorian cycle calculation, not a walk through the entire series history.

An occurrence is identified by `(parent ID, original start)`. Editing one instance stores a complete override snapshot; cancelling stores a cancellation. Neither creates another parent event. Queries suppress original instances, apply overrides once, and include moved instances in their new date range even when the original lies outside it. Search applies after overrides. Restoring removes the exception and returns that occurrence to the parent definition; already saved occurrence changes persist independently of unsaved form drafts.

Entire-series title/description/location/category edits preserve exceptions. **Schedule, all-day mode or recurrence changes are blocked while exceptions exist.** The series editor lists exceptions and offers confirmed restoration, then allows a schedule change. This avoids silently orphaning or destroying occurrence edits. There is no future-occurrence splitting. Deleting a parent confirms the action and atomically cascades to its exceptions. Cancellation/restoration also require explicit user action.

## Database and architecture

Migration **5** is appended; migrations 1–4 are unchanged. It creates:

| Table | Purpose |
| --- | --- |
| `calendar_events` | Stable UUID, content/location, ordered local boundaries, all-day flag, nullable category FK, validated recurrence JSON, UTC creation/update timestamps |
| `calendar_event_categories` | Stable UUID, unique nonblank name, hex color, UTC timestamps |
| `calendar_event_exceptions` | Stable composite parent/original-start key, cancelled/edited kind, complete edited fields, UTC timestamps; parent FK cascades, category FK sets null |

Recurrence rules are validated JSON on the parent, not a second writable copy of event state. Repository rule CRUD updates this column. This lets creation and parent/rule changes use **one atomic parameterized SQLite statement**, preserving the shared connection model without a second connection or a transaction that could accidentally include Notes/Tasks operations. Schedule changes atomically check exception existence in the update predicate. Exception writes check the observed parent update timestamp and schedule; stale schedule snapshots fail visibly. Parent/exception deletes rely on SQLite statement transactions and FK cascade.

Indexes cover event boundaries, category references and edited exception boundaries. Query guardrails reject more than 1000 source parents, 10000 relevant exceptions, 5000 expanded event occurrences or 2000 task deadlines; they never silently truncate results or reset data. A smaller range or management of old series may be necessary at these limits. The parent-series manager itself uses 50-record pages.

| Location | Responsibility |
| --- | --- |
| `src/app/event/`, Calendar tab | Thin route files and nested stack |
| `src/features/calendar/components/` | Board, agenda/editor/series list, fields, controls and dashboard event cards |
| `src/features/calendar/hooks/` | Focus refresh, stale-response guards, editor loading/saving and SDK 58 unsaved-change protection |
| `src/features/calendar/services/` | Bounded recurrence, date arithmetic, effective occurrences, task projection and change notifications |
| `src/features/calendar/validation/` | Event/rule validation and all-day form conversion |
| `src/database/repositories/calendarRepository.js` | Event/category/rule/exception SQL |
| `tasksRepository.listCalendarTasks` | Read-only bounded task deadline query; no task is copied into `calendar_events` |
| `src/theme/calendar.js` | Category palette using Maivelle colors |

SQLite remains the source of truth. View arrays are transient query results, not another persistent store. Screens never open database connections or contain SQL. No existing data is reseeded or reset.

## Verification and local build

Run the existing database suite, JavaScript checks, lint and Expo diagnostics. `/database-diagnostics` adds **Run native calendar checks** on its own UUID-named isolated synthetic database; success removes only that fixture, and failures retain it for investigation. See [phase-6-verification.md](phase-6-verification.md) for actual results and remaining manual checks.

No native dependency/configuration change was made, so the existing SQLCipher-capable development client needs a reload/relaunch, not a native rebuild. Force-stop/relaunch after migration changes so initialization finishes before routes mount. USB Metro is a local development transport; a cold development client still needs it. Standalone encrypted production startup is not established by this phase. Use [development-setup.md](development-setup.md) for Windows builds and USB commands.

## Official references

- [Expo SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)
- [Expo SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/)
- [React Native FlatList](https://reactnative.dev/docs/flatlist), [TextInput](https://reactnative.dev/docs/textinput), [AppState](https://reactnative.dev/docs/appstate)

Historical Phase 6 scope ended here. Subsequent phases added Medicine and notifications; the current Plan redesign adds local event reminders. External calendar synchronization remains absent.
