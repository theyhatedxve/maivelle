import { DatabaseError } from '../../../database/errors.ts';
import { medicineId } from '../../../database/repositories/medicineRepository.ts';
import { validateMedicine } from '../validation/medicineInput.ts';
import { generateDoses, localStamp, MAX_DOSES } from './doseOccurrences.ts';
import {
  addDays,
  localToday,
  validateLocal,
  validateRange,
} from '../../calendar/services/calendarDates.ts';

export function createMedicineService(
  repository: ReturnType<
    typeof import('../../../database/repositories/medicineRepository.ts').createMedicineRepository
  >,
  clock: () => Date = () => new Date(),
) {
  const listeners: Set<() => void> = new Set();
  const emit = () => listeners.forEach((listener) => listener());
  // Serialize medicine saves and dose actions; notifications have their own serialized reconciler.
  let queue = Promise.resolve();

  function mutate<T>(action: () => Promise<T>): Promise<T> {
    const task = queue.then(action);
    queue = task.then(
      () => {},
      () => {},
    );
    return task;
  }
  const service = {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    list: repository.list,
    get: repository.get,

    save(id: string | null, value: unknown, revision: number | null = null) {
      return mutate(async () => {
        const input = validateMedicine(value);
        const now = clock();
        // Civil +1 ms keeps a slot that is already due on the old revision, even
        // when the save lands exactly on its minute or at a DST fall-back boundary.
        const cutover = new Date(Date.parse(`${localStamp(now)}Z`) + 1).toISOString().slice(0, -1);
        const result = await repository.save(id, input, revision, cutover, now);
        emit();
        return result;
      });
    },

    async doses(from: string, to: string, id: string | null = null) {
      validateRange(from, to);
      if (id !== null) medicineId(id);
      const schedules = await repository.schedules(from, to);
      const doses = generateDoses(schedules, from, to, clock());
      const logs = await repository.logs(from, to);
      if (logs.length > MAX_DOSES)
        throw new DatabaseError('RANGE', 'Too much dose history. Choose a smaller range.');
      const byId = new Map(doses.map((dose) => [dose.id, dose]));
      for (const log of logs) {
        byId.set(log.occurrence_id, {
          id: log.occurrence_id,
          scheduleId: log.schedule_id,
          medicineId: log.medicine_id,
          local: log.scheduled_local,
          scheduledAt: log.scheduled_at,
          timezone: log.timezone,
          name: log.name_snapshot,
          instructions: log.instructions_snapshot,
          status: log.status,
          actionAt: log.action_at,
        });
      }
      if (byId.size > MAX_DOSES)
        throw new DatabaseError('RANGE', 'Too many doses. Choose a smaller range.');
      return [...byId.values()]
        .filter((dose) => !id || dose.medicineId === id)
        .sort((a, b) => a.local.localeCompare(b.local) || a.id.localeCompare(b.id));
    },
    /** Never accept scheduled timestamps or snapshots supplied by the UI. */
    record(occurrenceId: string, status: 'taken' | 'skipped') {
      return mutate(async () => {
        if (typeof occurrenceId !== 'string' || !['taken', 'skipped'].includes(status))
          throw new DatabaseError('VALIDATION', 'Choose Taken or Skipped.');
        const parts = occurrenceId.split('/');
        medicineId(parts[0]);
        validateLocal(parts[1]);
        if (parts.length !== 2) throw new DatabaseError('VALIDATION', 'Invalid dose occurrence.');
        const date = parts[1].slice(0, 10);
        const doses = await service.doses(date, addDays(date, 1));
        const dose = doses.find((entry) => entry.id === occurrenceId);
        if (!dose)
          throw new DatabaseError('NOT_FOUND', 'Dose is no longer scheduled. Refresh the screen.');
        if (['taken', 'skipped'].includes(dose.status))
          throw new DatabaseError('CONFLICT', 'This dose already has a recorded action.');
        if (new Date(dose.scheduledAt) > clock())
          throw new DatabaseError('VALIDATION', 'Record a dose at or after its scheduled time.');
        await repository.log(dose, status, clock());
        emit();
      });
    },
    async summary() {
      const today = localToday(clock());
      const doses = await service.doses(today, addDays(today, 1));
      return {
        scheduled: doses.length,
        completed: doses.filter((dose) => ['taken', 'skipped'].includes(dose.status)).length,
        taken: doses.filter((dose) => dose.status === 'taken').length,
        skipped: doses.filter((dose) => dose.status === 'skipped').length,
        missed: doses.filter((dose) => dose.status === 'missed').length,
        doses,
      };
    },
  };
  return service;
}
