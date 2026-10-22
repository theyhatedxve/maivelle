import * as SQLite from 'expo-sqlite';
import { uuid } from 'expo';
import { initializeDatabase } from '../../database/initialize.ts';
import { migrations } from '../../database/migrations/index.ts';
import { createMedicineRepository } from '../../database/repositories/medicineRepository.ts';
import { createMedicineService } from '../../features/medicine/services/medicineService.ts';
import { createNotesRepository } from '../../database/repositories/notesRepository.ts';
import { DatabaseError } from '../../database/errors.ts';

function ensure(value: unknown, label: string) {
  if (!value) throw new DatabaseError('TEST_FAILED', label);
}
export async function runNativeMedicineChecks() {
  if (!__DEV__)
    throw new DatabaseError('DEVELOPMENT_ONLY', 'Synthetic development diagnostics only.');
  const filename = `maivelle-isolated-medicine-${uuid.v4()}.db`;
  let db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
  let passed = false;
  const results = [];
  try {
    await initializeDatabase(db, migrations.slice(0, 5));
    const notes = createNotesRepository(db, uuid.v4);
    const note = await notes.create({ title: 'Fictional migration preservation' });
    await initializeDatabase(db);
    await initializeDatabase(db);
    ensure((await notes.getById(note.id))?.title === note.title, 'Existing note preserved');
    ensure(
      (
        await db.getAllAsync<import('../../database/rows.ts').MigrationLedgerRow>(
          'SELECT * FROM schema_migrations',
        )
      ).length === migrations.length,
      'Migration idempotency',
    );
    results.push('PASS: migration 6 preserves prior data and is idempotent');
    let now = new Date(2026, 9, 20, 9);
    let repository = createMedicineRepository(db, uuid.v4);
    let service = createMedicineService(repository, () => now);
    const schedule = {
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      times: ['08:00', '20:00'],
      startDate: null,
      endDate: null,
    };
    const input = {
      name: 'Fictional native medicine',
      form: 'Synthetic',
      instructions: 'Mock instructions only',
      notes: 'Test fixture',
      active: true,
      startDate: null,
      endDate: null,
      schedules: [schedule],
    };
    let medicine = await service.save(null, input);
    let doses = await service.doses('2026-10-20', '2026-10-21');
    ensure(doses.length === 2 && doses[0].status === 'missed', 'Daily/missed generation');
    await service.record(doses[0].id, 'taken');
    let duplicate = false;
    try {
      await service.record(doses[0].id, 'skipped');
    } catch (error) {
      duplicate = error instanceof DatabaseError && error.code === 'CONFLICT';
    }
    ensure(duplicate, 'Duplicate dose rejected');
    results.push('PASS: async native CRUD, daily doses, Taken, duplicate prevention');
    now = new Date(2026, 9, 20, 12);
    medicine = await service.save(
      medicine.id,
      { ...input, schedules: [{ ...schedule, times: ['18:00'] }] },
      medicine.revision,
    );
    doses = await service.doses('2026-10-20', '2026-10-21');
    ensure(
      doses.length === 2 && doses[0].status === 'taken' && doses[1].local.endsWith('18:00'),
      'Revision preserves history',
    );
    now = new Date(2026, 9, 20, 18, 10);
    await service.record(doses[1].id, 'skipped');
    medicine = await service.save(medicine.id, { ...medicine, active: false }, medicine.revision);
    ensure((await service.doses('2026-10-21', '2026-10-22')).length === 0, 'Inactive stops future');
    results.push('PASS: revised schedule, Skipped, deactivation preserve previous doses');
    const weekly = await service.save(null, {
      ...input,
      schedules: [{ ...schedule, weekdays: [1, 3, 5], times: ['15:00', '16:00'] }],
    });
    ensure(
      (await service.doses('2026-10-21', '2026-10-24', weekly.id)).length === 4,
      'Selected weekday generation',
    );
    results.push('PASS: selected weekdays and multiple times');
    await db.closeAsync();
    db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
    await initializeDatabase(db);
    repository = createMedicineRepository(db, uuid.v4);
    service = createMedicineService(repository, () => now);
    ensure((await service.get(medicine.id))?.active === false, 'Medicine persists');
    const persisted = await service.doses('2026-10-20', '2026-10-21', medicine.id);
    ensure(
      persisted.length === 2 &&
        persisted[0].status === 'taken' &&
        persisted[1].status === 'skipped',
      'Dose history persists',
    );
    results.push('PASS: native connection restart persistence, no internet');
    ensure((await db.getAllAsync('PRAGMA foreign_key_check')).length === 0, 'Foreign keys');
    passed = true;
    return results;
  } finally {
    await db.closeAsync();
    if (passed) await SQLite.deleteDatabaseAsync(filename);
  }
}
