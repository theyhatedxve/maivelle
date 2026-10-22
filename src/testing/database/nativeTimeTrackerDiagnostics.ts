import * as SQLite from 'expo-sqlite';
import { uuid } from 'expo';
import { initializeDatabase } from '../../database/initialize.ts';
import { migrations } from '../../database/migrations/index.ts';
import { createTimeTrackerRepository } from '../../database/repositories/timeTrackerRepository.ts';
import { createTimeTrackerService } from '../../features/timeTracker/services/timeTrackerService.ts';
import { DatabaseError } from '../../database/errors.ts';

function ensure(condition: unknown, message: string) {
  if (!condition) throw new DatabaseError('TEST_FAILED', message);
}
export async function runNativeTimeTrackerChecks() {
  if (!__DEV__)
    throw new DatabaseError(
      'DEVELOPMENT_ONLY',
      'Synthetic diagnostics are disabled in release builds.',
    );
  const filename = `maivelle-isolated-time-${uuid.v4()}.db`;
  let db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
  let passed = false;
  const results = [];
  try {
    await initializeDatabase(db, migrations.slice(0, 6));
    await db.runAsync(
      "INSERT INTO notes(id,title,body,created_at,updated_at) VALUES('pre-time-note','Synthetic preserved note','','a','a')",
    );
    await initializeDatabase(db);
    await initializeDatabase(db);
    ensure(
      (
        await db.getFirstAsync<Pick<import('../../database/rows.ts').NotesRow, 'title'>>(
          "SELECT title FROM notes WHERE id='pre-time-note'",
        )
      )?.title === 'Synthetic preserved note' &&
        (
          await db.getAllAsync<import('../../database/rows.ts').MigrationLedgerRow>(
            'SELECT * FROM schema_migrations',
          )
        ).length === migrations.length,
      'Migration preservation/idempotency',
    );
    results.push('PASS: migration 7 preserves old Notes and is idempotent');
    let now = new Date(2026, 9, 20, 12).getTime();
    let service = createTimeTrackerService(createTimeTrackerRepository(db, uuid.v4), () => now);
    const projectId = await service.saveProject(null, {
      name: 'Synthetic native activity',
      description: 'Test only',
      color: '#6D42C7',
      archived: false,
    });
    let session = await service.start(projectId, 'Synthetic native timer');
    const original = session;
    now += 1000;
    session = await service.transition(session, 'pause');
    now += 2000;
    session = await service.transition(session, 'resume');
    now += 3000;
    session = await service.transition(session, 'pause');
    now += 2000;
    session = await service.transition(session, 'resume');
    now += 4000;
    ensure((await service.summary()).today.totalMs === 8000, 'Paused gaps excluded');
    let rejected = false;
    try {
      await service.transition(original, 'pause');
    } catch (error) {
      rejected = error instanceof DatabaseError && error.code === 'CONFLICT';
    }
    ensure(rejected, 'Stale transition rejected');
    results.push('PASS: start, repeated pause/resume, active summary, stale transition');
    await db.closeAsync();
    db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
    await initializeDatabase(db);
    service = createTimeTrackerService(createTimeTrackerRepository(db, uuid.v4), () => now);
    const recovered = await service.active();
    ensure(
      recovered?.id === original.id && recovered.segments.length === 3,
      'Reopen persistent running timer',
    );
    now += 1000;
    session = await service.transition(recovered as NonNullable<typeof recovered>, 'stop');
    ensure(
      (await service.history({ type: 'timer' }))[0]?.duration_ms === 9000 &&
        session.created_at === original.created_at,
      'Stop/creation timestamp',
    );
    results.push(
      'PASS: native close/reopen recovery, stop, integer duration and creation timestamp',
    );
    const midnight = new Date(2026, 9, 20).getTime();
    const input = {
      title: 'Synthetic midnight manual',
      projectId,
      segments: [
        {
          start: new Date(midnight - 1000).toISOString(),
          end: new Date(midnight + 2000).toISOString(),
        },
      ],
    };
    const manual = await service.saveSession(null, null, input);
    const stats = await service.statistics(midnight - 2000, midnight + 3000);
    ensure(
      stats.totalMs === 3000 &&
        stats.days.length === 2 &&
        stats.days[0].durationMs === 1000 &&
        stats.days[1].durationMs === 2000,
      'Midnight split',
    );
    const edited = await service.saveSession(manual.id, manual.revision, {
      ...input,
      title: 'Edited synthetic manual',
    });
    ensure(
      edited.id === manual.id &&
        edited.created_at === manual.created_at &&
        (await service.history({ type: 'manual', projectId })).length === 1,
      'Manual edit/filter',
    );
    await service.saveProject(projectId, {
      name: 'Archived synthetic activity',
      description: 'Test only',
      color: '#2563EB',
      archived: true,
    });
    ensure((await service.projects())[0]?.total_ms === 12000, 'Activity total');
    rejected = false;
    try {
      await service.start(projectId, 'Must fail');
    } catch (error) {
      rejected = error instanceof DatabaseError && error.code === 'REFERENCE';
    }
    ensure(rejected, 'Archived start rejected');
    await service.deleteProject(projectId);
    ensure(
      (await service.get(manual.id))?.project_id === null &&
        (await service.get(session.id))?.segments.length === 3,
      'Delete preserves history',
    );
    results.push(
      'PASS: manual edit, filters, midnight statistics, project totals/archive/delete preservation',
    );
    rejected = false;
    try {
      await service.saveSession(null, null, { ...input, title: ' ' });
    } catch (error) {
      rejected = error instanceof DatabaseError && error.code === 'VALIDATION';
    }
    ensure(rejected, 'Empty title rejected');
    await service.remove(edited);
    await service.remove(session);
    ensure((await service.history({})).length === 0, 'Session delete cascades');
    ensure(
      (await db.getAllAsync('PRAGMA foreign_key_check')).length === 0,
      'No dangling references',
    );
    results.push('PASS: validation, session deletion and foreign-key integrity');
    passed = true;
    return results;
  } finally {
    await db.closeAsync();
    if (passed) await SQLite.deleteDatabaseAsync(filename);
  }
}
