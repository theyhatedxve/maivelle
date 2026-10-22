import { migrations } from '../migrations/index.ts';
import { integrity } from '../../features/settings/services/backupValidation.ts';
// Reviewed application tables only; no schema SQL supplied by an archive is executed.
export const PORTABLE_TABLES = Object.freeze([
  'app_settings',
  'note_categories',
  'notes',
  'task_categories',
  'tasks',
  'subtasks',
  'calendar_event_categories',
  'calendar_events',
  'calendar_event_exceptions',
  'medicines',
  'medicine_schedules',
  'medicine_dose_logs',
  'time_projects',
  'time_sessions',
  'time_session_segments',
  'financial_accounts',
  'transaction_categories',
  'transactions',
  'budgets',
  'budget_accounts',
  'budget_allocations',
  'budget_transaction_links',
  'budget_funding_history',
  'vault_metadata',
  'vault_items',
  'vault_settings',
]);
const allowed = new Set(PORTABLE_TABLES);

const quoted = (value: string) => {
  if (!/^[a-z_][a-z_0-9]*$/.test(value)) throw new Error('Unsupported schema identifier.');
  return '"' + value + '"';
};

export async function recordSchema(db: import('../types.ts').Database) {
  const ledger = await db.getAllAsync<import('../rows.ts').MigrationLedgerRow>(
    'SELECT version,name,sql FROM schema_migrations ORDER BY version',
  );
  if (
    ledger.length !== migrations.length ||
    ledger.some(
      (r, i) =>
        r.version !== migrations[i].version ||
        r.name !== migrations[i].name ||
        r.sql !== migrations[i].sql,
    )
  )
    throw new Error('Unsupported migration ledger for portable recovery.');
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  if (
    tables
      .map((r) => r.name)
      .sort()
      .join(',') !==
    [...PORTABLE_TABLES, 'schema_migrations', 'medicine_notification_jobs'].sort().join(',')
  )
    throw new Error('Unsupported portable table set.');
  const columns: Record<string, string[]> = {};
  for (const table of [...PORTABLE_TABLES, 'schema_migrations']) {
    columns[table] = (
      await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${quoted(table)})`)
    ).map((r) => r.name);
  }
  return columns;
}
/** Dedicated source handle only. BEGIN pins a consistent read snapshot; callers
must never pass the shared UI handle, whose concurrent writes could join it. */
export async function* exportRecords(db: import('../types.ts').Database) {
  await db.execAsync('BEGIN');
  try {
    const schema = await recordSchema(db);
    yield { kind: 'schema', version: migrations.length, columns: schema };
    for (const table of ['schema_migrations', ...PORTABLE_TABLES]) {
      let cursor = null;
      while (true) {
        const row: Record<string, any> | null = await db.getFirstAsync(
          `SELECT rowid AS portable_cursor,${schema[table].map(quoted).join(',')} FROM ${quoted(table)} ${cursor === null ? '' : 'WHERE rowid > ?'} ORDER BY rowid LIMIT 1`,
          ...(cursor === null ? [] : [cursor]),
        );
        if (!row) break;
        cursor = row.portable_cursor;
        if (!Number.isSafeInteger(cursor)) throw new Error('Unsupported record cursor.');
        if (
          schema[table].some(
            (c) =>
              typeof row[c] === 'number' &&
              (!Number.isFinite(row[c]) ||
                (Number.isInteger(row[c]) && !Number.isSafeInteger(row[c]))),
          )
        )
          throw new Error('Portable record contains a number that cannot round-trip exactly.');
        yield { kind: 'row', table, values: schema[table].map((c) => row[c]) };
      }
    }
    await integrity(db);
  } finally {
    await db.execAsync('ROLLBACK');
  }
}
/** Import ONLY into a fresh, keyed staging handle. Roll back on any bad frame,
constraint, ledger or completion error; never touch an existing generation. */
export async function importRecords(
  db: import('../types.ts').Database,
  records: AsyncIterable<unknown>,
) {
  const columns = await recordSchema(db);
  // Schema 10 archives predate optional reminders. Import their reviewed column
  // set into current staging tables; new nullable columns retain safe defaults.
  let sourceColumns = columns;
  let sourceVersion = migrations.length;
  const stagingLedger = await db.getAllAsync<Record<string, string | number>>(
    'SELECT * FROM schema_migrations ORDER BY version',
  );
  for (const table of PORTABLE_TABLES) {
    if ((await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${quoted(table)}`))?.n)
      throw new Error('Portable import requires empty staging tables.');
  }
  await db.execAsync('BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON;');
  let first = true;
  let ledgerCount = 0;
  let tableIndex = -1;
  try {
    // The ledger is restored exactly, including applied_at, inside this transaction.
    await db.runAsync('DELETE FROM schema_migrations');
    for await (const unknown of records) {
      const r = unknown as {
        kind: string;
        version?: number;
        columns?: Record<string, string[]>;
        table?: string;
        values?: unknown[];
      };
      if (first) {
        first = false;
        if (r?.version === 10) {
          sourceVersion = 10;
          sourceColumns = Object.fromEntries(
            Object.entries(columns).map(([table, fields]) => [
              table,
              fields.filter((field) => field !== 'reminder_minutes'),
            ]),
          );
        }
        if (
          !r ||
          r.kind !== 'schema' ||
          r.version !== sourceVersion ||
          JSON.stringify(r.columns) !== JSON.stringify(sourceColumns)
        )
          throw new Error('Portable schema metadata does not match this application.');
        continue;
      }
      if (
        !r ||
        r.kind !== 'row' ||
        typeof r.table !== 'string' ||
        (!allowed.has(r.table) && r.table !== 'schema_migrations') ||
        !Array.isArray(r.values) ||
        r.values.length !== sourceColumns[r.table].length ||
        r.values.some(
          (v) =>
            v !== null && typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v)),
        )
      )
        throw new Error('Invalid portable record.');
      const index = ['schema_migrations', ...PORTABLE_TABLES].indexOf(r.table);
      if (index < tableIndex) throw new Error('Portable table order is invalid.');
      tableIndex = index;
      if (r.table === 'schema_migrations') {
        const expected = migrations[ledgerCount++];
        const row = Object.fromEntries(
          sourceColumns[r.table].map((field, i) => [field, r.values![i]]),
        );
        if (
          !expected ||
          ledgerCount > sourceVersion ||
          row.version !== expected.version ||
          row.name !== expected.name ||
          row.sql !== expected.sql
        )
          throw new Error('Unsupported portable migration history.');
      }
      await db.runAsync(
        `INSERT INTO ${quoted(r.table)} (${sourceColumns[r.table].map(quoted).join(',')}) VALUES (${r.values.map(() => '?').join(',')})`,
        ...(r.values as (string | number | null)[]),
      );
    }
    if (first || ledgerCount !== sourceVersion) throw new Error('Incomplete portable ledger.');
    for (const row of stagingLedger.slice(sourceVersion)) {
      await db.runAsync(
        'INSERT INTO schema_migrations (version,name,sql,applied_at) VALUES (?,?,?,?)',
        row.version,
        row.name,
        row.sql,
        row.applied_at,
      );
    }
    await recordSchema(db);
    await integrity(db);
    await db.execAsync('COMMIT');
  } catch {
    try {
      await db.execAsync('ROLLBACK');
    } catch (rollbackError) {
      // SQLITE_FULL can roll the transaction back inside SQLite before this
      // handler runs. Only that confirmed state is safe to treat as complete.
      if (
        !(
          rollbackError instanceof Error &&
          /cannot rollback - no transaction is active/i.test(rollbackError.message)
        )
      ) {
        throw new Error(
          'Portable recovery failed and staging rollback could not be confirmed. Existing data and keys were retained; do not reuse the staging generation.',
        );
      }
    }
    throw new Error('Portable recovery failed validation. Existing data and keys were retained.');
  }
}
