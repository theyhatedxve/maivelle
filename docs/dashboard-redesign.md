# Lavender dashboard and foreground idle behavior

Updated 22 October 2026 from the user's supplied dashboard reference.

## Dashboard

The Home route now composes small dashboard components: brand header, vector
petals, privacy banner, summary grid, quick actions, today’s focus and recent
notes. Shared styles use the existing purple/lavender theme and support dark
mode. Card/action grids wrap with available width and font scale; the dashboard
scrolls normally, unlike the fixed welcome/account screens.

- Header date and greeting use device-local time and refresh while focused.
  The profile button opens Privacy and Security.
- Four live cards: Vault encrypted-row count, active Notes, incomplete Tasks and
  current-month PHP income. No sample balances or counts from the reference are
  inserted. Other currencies remain separate. Errors show Unavailable, not zero.
- The Vault count reads an aggregate only; no credential data is decrypted or
  included in dashboard state. It can be shown while the Vault is locked, behind
  the app's local PIN gate. Counting is not Vault authorization.
- Quick actions open Add Note, New Task, Add Credential and Backup and Restore.
  Backup Now opens the existing protected local backup form; it does not upload
  or create a backup without the required user input.
- Today’s Focus reads the existing day-range service, preserving local dates,
  task/event distinction and recurrence occurrence identifiers when opening.
  It shows up to four entries, with loading, empty and retry states.
- Recent Notes reads three active previews ordered by modification date, with
  actual pinned indicators and dates. The repository gained a validated recent
  sorting option; existing library ordering remains pinned-first by default.
- Bottom navigation presents Home, Plan, Notes, Vault and More. The underlying
  Tasks/Finance routes remain valid. Notes and Vault buttons open the existing
  root stacks; they do not create duplicate, unprotected tab implementations.
  These root stacks retain their existing Back navigation rather than gaining
  new bottom bars. All other modules remain available in More.

The reference's statement that all notes/plans are encrypted was deliberately
not copied: the development database remains unkeyed pending approved production
activation. The banner describes existing Vault/backup encryption only. No new
dependency, native code, migration or stored record was introduced by the UI.

## Why inactivity looked like logout

The local account gate previously locked unconditionally after the existing
60-second default timeout. It kept persistent sign-in and requested the PIN;
this was locking, not logout. Only explicit sign-out changes remembered sign-in.

`localPinIdleLock` now defaults to false and is stored in the existing settings
table when changed. Privacy and Security exposes Lock PIN while idle, requiring
Android reauthentication for a change. When enabled it uses the existing 1/5
minute inactivity timeout. When disabled, leaving the foreground untouched does
not trigger this PIN timer. Restart/background/manual locking still require
the PIN. Optional Android app-lock and Vault inactivity timers remain separate
and retain their existing behavior; this change does not disable them or
automatically sign into the Vault.

## Verification scope

Lint passed with zero warnings; application and tooling TypeScript checks passed.
The dependency lockfile remains byte-identical to the existing baseline.
Physical HONOR tests, automated suites, native rebuilds and releases
remain paused. Appearance, navigation taps and idle/background behavior have
not been newly exercised on the phone. No account, database, Vault key or live
preference value was reset during this task.
