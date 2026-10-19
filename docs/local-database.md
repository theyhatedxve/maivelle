# Local database - Phase 6

**Development fixtures only. Production database creation is blocked.** SQLCipher is compiled into the native app, but the Phase 3 development database is intentionally **unencrypted** and must contain only synthetic test information. No real passwords, medication records, financial details, or personal notes belong in it. SecureStore key provisioning and encrypted production storage are not implemented or certified by this phase.

## Lifecycle and boundaries

`src/database/connection.js` owns one process-scoped connection to `maivelle-phase3-synthetic.db`. Concurrent consumers await the same initialization promise. Native SQLite loading/opening happens only after the development gate; a release build raises `ENCRYPTION_REQUIRED` before opening any application database. Failed initialization closes its connection and permits an explicit retry without deleting the file.

The root Router layout wraps the existing navigator in `DatabaseProvider`. Loading and error states use existing Maivelle UI components. Initialization must finish before routes mount. `useDatabase()` exposes Notes and Tasks services/repositories rather than SQL or raw database handles. React effect cleanup does not close the process-owned connection: this prevents Strict Mode/remount races. The native runtime releases it when the process/runtime ends. No screen opens its own application connection. The isolated diagnostics databases are separate, short-lived fixtures.

`initialize.js` enables and verifies foreign keys, sets a five-second busy timeout, and requests WAL before migrating. Disk databases must return WAL; in-memory host fixtures may return MEMORY. Unsupported disk journal modes fail visibly rather than silently weakening the tested setup. There are no network calls in this layer.

## Current schema

Migration 5 adds `calendar_events`, `calendar_event_categories` and `calendar_event_exceptions`, with validated parent recurrence JSON and atomic exception handling; see [calendar.md](calendar.md). Existing tables and migrations 1?4 are preserved. The four infrastructure/Notes tables below are preserved. Migration 4 additionally creates `tasks`, `task_categories`, and `subtasks`; see [tasks.md](tasks.md) for their schema, FK cascade rules and API. IDs are opaque stable text IDs (native repository callers generate Expo UUID v4), and repository timestamps are UTC ISO-8601 strings.

| Table | Columns and constraints |
| --- | --- |
| `schema_migrations` | `version INTEGER PRIMARY KEY > 0`, unique `name`, exact source `sql`, `applied_at`. The stored SQL detects accidental changes to already-applied migrations; it is not a cryptographic audit log. |
| `app_settings` | `key TEXT PRIMARY KEY` (1–128 characters), `value TEXT NOT NULL`, `created_at`, `updated_at >= created_at`. Settings must not hold secrets or encryption keys. |
| `note_categories` | `id TEXT PRIMARY KEY` (1–128 characters), unique nonblank `name` (1–80 characters), `created_at`, `updated_at >= created_at`. |
| `notes` | `id TEXT PRIMARY KEY` (1–128 characters), nonblank `title` (1–240 characters), `body TEXT NOT NULL` (up to 100000 characters), nullable `category_id`, `created_at`, `updated_at >= created_at`. |

`notes.category_id` references `note_categories.id`, with `ON DELETE SET NULL` and `ON UPDATE RESTRICT`. Removing a category preserves notes. Version 3 adds boolean integer `is_pinned` and `is_archived` flags (both default 0) and an archive/pin/modified-time list index without changing existing rows. Version 2 adds indexes for `(updated_at DESC, id ASC)` and `category_id`. No real module records or default user notes are seeded at startup.

## Migration rules

1. Add a new immutable numbered migration and append it to `migrations/index.js`. Never edit an applied migration's name or SQL; even changed SQL whitespace is rejected by history validation.
2. Versions must be consecutive from one. Unknown future versions, altered history, gaps, or pre-existing untracked/conflicting tables stop initialization; they do not trigger repair-by-reset.
3. The initializer owns the unpublished connection. `BEGIN IMMEDIATE` reserves the writer; the ledger bootstrap, every pending migration, ledger inserts, and final foreign-key validation are one transaction. Any failure rolls the entire pending batch back.
4. Repository consumers are not mounted until commit. Do not invoke migrations on a connection already serving queries. The per-connection running guard also rejects overlapping migration runs.
5. Run SQL only on the owned connection during migration. Expo's ordinary async transaction helper can include unrelated concurrent work, while its exclusive helper opens another connection; future SQLCipher keying must account for every connection. This implementation avoids that extra connection and preserves the configured foreign-key state.
6. Migrations 1 and 2 create infrastructure and indexes only. Normal startup never drops tables, deletes records, recreates existing user tables, changes encryption, or clears app storage.

