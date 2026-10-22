import { DatabaseError } from '../../../database/errors.ts';
import {
  instant,
  invalid,
  projectInput,
  recordId,
  sessionInput,
  text,
} from '../validation/timeInput.ts';
import { aggregateTime, periods } from './timeAnalytics.ts';

export function createTimeTrackerService(
  repository: ReturnType<
    typeof import('../../../database/repositories/timeTrackerRepository.ts').createTimeTrackerRepository
  >,
  clock: () => number = Date.now,
) {
  const listeners: Set<() => void> = new Set();
  let mutating = false;

  async function mutate<T>(action: () => Promise<T>) {
    if (mutating) throw new DatabaseError('BUSY', 'A time tracker change is saving. Please wait.');
    mutating = true;
    try {
      const value = await action();
      listeners.forEach((listener) => listener());
      return value;
    } finally {
      mutating = false;
    }
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    projects: () => repository.projects(clock()),
    active: () => repository.active(),
    get: async (id: string) => repository.get(recordId(id)),

    saveProject: (id: string | null, input: import('../validation/timeInput.ts').ProjectInput) =>
      mutate(() => repository.saveProject(id, projectInput(input), clock())),
    deleteProject: (id: string) => mutate(() => repository.deleteProject(id)),

    start: (projectId: string, title: string) =>
      mutate(() =>
        repository.start(recordId(projectId), text(title, 240, 'Session title'), clock()),
      ),

    transition: (
      session: import('../../../database/repositories/timeTrackerRepository.ts').TimeSession,
      action: 'pause' | 'resume' | 'stop',
    ) => mutate(() => repository.transition(session.id, session.revision, action, clock())),

    recover: (
      session: import('../../../database/repositories/timeTrackerRepository.ts').TimeSession,
      end: string,
    ) => mutate(() => repository.recover(session.id, session.revision, instant(end), clock())),

    saveSession: (
      id: string | null,
      revision: number | null,
      input: import('../validation/timeInput.ts').SessionInput,
    ) => mutate(() => repository.saveSession(id, revision, sessionInput(input, clock()), clock())),

    remove: (
      session: import('../../../database/repositories/timeTrackerRepository.ts').TimeSession,
      discard: boolean = false,
    ) => mutate(() => repository.remove(session.id, session.revision, discard)),

    history: (
      options: import('../../../database/repositories/timeTrackerRepository.ts').HistoryQuery,
    ) => repository.history(options),

    async statistics(from: number, to: number) {
      if (
        !Number.isSafeInteger(from) ||
        !Number.isSafeInteger(to) ||
        from < 0 ||
        to <= from ||
        to - from > 366 * 86400000
      )
        invalid('Choose a statistics range of at most one year.');
      const now = clock();
      return aggregateTime(await repository.slices(from, to), from, to, now);
    },
    async summary() {
      const now = clock();
      const starts = periods(now);
      const from = Math.min(starts.week, starts.month);
      const rows = await repository.slices(from, now + 1);
      return {
        today: aggregateTime(rows, starts.day, now + 1, now),
        week: aggregateTime(rows, starts.week, now + 1, now),
        month: aggregateTime(rows, starts.month, now + 1, now),
        active: await repository.active(),
      };
    },
  };
}
