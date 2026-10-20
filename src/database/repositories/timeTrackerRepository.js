import { DatabaseError, storageError } from '../errors.js';
import { recordId } from '../../features/timeTracker/validation/timeInput.js';

/** @typedef {{id: string, name: string, description: string, color: string, archived: number, created_at: string, updated_at: string, total_ms: number}} TimeProject */
/** @typedef {{id: string, session_id: string, start_ms: number, end_ms: number | null}} TimeSegment */
/** @typedef {{id: string, title: string, project_id: string | null, project_name: string, project_color: string, type: 'timer' | 'manual', status: 'running' | 'paused' | 'completed', revision: number, created_at: string, updated_at: string, segments: TimeSegment[]}} TimeSession */
/** @typedef {{from?: number, to?: number, projectId?: string, type?: string, offset?: number, limit?: number}} HistoryQuery */
/** @param {import('expo-sqlite').SQLiteDatabase} db @param {() => string} createId */
export function createTimeTrackerRepository(db, createId) {
  // Serialize this repository's writes as well as using SQLite's exclusive transaction.
  // The native transaction handle may not inherit foreign_keys; explicit deletes and
  // FK validation also protect it. Production encryption remains gated upstream.
  let queue = Promise.resolve();
  /** @template T @param {(tx: import('expo-sqlite').SQLiteDatabase) => Promise<T>} action */
  function write(action) {
    const operation = queue.then(async () => {
      /** @type {T | undefined} */ let value;
      try {
        await db.withExclusiveTransactionAsync(async (tx) => {
          value = await action(tx);
          if ((await tx.getAllAsync('PRAGMA foreign_key_check')).length)
            throw new DatabaseError(
              'REFERENCE',
              'The selected activity no longer exists.'
            );
        });
        return /** @type {T} */ (value);
      } catch (error) {
        throw storageError(error, 'save time tracker changes');
      }
    });
    queue = operation.then(
      () => {},
      () => {}
    );
    return operation;
  }
  /** @param {import('expo-sqlite').SQLiteDatabase} tx @param {string} id @returns {Promise<TimeSession | null>} */
  async function load(tx, id) {
    const session = await tx.getFirstAsync(
      'SELECT * FROM time_sessions WHERE id=?',
      id
    );
    if (!session) return null;
    return {
      ...session,
      segments: await tx.getAllAsync(
        'SELECT * FROM time_session_segments WHERE session_id=? ORDER BY start_ms,id',
        id
      ),
    };
  }
  /** @param {import('expo-sqlite').SQLiteDatabase} tx @param {string} id @param {boolean} [allowArchived] */
  async function project(tx, id, allowArchived = false) {
    const row = await tx.getFirstAsync(
      'SELECT * FROM time_projects WHERE id=?',
      recordId(id)
    );
    if (!row || (!allowArchived && row.archived))
      throw new DatabaseError(
        'REFERENCE',
        'Choose an existing, unarchived activity.'
      );
    return row;
  }
  /** @param {import('expo-sqlite').SQLiteDatabase} tx @param {string} id @param {number} revision */
  async function current(tx, id, revision) {
    const session = await load(tx, recordId(id));
    if (!session)
      throw new DatabaseError('NOT_FOUND', 'This session no longer exists.');
    if (session.revision !== revision)
      throw new DatabaseError(
        'CONFLICT',
        'This session changed. Refresh before trying again.'
      );
    return session;
  }
  return {
    /** @param {number} now */
    async projects(now) {
      return /** @type {TimeProject[]} */ (
        await db.getAllAsync(
          `SELECT p.*,COALESCE((SELECT SUM(MAX(0,COALESCE(g.end_ms,?)-g.start_ms)) FROM time_sessions s JOIN time_session_segments g ON s.id=g.session_id WHERE s.project_id=p.id),0) total_ms FROM time_projects p ORDER BY p.archived,p.name COLLATE NOCASE,p.id`,
          now
        )
      );
    },
    /** @param {string | null} id @param {import('../../features/timeTracker/validation/timeInput.js').ProjectInput} input @param {number} now */
    saveProject(id, input, now) {
      return write(async (tx) => {
        const stamp = new Date(now).toISOString();
        if (id) {
          if (
            !(
              await tx.runAsync(
                'UPDATE time_projects SET name=?,description=?,color=?,archived=?,updated_at=MAX(updated_at,?) WHERE id=?',
                input.name,
                input.description,
                input.color,
                Number(input.archived),
                stamp,
                recordId(id)
              )
            ).changes
          )
            throw new DatabaseError('NOT_FOUND', 'Activity no longer exists.');
        } else {
          id = recordId(createId());
          await tx.runAsync(
            'INSERT INTO time_projects(id,name,description,color,archived,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
            id,
            input.name,
            input.description,
            input.color,
            Number(input.archived),
            stamp,
            stamp
          );
        }
        return id;
      });
    },
    /** Preserve snapshots/history even on transaction connections without FK enabled. @param {string} id */
    deleteProject(id) {
      return write(async (tx) => {
        recordId(id);
        if (
          await tx.getFirstAsync(
            "SELECT id FROM time_sessions WHERE project_id=? AND status!='completed'",
            id
          )
        )
          throw new DatabaseError(
            'CONFLICT',
            'Stop or discard the active session before deleting its activity.'
          );
        await tx.runAsync(
          'UPDATE time_sessions SET project_id=NULL WHERE project_id=?',
          id
        );
        return (
          (await tx.runAsync('DELETE FROM time_projects WHERE id=?', id))
            .changes === 1
        );
      });
    },
    async active() {
      const row = await db.getFirstAsync(
        "SELECT id FROM time_sessions WHERE status IN ('running','paused')"
      );
      return row ? load(db, row.id) : null;
    },
    /** @param {string} id */
    get(id) {
      return load(db, recordId(id));
    },
    /** @param {string} projectId @param {string} title @param {number} now */
    start(projectId, title, now) {
      return write(async (tx) => {
        if (
          await tx.getFirstAsync(
            "SELECT id FROM time_sessions WHERE status!='completed'"
          )
        )
          throw new DatabaseError(
            'CONFLICT',
            'A timer is already running or paused.'
          );
        const activity = await project(tx, projectId);
        const id = recordId(createId());
        const stamp = new Date(now).toISOString();
        await tx.runAsync(
          "INSERT INTO time_sessions(id,project_id,project_name,project_color,title,type,status,created_at,updated_at) VALUES(?,?,?,?,?,'timer','running',?,?)",
          id,
          projectId,
          activity.name,
          activity.color,
          title,
          stamp,
          stamp
        );
        await tx.runAsync(
          'INSERT INTO time_session_segments(id,session_id,start_ms) VALUES(?,?,?)',
          recordId(createId()),
          id,
          now
        );
        return /** @type {TimeSession} */ (await load(tx, id));
      });
    },
    /** Explicit optimistic transitions reject stale/double taps, never toggle.
     * @param {string} id @param {number} revision @param {'pause'|'resume'|'stop'} action @param {number} now */
    transition(id, revision, action, now) {
      return write(async (tx) => {
        if (!['pause', 'resume', 'stop'].includes(action))
          throw new DatabaseError('VALIDATION', 'Unknown timer action.');
        const session = await current(tx, id, revision);
        const expected = action === 'resume' ? 'paused' : 'running';
        if (
          session.status !== expected &&
          !(action === 'stop' && session.status === 'paused')
        )
          throw new DatabaseError(
            'CONFLICT',
            'That timer action is no longer available. Refresh the timer.'
          );
        const open = session.segments.find(
          (segment) => segment.end_ms === null
        );
        const latest = Math.max(
          ...session.segments.map(
            (segment) => segment.end_ms ?? segment.start_ms
          )
        );
        if (now < latest && !(action === 'stop' && session.status === 'paused'))
          throw new DatabaseError(
            'CLOCK',
            'The clock moved backwards. Review recovery time before continuing.'
          );
        if (session.status === 'running') {
          if (!open)
            throw new DatabaseError(
              'STORAGE',
              'Running timer has no open segment. Do not reset the database.'
            );
          await tx.runAsync(
            'UPDATE time_session_segments SET end_ms=? WHERE id=? AND end_ms IS NULL',
            now,
            open.id
          );
        }
        const status =
          action === 'resume'
            ? 'running'
            : action === 'pause'
              ? 'paused'
              : 'completed';
        await tx.runAsync(
          'UPDATE time_sessions SET status=?,revision=revision+1,updated_at=MAX(updated_at,?) WHERE id=?',
          status,
          new Date(now).toISOString(),
          id
        );
        if (action === 'resume')
          await tx.runAsync(
            'INSERT INTO time_session_segments(id,session_id,start_ms) VALUES(?,?,?)',
            recordId(createId()),
            id,
            now
          );
        return /** @type {TimeSession} */ (await load(tx, id));
      });
    },
    /** Explicit user-reviewed end, including a backwards clock correction. @param {string} id @param {number} revision @param {number} end @param {number} now */
    recover(id, revision, end, now) {
      return write(async (tx) => {
        const session = await current(tx, id, revision);
        const open = session.segments.find(
          (segment) => segment.end_ms === null
        );
        if (
          session.status !== 'running' ||
          !open ||
          end < open.start_ms ||
          end > Math.max(now, open.start_ms)
        )
          throw new DatabaseError(
            'VALIDATION',
            'Recovery end must be between the running segment start and now (or its start if the clock moved backwards).'
          );
        await tx.runAsync(
          'UPDATE time_session_segments SET end_ms=? WHERE id=?',
          end,
          open.id
        );
        await tx.runAsync(
          "UPDATE time_sessions SET status='completed',revision=revision+1,updated_at=MAX(updated_at,?) WHERE id=?",
          new Date(now).toISOString(),
          id
        );
        return load(tx, id);
      });
    },
    /** @param {string | null} id @param {number | null} revision @param {ReturnType<import('../../features/timeTracker/validation/timeInput.js').sessionInput>} input @param {number} now */
    saveSession(id, revision, input, now) {
      return write(async (tx) => {
        const existing = id
          ? await current(tx, id, /** @type {number} */ (revision))
          : null;
        if (existing && existing.status !== 'completed')
          throw new DatabaseError(
            'CONFLICT',
            'Stop the timer before editing its history.'
          );
        const activity = await project(
          tx,
          input.projectId,
          existing?.project_id === input.projectId
        );
        const stamp = new Date(now).toISOString();
        if (existing) {
          await tx.runAsync(
            'UPDATE time_sessions SET title=?,project_id=?,project_name=?,project_color=?,revision=revision+1,updated_at=MAX(updated_at,?) WHERE id=?',
            input.title,
            input.projectId,
            activity.name,
            activity.color,
            stamp,
            existing.id
          );
          await tx.runAsync(
            'DELETE FROM time_session_segments WHERE session_id=?',
            existing.id
          );
        } else {
          id = recordId(createId());
          await tx.runAsync(
            "INSERT INTO time_sessions(id,project_id,project_name,project_color,title,type,status,created_at,updated_at) VALUES(?,?,?,?,?,'manual','completed',?,?)",
            id,
            input.projectId,
            activity.name,
            activity.color,
            input.title,
            stamp,
            stamp
          );
        }
        for (const segment of input.segments)
          await tx.runAsync(
            'INSERT INTO time_session_segments(id,session_id,start_ms,end_ms) VALUES(?,?,?,?)',
            recordId(createId()),
            id,
            segment.start,
            segment.end
          );
        return /** @type {TimeSession} */ (
          await load(tx, /** @type {string} */ (id))
        );
      });
    },
    /** @param {string} id @param {number} revision @param {boolean} discard */
    remove(id, revision, discard = false) {
      return write(async (tx) => {
        const session = await current(tx, id, revision);
        if ((session.status !== 'completed') !== discard)
          throw new DatabaseError(
            'CONFLICT',
            'Session state changed. Refresh before deleting or discarding.'
          );
        await tx.runAsync(
          'DELETE FROM time_session_segments WHERE session_id=?',
          id
        );
        await tx.runAsync('DELETE FROM time_sessions WHERE id=?', id);
        return true;
      });
    },
    /** @param {HistoryQuery} options */
    async history({
      from = 0,
      to = 253402300799999,
      projectId,
      type = 'all',
      offset = 0,
      limit = 50,
    } = {}) {
      if (
        !Number.isSafeInteger(from) ||
        !Number.isSafeInteger(to) ||
        to <= from ||
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !['all', 'timer', 'manual'].includes(type)
      )
        throw new DatabaseError(
          'VALIDATION',
          'Invalid history range, type or page.'
        );
      if (projectId) recordId(projectId);
      const rows = await db.getAllAsync(
        `SELECT s.*,MIN(g.start_ms) start_ms,MAX(g.end_ms) end_ms,SUM(CASE WHEN g.end_ms IS NULL THEN 0 ELSE g.end_ms-g.start_ms END) duration_ms FROM time_sessions s JOIN time_session_segments g ON s.id=g.session_id WHERE s.status='completed' AND (? IS NULL OR s.project_id=?) AND (?='all' OR s.type=?) AND EXISTS(SELECT 1 FROM time_session_segments x WHERE x.session_id=s.id AND x.start_ms<? AND x.end_ms>=?) GROUP BY s.id ORDER BY start_ms DESC,s.id LIMIT ? OFFSET ?`,
        projectId ?? null,
        projectId ?? null,
        type,
        type,
        to,
        from,
        limit,
        offset
      );
      return /** @type {(Omit<TimeSession,'segments'> & {start_ms:number,end_ms:number,duration_ms:number})[]} */ (
        rows
      );
    },
    /** @param {number} from @param {number} to @returns {Promise<import('../../features/timeTracker/services/timeAnalytics.js').TimeSlice[]>} */
    slices(from, to) {
      return db.getAllAsync(
        `SELECT s.id,s.project_id,COALESCE(p.name,s.project_name) project_name,COALESCE(p.color,s.project_color) project_color,s.type,s.status,g.start_ms,g.end_ms FROM time_session_segments g JOIN time_sessions s ON s.id=g.session_id LEFT JOIN time_projects p ON p.id=s.project_id WHERE g.start_ms<? AND (g.end_ms IS NULL OR g.end_ms>?)`,
        to,
        from
      );
    },
  };
}
