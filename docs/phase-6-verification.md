# Phase 6 verification - Calendar events and scheduling

Verified on 19 October 2026 in the existing Windows workspace with the physical HONOR VKJ-NX9 over USB. No emulator, cloud build, backend, external calendar API, notification scheduler or new package was used.

## Implemented and changed files

| Location | Change |
| --- | --- |
| `src/database/migrations/005-calendar.js`, `migrations/index.js` | Migration 5 adds event/category/exception tables, recurrence JSON, constraints and indexes; migrations 1–4 are unchanged |
| `src/database/repositories/calendarRepository.js` | Async bound event/category/rule/exception CRUD, range selection, atomic cascade and stale-schedule guards |
| `src/database/repositories/tasksRepository.js` | Read-only `listCalendarTasks` projection without duplicating tasks |
| `src/database/DatabaseProvider.js` | Calendar service on the existing initialized connection alongside Notes/Tasks |
| `src/features/calendar/services/`, `validation/` | Bounded recurrence expansion, effective exceptions, local date arithmetic, search and form/rule validation |
| `src/features/calendar/hooks/`, `components/` | Month/week/day views, agenda, editor, series manager, loading/error/empty states, category colors and dashboard event cards |
| `src/app/(tabs)/calendar.js`, `src/app/event/{_layout,new,[id],series}.js`, root layout | Functional Calendar tab and thin event routes |
| `src/theme/calendar.js` | Maivelle category palette |
| Dashboard `HomeDashboard`, `ModuleGrid`, `UpcomingItems`, `dashboardData` | Live upcoming Calendar count/cards; existing Notes/Tasks integration retained |
| `src/database/testing/nativeCalendarDiagnostics.js`, diagnostics route | Isolated native Calendar checks |
| `tests/database/calendar.test.cjs`, existing approved-table assertion | Calendar coverage and ten-table schema verification |
| `docs/calendar.md`, architecture/database docs, this report | Conventions, schema, decisions, results and limits |

Existing branding assets, app configuration, native encryption setup, production storage gate, database filename and package dependencies/lockfile were preserved. Existing uncommitted work from earlier phases was not reverted.

## Checks

| Command | Result |
| --- | --- |
| `npm.cmd run test:database` | **59/59 passed**: 23 Calendar tests and all 36 previous database/Notes/Tasks tests |
| `npm.cmd run typecheck` | Passed; JavaScript/JSX with JSDoc checks |
| `npm.cmd run lint` | Passed, zero warnings |
| `git diff --check` | Passed; existing Windows LF/CRLF notices remain |
| `npm.cmd run check:dependencies` | Existing SDK patch recommendations remain |
| `npm.cmd run doctor` | **19/20 passed**; only failure is the same patch-version check |

Installed versions: Expo **58.0.14**, Router **58.0.23**, SQLite **58.0.13**, SecureStore **58.0.2**, React Native **0.88.0**. Expo metadata recommends Expo **~58.0.15** and Router **~58.0.24**. These existing dependencies were not upgraded or excluded from diagnostics. Applying those patches and validating the corresponding local native build remains a separate follow-up.

Host tests use actual Node SQLite. They cover CRUD/confirmation, stable IDs and timestamps, all-day inclusive-form/exclusive-storage conversion, midnight/multi-day overlap, daily/weekly/monthly/yearly rules, interval/count/until, selected weekdays and partial weeks, month ends and leap centuries, moved occurrences both before and after their parent range, cancellation/restoration, stable instance identities, search on effective fields, stale-schedule conflicts, malformed-rule/excessive-duration guards, explicit exception restoration before schedule changes, atomic parent deletion rollback/cascade, category FKs/colors, task projection without event copies, civil view navigation, year-edge month grids, DST and missing-midnight cases in isolated timezone processes, migration preservation/idempotency/rollback, and process restart persistence without networking.

## Physical HONOR results

The existing development binary loaded Phase 6 through local USB Metro on port 8083. No native rebuild was required because no native dependency/configuration changed.

Passed through visible UI/ADB interaction:

