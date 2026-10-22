# Plan interface redesign

Updated 22 October 2026 from the supplied Month, Day and Create Event reference.
The existing routes, recurrence engine, repository and unsaved-change handling
remain the foundation.

## Presentation and controls

Lavender vector petals and purple gradient controls replace the earlier flat
selected tabs, selected date, floating action and Save event button. Dark theme
retains existing tokens. Month/Week/Day, Today, navigation, search, real categories,
completed-task visibility, series management and virtualized agendas remain.
Day's Back action returns to Month. Quick Add opens Event, Task, Location or Note.

The month grid now displays complete weeks containing the month (four to six
rows), giving October 2026 five rows. Its existing 42-day database query remains.
Focus time now reads actual Time Tracker segment totals for the selected day or
week, refreshed by the existing tracker hook. Planned event duration remains
separate, combining overlapping intervals. No fake counts or focus goal are used.

Time dialogs replace typed HH:mm with independently scrollable Hour, Minute and
AM/PM selection columns, supporting all 60 minutes. Apply commits; Cancel/Back
leaves the form value unchanged. Date dialogs retain a grid and YYYY-MM-DD entry.
Existing date/DST/order validation, multi-day/all-day conventions, category
creation, recurrence and occurrence exception handling remain intact.

The privacy banner states local storage, without claiming the unkeyed development
database is encrypted. Exact visual matching and picker accessibility have not
been verified on the HONOR; the user's QA pause remains in effect.

## Working local reminders

The selector supports None, At start, 5/10/15/30 minutes, 1 hour and 1 day before.
Existing and new events default to None. All-day reminders are relative to local
midnight, explicitly stated in the form.

Migration **11 — calendar-reminder-lead-times** appends nullable, constrained
`reminder_minutes` columns to events and occurrence exceptions. Earlier migration
SQL and existing records remain intact. The existing transactional migration
runner applies it once at startup. All repository values remain parameterized.
Edited occurrences have their own selection; cancelling removes the effective
occurrence and restoring reinstates the series reminder.

The pure `calendarReminderPlan` uses CalendarService's effective occurrences.
`CalendarNotificationsProvider` serializes reconciliation on startup, calendar
mutations, foreground and active minute ticks. It schedules up to 64 future
requests within 30 days. Owner/occurrence identifiers and trigger timestamps
avoid duplicates and replace obsolete requests. Past reminder deadlines and
nonexistent recurring DST wall times are skipped.

The `maivelle-calendar` channel and `maivelle.calendar.v1` owner keep Medicine
requests separate. Notifications contain generic text, not event titles,
locations or descriptions. Taps resolve the event before opening its editor.
Permission is requested only through an explicit button. Denial retains event
preferences; obsolete requests can be cancelled, and requests rebuild when
permission returns. Plan and Settings show permission, failure and retry states.

Delivery uses the installed SDK 58 Notifications DATE trigger with **bestEffort**.
No exact-alarm permission or punctual-delivery guarantee is introduced. Android
power settings, channels and permission can delay or prevent delivery. Open
Maivelle regularly to extend the scheduling window; no indefinite background
scheduler is claimed. See [official SDK 58 Notifications documentation](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/).

Restore drains the old provider and cancels its Calendar-owned requests before
connection closure. New providers rebuild from restored events. Native request
identifiers are derived data, not exported records.

## Backup compatibility

New snapshot and portable logical archives identify schema 11. Reviewed schema
10 backups remain supported. Snapshot schema is compared against a matching
reference before staging-only migration, then checked against the current schema.
Logical schema 10 records import into current staging tables with null reminders;
their original ledger rows survive and the reviewed migration 11 ledger entry
is appended. Invalid columns/ledger or an interrupted stream rolls back staging.
No archive-supplied SQL is executed. Encryption, KDF policy, Vault key handling
and production provisioning are unchanged.

## Verification

Lint and application/tooling TypeScript checks passed. The dependency lockfile
matches the existing SHA256 baseline. Added regression cases cover schema 10
preservation/idempotency, reminder CRUD/recurrence, validation/constraints, bounded
plans and schema 10/11 logical recovery. These cases and existing automated
suites have **not been executed**, respecting the testing pause.

No phone operations, explicit live migration, reset, uninstall, key change,
dependency or native configuration change occurred. Metro reload loads this
source and the normal additive migration; no native rebuild is required.

Pending resumed verification: visible layouts, picker gestures/font accessibility,
notification delivery/denial/reboot/timezone behavior, reminder taps, restore
reconciliation, database migration/recovery cases and module regressions.
The implementation is not claimed physically verified or production ready.
