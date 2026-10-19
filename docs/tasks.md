# Tasks — Phase 5

Tasks uses the existing process-owned SQLite connection, migration runner, purple theme and Expo Router. No package, cloud service, analytics, notification scheduler or persistent JavaScript record store was added. **Development storage remains unencrypted and synthetic-only.** SQLCipher configuration and the production encryption gate are unchanged; see [local-database.md](local-database.md).

## Routes and architecture

| Location | Responsibility |
| --- | --- |
| `src/app/(tabs)/tasks.js` | Existing Tasks bottom tab, now the task library |
| `src/app/task/new.js` | Create task |
| `src/app/task/[id].js` | Details/edit by stable ID, with missing-ID recovery |
| `src/app/task/categories.js` | Create, rename and remove task categories |
| `src/features/tasks/components/` | FlatList library, editor, checklist, categories, dashboard today list, controls and feature styles |
| `src/features/tasks/hooks/` | Focus/foreground refresh, pagination, summaries, editor loading/saving and unsaved-change guard |
| `src/features/tasks/services/` | Mutation notifications, validation boundary and clock-based deadline calculations |
| `src/features/tasks/validation/` | Titles, priorities, statuses, stable IDs and calendar input validation |
| `src/database/repositories/tasksRepository.js` | Async SQLite operations and reviewed query fragments with bound values |

`DatabaseProvider` constructs `tasksService` alongside the existing Notes services. SQLite remains the source of truth. Service subscriptions invalidate views after successful mutations; views reread the database. Clock-dependent lists and summaries refresh every 30 seconds while focused and on foreground/focus. Overdue state is calculated, never stored as a stale boolean.

The library fetches 50 tasks per page, virtualizes cards, supports pull-to-refresh, and handles loading/empty/error states. Search covers title and description as literal substrings. SQLite's built-in lower-case conversion folds ASCII; non-ASCII case variants match literally. Search inputs, dates, categories and pagination are bound parameters. Filter/order SQL comes only from reviewed constants. No SQL is executed by presentation components.

## Task behavior

- Nonblank title, maximum 240 characters; optional description, maximum 100000 characters.
- Priority: Low, Medium (default), High, Urgent. Status: To Do (default), In Progress, Completed.
- Optional category and deadline. Dates use `YYYY-MM-DD`; times use `HH:mm` in the 24-hour clock. Time requires a date. Invalid calendar dates and invalid/nonexistent local times are rejected. No native date-picker package was added.
- Editing keeps the same ID and `created_at`; modifications update `updated_at` without moving it backward if the clock moves backward.
- Completing sets `completed_at`; editing an already completed task preserves that completion timestamp. Reopening clears it. Completing/reopening never silently changes the subtask checklist.
- Delete requires native confirmation. Cancelling makes no change. Header/hardware navigation warns about unsaved task/checklist drafts; saves prevent duplicate submissions.

Subtasks become available after the parent is saved. Add, rename, check/uncheck and confirmed delete save immediately. Progress is shown as completed/total in the editor and task cards. Checklist completion does not automatically complete the parent. Finish or cancel a checklist draft before saving the parent form; already saved checklist changes remain when a task-form draft is discarded. Parent timestamps are touched by database triggers when its checklist changes.

Category creation/renaming saves immediately. Removing a category asks for confirmation and leaves its tasks as Uncategorized. Names are trimmed, unique and limited to 80 characters. Category changes made in the manager persist independently of an unsaved task form.

## Deadline, filter and sorting decisions

Deadlines are **local calendar dates and wall-clock times**, following the device's current timezone. They do not represent a UTC midnight or a timezone-bound appointment. A date-only task remains due throughout that local day and becomes overdue on the next day. A timed task becomes overdue after its selected local minute begins (`HH:mm:00`); at exactly that instant it is due, then overdue immediately afterward. Completed tasks are never overdue. Changing the device timezone changes the interpretation of these floating local deadlines. Ambiguous repeated times during a daylight-saving fallback remain wall-clock deadlines; this phase does not schedule alarms or claim absolute-instant scheduling.

| Filter | Contents |
| --- | --- |
| Today | Incomplete tasks whose due date is today, including earlier timed deadlines |
| Upcoming | Incomplete tasks on a later calendar day; later times today remain in Today |
| Overdue | Incomplete date-only tasks before today and timed tasks whose date/time has passed |
| Completed | Completed tasks, regardless of date |
| All | All tasks, including unscheduled and completed tasks |

Category filtering combines with search/date filters. All categories, one category and Uncategorized are supported.

Due-date sorting puts incomplete tasks first, then earliest deadline (all-day tasks at the end of their date), then recently updated and stable ID; unscheduled tasks follow dated tasks. Priority sorting orders Urgent, High, Medium, Low within incomplete/completed groups, then deadline/update/ID. Recent sorting uses updated time descending and ID as a stable tie-breaker. No task is duplicated to implement filters.

## Migration 4

Migration 4 creates only `tasks`, `task_categories`, and `subtasks`. Existing migrations 1–3 and their exact SQL are unchanged. The original initialization transaction and history checks make repeated startup idempotent and preserve Notes/settings.

- Stable text IDs, UTC ISO timestamps, nonblank/length checks, constrained priority/status values, validated date/time shapes and consistent completion timestamps.
- Nullable `tasks.category_id` uses `ON DELETE SET NULL`, preserving tasks when categories are removed.
- `subtasks.task_id` uses `ON DELETE CASCADE`. Parent deletion and all child deletions/triggers occur in the same SQLite statement transaction; a failed deletion rolls back the cascade.
- Indexes support status/deadline queries, recent updates, category lookups and ordered parent checklist reads. No table reset or automatic reseeding is performed.

Repository methods: `createTask`, `getTaskById`, `listTasks`, `updateTask` (full validated form), `deleteTask`, `setTaskStatus`, `summary`; category CRUD; subtask create/list/update/delete. The service uses the same method names and requires explicit confirmation for deletions. Missing reads return null; missing updates raise `NOT_FOUND`; database failures retain meaningful codes/messages. SQL never embeds user values.

## Dashboard and validation

The Tasks card displays the incomplete count and how many are due today. Today's tasks displays up to three incomplete local records and links to their editor. The old sample task in Upcoming is suppressed; Calendar/Medicine samples remain. Notes counts and navigation are preserved.

```powershell
npm.cmd run test:database
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run check:dependencies
npm.cmd run doctor
```

The host suite uses real SQLite. Native development diagnostics includes **Run native task checks**, using only its own UUID-named isolated fixture. Failed diagnostic files are retained for investigation; the application database is never deleted.

Phase 5 JavaScript, routes and SQL migration require a reload/relaunch of the existing Phase 3+ development client, not a native rebuild. Startup migrations run before services are published; force-stop/relaunch for a schema change rather than relying on Fast Refresh to reinitialize an open connection. New native dependencies or configuration changes still require a Windows local rebuild. Follow [development-setup.md](development-setup.md) for USB Metro. A cold development-client launch requires local Metro; this is separate from internet connectivity.

See [phase-5-verification.md](phase-5-verification.md) for results, device coverage and unresolved warnings. Recurrence, scheduled notifications and the next feature module are outside Phase 5.

## Official references

- [Expo SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)
- [Expo SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/), including usePreventRemove and useFocusEffect
- [React Native FlatList](https://reactnative.dev/docs/flatlist), [TextInput](https://reactnative.dev/docs/textinput), and [AppState](https://reactnative.dev/docs/appstate)
