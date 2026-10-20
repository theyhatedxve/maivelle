import { DatabaseError } from '../../../database/errors.js';
import {
  instant,
  invalid,
  projectInput,
  recordId,
  sessionInput,
  text,
} from '../validation/timeInput.js';
import { aggregateTime, periods } from './timeAnalytics.js';

/** @param {ReturnType<import('../../../database/repositories/timeTrackerRepository.js').createTimeTrackerRepository>} repository @param {() => number} [clock] */
export function createTimeTrackerService(repository, clock = Date.now) {
  /** @type {Set<() => void>} */ const listeners = new Set();
  let mutating = false;
  /** @template T @param {() => Promise<T>} action */
  async function mutate(action) {
    if (mutating)
      throw new DatabaseError(
        'BUSY',
        'A time tracker change is saving. Please wait.'
      );
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
    /** @param {() => void} listener */ subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    projects: () => repository.projects(clock()),
    active: () => repository.active(),
    /** @param {string} id */ get: async (id) => repository.get(recordId(id)),
    /** @param {string | null} id @param {import('../validation/timeInput.js').ProjectInput} input */
    saveProject: (id, input) =>
      mutate(() => repository.saveProject(id, projectInput(input), clock())),
    /** @param {string} id */ deleteProject: (id) =>
      mutate(() => repository.deleteProject(id)),
    /** @param {string} projectId @param {string} title */
    start: (projectId, title) =>
      mutate(() =>
        repository.start(
          recordId(projectId),
          text(title, 240, 'Session title'),
          clock()
        )
      ),
    /** @param {import('../../../database/repositories/timeTrackerRepository.js').TimeSession} session @param {'pause'|'resume'|'stop'} action */
    transition: (session, action) =>
      mutate(() =>
        repository.transition(session.id, session.revision, action, clock())
      ),
    /** @param {import('../../../database/repositories/timeTrackerRepository.js').TimeSession} session @param {string} end */
    recover: (session, end) =>
      mutate(() =>
        repository.recover(session.id, session.revision, instant(end), clock())
      ),
    /** @param {string | null} id @param {number | null} revision @param {import('../validation/timeInput.js').SessionInput} input */
    saveSession: (id, revision, input) =>
      mutate(() =>
        repository.saveSession(
          id,
          revision,
          sessionInput(input, clock()),
          clock()
        )
      ),
    /** @param {import('../../../database/repositories/timeTrackerRepository.js').TimeSession} session @param {boolean} [discard] */
    remove: (session, discard = false) =>
      mutate(() => repository.remove(session.id, session.revision, discard)),
    /** @param {import('../../../database/repositories/timeTrackerRepository.js').HistoryQuery} options */
    history: (options) => repository.history(options),
    /** @param {number} from @param {number} to */
    async statistics(from, to) {
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
