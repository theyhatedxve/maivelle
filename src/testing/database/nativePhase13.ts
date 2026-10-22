import * as SQLite from 'expo-sqlite';
import { uuid } from 'expo';
import { initializeDatabase } from '../../database/initialize.ts';
import { runCrossModuleChecks, measureModuleQueries } from './phase13Scenarios.ts';
import { createTimeTrackerRepository } from '../../database/repositories/timeTrackerRepository.ts';
import { createTimeTrackerService } from '../../features/timeTracker/services/timeTrackerService.ts';
import { getDatabase } from '../../database/connection.ts';
import { integrity } from '../../features/settings/services/backupValidation.ts';
import { migrations } from '../../database/migrations/index.ts';
/** Read-only audit of the currently selected application database. No record values returned. */
export async function inspectApplicationIntegrity() {
  const db = await getDatabase();
  await integrity(db);
  const ledger = await db.getAllAsync<import('../../database/rows.ts').MigrationLedgerRow>(
    'SELECT version,name,sql FROM schema_migrations ORDER BY version',
  );
  if (
    ledger.length !== migrations.length ||
    ledger.some(
      (row, i) =>
        row.version !== migrations[i].version ||
        row.name !== migrations[i].name ||
        row.sql !== migrations[i].sql,
    )
  )
    throw new Error('Application migration history mismatch; no records changed.');
  if ((await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys !== 1)
    throw new Error('Application FK policy unavailable');
  const cipher = await db.getFirstAsync('PRAGMA cipher_version');
  return (
    'PASS: current application integrity, FK enforcement and migration history; no records modified\n' +
    `SQLCipher native version: ${cipher ? Object.values(cipher).join('') : 'unavailable'}. Development connection is unkeyed; production remains ENCRYPTION_REQUIRED.`
  );
}

export async function runNativeIntegration(
  mode: 'integration' | 'performance',
  output: (text: string) => void,
) {
  const name = `maivelle-phase13-${uuid.v4()}.db`;
  const db = await SQLite.openDatabaseAsync(name, { useNewConnection: true });
  try {
    if (mode === 'integration') return (await runCrossModuleChecks(db, uuid.v4, output)).join('\n');
    output('Seeding 1,000 isolated notes and tasks; measuring five samples...');
    return 'METRICS ' + JSON.stringify(await measureModuleQueries(db, uuid.v4));
  } finally {
    await db.closeAsync();
    await SQLite.deleteDatabaseAsync(name);
  }
}
const lifecycleName = 'maivelle-phase13-lifecycle.db';
/** Only this deliberately separate fixture survives process death/reboot. Never the app database. */
export async function checkNativeLifecycle(mode: 'seed' | 'verify' | 'cleanup') {
  const db = await SQLite.openDatabaseAsync(lifecycleName, {
    useNewConnection: true,
  });
  try {
    if (mode === 'cleanup') return 'PASS: isolated lifecycle fixture cleaned';
    await initializeDatabase(db);
    const timer = createTimeTrackerService(createTimeTrackerRepository(db, uuid.v4));
    if (mode === 'seed') {
      if (await timer.active())
        throw new Error('Lifecycle fixture already running; verify it before cleanup.');
      const project = await timer.saveProject(null, {
        name: 'Public lifecycle fixture',
        description: 'Fictional only',
        color: '#6D42C7',
        archived: false,
      });
      await timer.start(project, 'Public reboot recovery fixture');
      return 'PASS: isolated lifecycle timer persisted';
    }
    const active = await timer.active();
    if (!active || active.status !== 'running' || (await timer.summary()).today.totalMs < 0)
      throw new Error('Isolated lifecycle timer did not recover');
    return (
      'PASS: isolated timer survives process/reboot; FK violations ' +
      (await db.getAllAsync('PRAGMA foreign_key_check')).length
    );
  } finally {
    await db.closeAsync();
    if (mode === 'cleanup') await SQLite.deleteDatabaseAsync(lifecycleName);
  }
}