If a migration fails, retain the database and investigate the error/cause. Restore only through a separately designed, verified recovery workflow. Never use uninstall, Clear storage, dropping tables, or deleting the database as a migration fix.

## Notes repository contract

`createNotesRepository(db, createId)` supplies the Notes service; see [notes.md](notes.md) for the Phase 4 contracts, list filters and workflow. It uses async SQLite APIs and positional bindings for every supplied value. Reviewed static migration SQL is the only bulk DDL. Presentation components contain no SQL.

| Method | Result |
| --- | --- |
| `create({ title, body?, categoryId? })` | Created note; title trimmed, body defaults to an empty string, category defaults to null. |
| `getById(id)` | Note or `null`. |
| `list({ categoryId?, search?, archived?, limit?, offset? })` | Pinned notes first, then updated time descending and ID ascending. Defaults: limit 100, offset 0; limit 1–200. Omitted category/archive returns all; null category means Uncategorized. |
| `update(id, patch)` | Updated note or `null` if absent. Omitted fields are preserved; explicit `categoryId: null` clears the reference. One SQL statement performs the partial update atomically. |
| `remove(id)` | `true` when deleted; `false` when absent. |

Results use `{ id, title, body, categoryId, createdAt, updatedAt, pinned, archived }`. Additional repository operations are `setFlag(id, flag, enabled)` and `countActive()`. List supports bound literal `search`, optional boolean `archived`, and nullable `categoryId` (null means Uncategorized; omitted means all), ordered pinned first, then updated time descending and ID ascending. Unknown fields, invalid IDs, blank/oversized titles, invalid body types, and invalid pagination are rejected. Errors carry stable codes such as `VALIDATION`, `REFERENCE`, `CONFLICT`, `CONSTRAINT`, `BUSY`, `STORAGE`, and migration/security-specific codes. Public messages avoid embedding user values; native causes remain available for controlled diagnosis. Never log a future database key or SQL containing secrets.

## Encryption and key-management decisions still required

The SDK 58 SQLite plugin supports `useSQLCipher: true` on Android; changing it requires prebuild and a new native binary, and SQLCipher is not supplied by Expo Go. Enabling the library alone **does not encrypt a file**. An approved key must be applied immediately after opening, before the first database read, schema creation, WAL configuration, or migration.

Production remains blocked until all of these are designed, implemented, and device-tested:

- Cryptographically random database key generation, secure provisioning, and a versioned SecureStore key identifier. Do not use a hardcoded key, public Expo environment variable, app setting, device identifier, or user password directly as a database key.
- Correct SQLCipher key application to every connection, verification of the key against the existing schema, encrypted-file/header checks, integrity checks, and WAL/temporary-file behavior. PRAGMA keying is special SQL; use the documented SQLCipher form with validated internal key material, never arbitrary text interpolation from user input.
- A provisioning state machine that handles crashes between SecureStore and SQLite writes. They do not share a transaction. A missing, unreadable, invalidated, or rejected key for an existing database must fail closed; never generate a replacement key or silently recreate the database.
- Key rotation, non-destructive export/import, authenticated backups and recovery, reinstall/device-transfer behavior, and explicit lost-key UX. SecureStore is not a substitute for a recovery design.
- A threat model and decision about biometric authentication versus background availability. SecureStore authentication can require a device prompt and can become inaccessible after biometric enrollment changes. Treat cancellation/lockout separately from corruption.
- Review of native backups/device transfer. `android.allowBackup` is disabled and the SecureStore plugin excludes its preferences from backup, but OEM transfer behavior must still be reviewed. Android Keystore material does not survive uninstall in a way that makes restored SecureStore data safely recoverable.
- Security review before any real medication, finance, or vault information is accepted. A vault may also require a separately keyed store and field/item encryption; the current notes schema is not a vault.