- Month/week/day views, next/previous day, selected-day agenda, Today behavior, required-title validation and missing-event recovery.
- Creation of a colored-category all-day daily series with occurrence limit 3; correct all-day date display and original-instance detail route.
- Unsaved-change warning with Keep editing, an individual-instance title edit without changing the adjacent instance, cancellation of another occurrence, and restoration through the parent series manager while preserving the other override.
- Live dashboard Calendar count alongside independent Notes/Tasks counts. Calendar never counted task records as events.
- A task created through the existing Task Manager appeared as a Calendar deadline and opened its existing Task Details route. The task survived event-series deletion.
- Search by event location, including an edited occurrence's new location.
- **Airplane mode ON and Wi-Fi explicitly OFF**, verified through Android settings: force-stop/relaunch retained the series, edited occurrence, and task projection. Event editing/search, one-off creation, cancelled deletion and confirmed deletion worked over USB without internet. Original radio settings were restored (`airplane=0`, `Wi-Fi=1`).
- Confirmed parent-series deletion, independent task/note fixture cleanup, and live Calendar count returning to zero.
- Notes UI create/delete, Notes dashboard count, Tasks dashboard count, native Tasks suite, original native database/Notes suite, and the existing Phase 3 restart probe remained functional.
- The isolated native Calendar suite passed on the final recurrence guard implementation: migration 5 preservation/idempotency; event/category CRUD; task projection; all four recurrence frequencies; invalid month/leap-century handling; cancellation/moved edit/restoration; series edit preserving creation time; all-day overlap/exclusive ends; confirmed parent delete and exception cascade.

The final native suite passed again after recurrence hardening. The full-week agenda, selecting a week date to open Day, Today in Day view and the final Month view also passed. Original display stay-awake setting `0` and radio settings were restored; Calendar was left open and the existing USB Metro remains available on port 8083. Next/previous month, next week, Today resetting the week, Finance/Medicine/Timer/Vault/Budget/Settings routes, More and missing-route/Home recovery also passed. Only the explicitly created synthetic event/task/note records were deleted. The nonsensitive `Phase6-Test` Calendar category remains available for review; the pre-existing Phase 4 test category and older data were retained. Diagnostic UUID-named databases remove only their own fixture after success; no application database was reset or deleted.

Two automation issues were corrected: a below-fold agenda tap landed on the bottom tab bar, and the viewport helper initially tried to scroll native dialog buttons. Scrolling controls fully into view and handling dialog buttons separately resolved both. A Node test-path lint error was corrected before the final passing lint run. No error was silently discarded and no data-reset workaround was used.

## Decisions, limits and further acceptance

See [calendar.md](calendar.md) for complete behavior. Rules live as validated JSON on the parent so event/rule changes stay one atomic SQLite statement on the existing connection. Exceptions use stable parent/original-start keys and complete override snapshots. Series schedule/recurrence changes are blocked until exceptions are explicitly restored, preventing silent loss or orphaning; metadata edits remain available. No future-occurrence splitting is implemented.

Events use floating local wall-clock dates/times, matching Tasks, rather than UTC instants. All-day storage has an exclusive end. Monthly invalid dates and yearly leap dates are skipped without consuming COUNT; nonexistent DST timed slots are skipped but consume their nominal slot. Supported year/range/volume limits fail visibly instead of looping indefinitely or silently hiding results. DST cases were host-tested; device-timezone changes were not injected on the user's phone.

No required Calendar capability is knowingly left unimplemented within these documented conventions. Further manual HONOR acceptance should cover TalkBack, enlarged fonts/display scaling, other keyboards, dense calendars near guardrails, UI interaction with every recurrence option/weekday combination, moving occurrence dates across timezone/DST changes, overnight timed-event presentation and low-disk/interrupted-write recovery. Native diagnostics exercise the underlying recurrence/move logic, but they do not replace every manual UI variation or OS-failure scenario.

**Security is unchanged:** the development database is unencrypted and must contain nonsensitive fixtures only. SQLCipher availability is not verified file encryption. Production initialization still fails closed until encryption keys, recovery and backup policies are established. A cold development client requires local Metro; airplane-mode USB success is not standalone encrypted production acceptance.

No medicine tracking, Android notification scheduling, external calendar synchronization or Phase 7 work was started.
