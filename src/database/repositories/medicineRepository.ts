import { DatabaseError, storageError } from '../errors.ts';
export type Medicine =
  import('../../features/medicine/validation/medicineInput.ts').MedicineInput & {
    id: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
  };

export function medicineId(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value))
    throw new DatabaseError('VALIDATION', 'Invalid medicine identifier.');
  return value;
}

const scheduleRow = (
  row: any,
): import('../../features/medicine/services/doseOccurrences.ts').Schedule => ({
  id: row.id,
  medicineId: row.medicine_id,
  weekdays: JSON.parse(row.weekdays),
  times: JSON.parse(row.times),
  startDate: [row.start_date, row.medicine_start].filter(Boolean).sort().at(-1) ?? null,
  endDate: [row.end_date, row.medicine_end].filter(Boolean).sort()[0] ?? null,
  effectiveFrom: row.effective_from,
  retiredAt: row.retired_at,
  enabled: !!row.enabled,
  current: !!row.is_current,
  name: row.name_snapshot,
  instructions: row.instructions_snapshot,
});

const medicineRow = (row: any): Medicine => ({
  id: row.id,
  name: row.name,
  form: row.form,
  instructions: row.instructions,
  notes: row.notes,
  active: !!row.active,
  startDate: row.start_date,
  endDate: row.end_date,
  revision: row.revision,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  schedules: [],
});