There is intentionally no production filename or automatic plaintext-to-encrypted production migration. The development fixture file is a separate namespace and is never promoted automatically. Preserve any existing files; a future import/export path must be explicit and non-destructive. Phase 3 probes SecureStore availability only and creates no key, secret, biometric prompt, or authentication feature.

## Proposed future schemas — not implemented

These are design targets, not committed tables or business rules. Use stable IDs, UTC timestamps, foreign keys, and indexes appropriate to confirmed access patterns. Create them only in later migrations after their requirements and encryption policy are approved.

| Module | Proposed tables / relationships |
| --- | --- |
| Tasks | Implemented in migration 4; see [tasks.md](tasks.md). Deadlines use separate local `due_date` and optional `due_time`, with categories and subtasks. |
| Medicine | `medicines`, `medicine_schedules(medicine_id FK, local_time, timezone, recurrence)`, `medicine_dose_logs(schedule_id FK, scheduled_at, taken_at, status)`. Health records require encryption and retention policy first. |
| Time tracking | `time_sessions(id, task_id nullable FK, started_at, ended_at, duration_seconds, created_at, updated_at)`; nonnegative duration and end-after-start constraints. |
| Finance | `accounts`, `transaction_categories`, `transactions(account_id FK, category_id FK, amount_minor INTEGER, currency, occurred_at, description, timestamps)`. Use integer minor units, not floating-point money. |
| Calendar | Implemented in migration 5; see [calendar.md](calendar.md). Floating local boundaries, all-day dates, validated parent recurrence JSON, category FKs and stable occurrence exceptions. |
| Budgeting | `budgets(id, name, currency, period_start, period_end, timestamps)` and `budget_allocations(budget_id FK, transaction_category_id FK, amount_minor INTEGER)`; transaction links depend on Finance design. |
| Encrypted vault | A separately reviewed encrypted `vault_items` design with opaque ID, key version, authenticated ciphertext/nonce metadata, and timestamps. No plaintext password/secret fields in a general-purpose table. |

## Tests and device workflow

```powershell
npm.cmd run test:database
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run doctor
npm.cmd run check:dependencies
```

The host suite uses Node 24's actual `node:sqlite` engine behind an async-shaped adapter, not a fake SQL parser. It tests migrations/repositories, rollback, constraints, production gating, WAL, and persistence through a separate process. It does not establish Expo native-module, SQLCipher encryption, or Android filesystem correctness by itself.

Use the existing USB development guide to rebuild after these native changes:

```powershell
npx.cmd expo prebuild --platform android --no-install
# Start Metro and USB forwarding as documented in development-setup.md.
npm.cmd run android:device -- --no-bundler
adb -d shell am start -a android.intent.action.VIEW -d 'maivelle:///database-diagnostics' com.devdb01.maivellelocalapp
```

The development-only diagnostics route is not linked from the dashboard. Run its native checks with synthetic fixtures. It opens a unique isolated test database, runs real native CRUD/migration checks, and removes only that UUID-named fixture after success. A failed fixture is retained for diagnosis. It never resets the application database.

For restart persistence, press **Save synthetic restart probe**, record the generated UUID, force-stop Maivelle, reopen it through the USB development-client launch command, reopen diagnostics, and press **Read saved restart probe**. The UUID must match. This uses a harmless `app_settings` fixture, not private user information.

Database operations require no internet, API, account, or backend. Metro over USB is a local development transport; package/tool downloads require internet. A debug client still needs its local JavaScript server on a cold launch. Standalone encrypted release startup remains blocked and is not an offline-production acceptance test.

## Official references

- [Expo SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)
- [SQLCipher configuration and keying](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#sqlcipher)
- [Expo SDK 58 SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/)
- [SecureStore Android Auto Backup](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/#android-auto-backup)

Notes, Tasks and Phase 6 Calendar are implemented; the remaining module schemas are proposals. Production encryption remains blocked. See [notes.md](notes.md) and [phase-4-verification.md](phase-4-verification.md).