export function createMedicineRepository(
  db: import('../types.ts').Database &
    Pick<import('expo-sqlite').SQLiteDatabase, 'withExclusiveTransactionAsync'>,
  createId: () => string,
) {
  const repository = {
    async list(search: string = '', filter: string = 'active') {
      if (!['active', 'inactive', 'all'].includes(filter) || typeof search !== 'string')
        throw new DatabaseError('VALIDATION', 'Invalid medicine filter.');
      try {
        const rows = await db.getAllAsync<import('../rows.ts').MedicinesRow>(
          "SELECT * FROM medicines WHERE (?='all' OR active=?) AND (instr(lower(name),lower(?))>0 OR instr(lower(notes),lower(?))>0) ORDER BY active DESC,name,id LIMIT 501",
          filter,
          filter === 'active' ? 1 : 0,
          search,
          search,
        );
        if (rows.length > 500)
          throw new DatabaseError('RANGE', 'Too many medicines. Narrow your search.');
        return rows.map(medicineRow);
      } catch (error) {
        throw storageError(error, 'list medicines');
      }
    },

    async get(id: string) {
      medicineId(id);
      try {
        const row = await db.getFirstAsync<import('../rows.ts').MedicinesRow>(
          'SELECT * FROM medicines WHERE id=?',
          id,
        );
        if (!row) return null;
        const medicine = medicineRow(row);
        const schedules = await db.getAllAsync<import('../rows.ts').MedicineSchedulesRow>(
          'SELECT * FROM medicine_schedules WHERE medicine_id=? AND is_current=1 ORDER BY created_at,id',
          id,
        );
        medicine.schedules = schedules.map((item) => ({
          weekdays: JSON.parse(item.weekdays),
          times: JSON.parse(item.times),
          startDate: item.start_date,
          endDate: item.end_date,
        }));
        return medicine;
      } catch (error) {
        throw storageError(error, 'load medicine');
      }
    },
    /** Revision replacement and parent edit commit together on an exclusive transaction. */
    async save(
      id: string | null,
      input: import('../../features/medicine/validation/medicineInput.ts').MedicineInput,
      revision: number | null,
      cutover: string,
      now: Date,
    ) {
      const recordId = medicineId(id ?? createId());
      const stamp = now.toISOString();
      try {
        await db.withExclusiveTransactionAsync(async (tx) => {
          const old = id
            ? await tx.getFirstAsync<import('../rows.ts').MedicinesRow>(
                'SELECT * FROM medicines WHERE id=?',
                recordId,
              )
            : null;
          if (id && !old) throw new DatabaseError('NOT_FOUND', 'Medicine no longer exists.');
          if (old && old.revision !== revision)
            throw new DatabaseError('CONFLICT', 'Medicine changed. Reopen it before saving.');
          // A clock/timezone rollback must not make a new revision overlap history.
          const boundary = (await tx.getFirstAsync<{ cutoff: string | null }>(
            'SELECT MAX(MAX(effective_from,COALESCE(retired_at,effective_from))) AS cutoff FROM medicine_schedules WHERE medicine_id=?',
            recordId,
          ))!;
          const effectiveCutover =
            boundary?.cutoff && boundary.cutoff > cutover ? boundary.cutoff : cutover;
          const current = await tx.getAllAsync<import('../rows.ts').MedicineSchedulesRow>(
            'SELECT * FROM medicine_schedules WHERE medicine_id=? AND is_current=1 ORDER BY created_at,id',
            recordId,
          );
          const previous = current.map((row) => ({
            weekdays: JSON.parse(row.weekdays),
            times: JSON.parse(row.times),
            startDate: row.start_date,
            endDate: row.end_date,
          }));
          const changed =
            !old ||
            old.active !== Number(input.active) ||
            old.start_date !== input.startDate ||
            old.end_date !== input.endDate ||
            old.name !== input.name ||
            old.instructions !== input.instructions ||
            JSON.stringify(previous) !== JSON.stringify(input.schedules);
          if (old)
            await tx.runAsync(
              'UPDATE medicines SET name=?,form=?,instructions=?,notes=?,active=?,start_date=?,end_date=?,revision=revision+1,updated_at=MAX(updated_at,?) WHERE id=?',
              input.name,
              input.form,
              input.instructions,
              input.notes,
              Number(input.active),
              input.startDate,
              input.endDate,
              stamp,
              recordId,
            );
          else
            await tx.runAsync(
              'INSERT INTO medicines(id,name,form,instructions,notes,active,start_date,end_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
              recordId,
              input.name,
              input.form,
              input.instructions,
              input.notes,
              Number(input.active),
              input.startDate,
              input.endDate,
              stamp,
              stamp,
            );
          if (changed) {
            await tx.runAsync(
              'UPDATE medicine_schedules SET is_current=0,retired_at=MAX(effective_from,?) WHERE medicine_id=? AND is_current=1',
              effectiveCutover,
              recordId,
            );
            for (const schedule of input.schedules) {
              await tx.runAsync(
                'INSERT INTO medicine_schedules(id,medicine_id,weekdays,times,start_date,end_date,effective_from,medicine_start,medicine_end,enabled,is_current,name_snapshot,instructions_snapshot,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                medicineId(createId()),
                recordId,
                JSON.stringify(schedule.weekdays),
                JSON.stringify(schedule.times),
                schedule.startDate,
                schedule.endDate,
                old ? effectiveCutover : `${cutover.slice(0, 10)}T00:00:00.000`,
                input.startDate,
                input.endDate,
                Number(input.active),
                1,
                input.name,
                input.instructions,
                stamp,
              );
            }
          }
          // Expo's exclusive transaction uses a temporary native handle. Connection
          // PRAGMAs need not be inherited; validate every FK before that handle commits.
          if ((await tx.getAllAsync('PRAGMA foreign_key_check')).length)
            throw new DatabaseError(
              'REFERENCE',
              'Medicine schedule references failed validation. No changes were committed.',
            );
        });
        return (await repository.get(recordId)) as Medicine;
      } catch (error) {
        throw storageError(error, 'save medicine');
      }
    },
    /** Historical revisions are retained; bounded overlap query. */
    async schedules(from: string, to: string) {
      const rows = await db.getAllAsync<import('../rows.ts').MedicineSchedulesRow>(
        'SELECT * FROM medicine_schedules WHERE effective_from<? AND (retired_at IS NULL OR retired_at>?) ORDER BY created_at,id LIMIT 1001',
        `${to}T00:00:00.000`,
        `${from}T00:00:00.000`,
      );
      if (rows.length > 1000)
        throw new DatabaseError('RANGE', 'Too many schedule revisions. Narrow the range.');
      return rows.map(scheduleRow);
    },

    async logs(from: string, to: string) {
      return db.getAllAsync<import('../rows.ts').MedicineDoseLogsRow>(
        'SELECT * FROM medicine_dose_logs WHERE scheduled_local>=? AND scheduled_local<? ORDER BY scheduled_local LIMIT 5001',
        `${from}T00:00`,
        `${to}T00:00`,
      );
    },

    async log(
      dose: import('../../features/medicine/services/doseOccurrences.ts').Dose,
      status: 'taken' | 'skipped',
      now: Date,
    ) {
      try {
        // First action wins. Explicitly refuse accidental double taps or replacement of history.
        await db.runAsync(
          'INSERT INTO medicine_dose_logs(occurrence_id,schedule_id,medicine_id,scheduled_local,scheduled_at,timezone,status,action_at,name_snapshot,instructions_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?)',
          dose.id,
          dose.scheduleId,
          dose.medicineId,
          dose.local,
          dose.scheduledAt,
          dose.timezone,
          status,
          now.toISOString(),
          dose.name,
          dose.instructions,
        );
      } catch (error) {
        throw storageError(error, 'record dose action');
      }
    },
    async jobs() {
      return db.getAllAsync<import('../rows.ts').MedicineNotificationJobsRow>(
        'SELECT * FROM medicine_notification_jobs',
      );
    },

    async putJob(
      dose: {
        id: string;
        scheduleId: string;
        scheduledAt: string;
      },
      notificationId: string,
      delivery: string,
    ) {
      await db.runAsync(
        'INSERT INTO medicine_notification_jobs(occurrence_id,schedule_id,notification_id,scheduled_at,delivery,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(occurrence_id) DO UPDATE SET notification_id=excluded.notification_id,scheduled_at=excluded.scheduled_at,delivery=excluded.delivery,updated_at=excluded.updated_at',
        dose.id,
        dose.scheduleId,
        notificationId,
        dose.scheduledAt,
        delivery,
        new Date().toISOString(),
      );
    },

    async removeJob(id: string) {
      await db.runAsync('DELETE FROM medicine_notification_jobs WHERE occurrence_id=?', id);
    },
  };
  return repository;
}
