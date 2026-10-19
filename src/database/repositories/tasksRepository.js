import { DatabaseError, storageError } from '../errors.js';

/** @typedef {import('../../features/tasks/validation/taskInput.js').TaskInput} TaskInput */
/** @typedef {TaskInput & {id: string, createdAt: string, updatedAt: string, completedAt: string | null, subtaskCount: number, completedSubtaskCount: number}} Task */
/** @typedef {{id: string, taskId: string, title: string, completed: boolean, createdAt: string, updatedAt: string}} Subtask */
/** @typedef {{id: string, name: string}} TaskCategory */
/** @typedef {{search?: string, categoryId?: string | null, filter?: 'today' | 'upcoming' | 'overdue' | 'completed' | 'all', sort?: 'due' | 'priority' | 'recent', limit?: number, offset?: number}} TaskQuery */

/** @param {unknown} id */
function validId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) throw new DatabaseError('VALIDATION', 'Invalid record identifier.');
  return id;
}
/** @param {any} row @returns {Task | null} */
function taskFromRow(row) {
  return row ? { id: row.id, title: row.title, description: row.description, priority: row.priority, status: row.status, dueDate: row.due_date, dueTime: row.due_time, categoryId: row.category_id, completedAt: row.completed_at, createdAt: row.created_at, updatedAt: row.updated_at, subtaskCount: row.subtask_count ?? 0, completedSubtaskCount: row.completed_subtask_count ?? 0 } : null;
}
/** @param {any} row @returns {Subtask} */
const subtaskFromRow = (row) => ({ id: row.id, taskId: row.task_id, title: row.title, completed: row.completed === 1, createdAt: row.created_at, updatedAt: row.updated_at });
const taskSelect = `SELECT t.*, (SELECT COUNT(*) FROM subtasks s WHERE s.task_id=t.id) AS subtask_count,
  (SELECT COUNT(*) FROM subtasks s WHERE s.task_id=t.id AND s.completed=1) AS completed_subtask_count FROM tasks t`;
const overdueSql = "t.status != 'completed' AND t.due_date IS NOT NULL AND ((t.due_time IS NULL AND t.due_date < ?) OR (t.due_time IS NOT NULL AND t.due_date || 'T' || t.due_time || ':00.000' < ?))";
const sortSql = {
  due: "t.status='completed', t.due_date IS NULL, t.due_date, COALESCE(t.due_time,'24:00'), t.updated_at DESC, t.id",
  priority: "t.status='completed', CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.due_date IS NULL, t.due_date, COALESCE(t.due_time,'24:00'), t.updated_at DESC, t.id",
  recent: 't.updated_at DESC, t.id',
};

/** @param {import('../types.js').Database} db @param {() => string} createId */
export function createTasksRepository(db, createId) {
  return {
    /** Read-only Calendar projection; Tasks remain in their own table. @param {string} from @param {string} to */
    async listCalendarTasks(from, to) {
      try {
        const rows = await db.getAllAsync(`${taskSelect} WHERE t.due_date>=? AND t.due_date<? ORDER BY t.due_date,t.due_time,t.id LIMIT 2001`, from, to);
        if (rows.length > 2000) throw new DatabaseError('RANGE', 'Too many task deadlines. Choose a smaller calendar range.');
        return rows.map((row) => /** @type {Task} */ (taskFromRow(row)));
      } catch (error) { throw storageError(error, 'read task deadlines'); }
    },
    /** @param {TaskInput} input */
    async createTask(input) {
      const id = validId(createId()); const now = new Date().toISOString();
      try {
        const row = await db.getFirstAsync('INSERT INTO tasks (id,title,description,priority,status,due_date,due_time,category_id,completed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *', id, input.title, input.description, input.priority, input.status, input.dueDate, input.dueTime, input.categoryId, input.status === 'completed' ? now : null, now, now);
        return /** @type {Task} */ (taskFromRow(row));
      } catch (error) { throw storageError(error, 'create the task'); }
    },
    /** @param {string} id */
    async getTaskById(id) {
      validId(id);
      try { return taskFromRow(await db.getFirstAsync(`${taskSelect} WHERE t.id=?`, id)); }
      catch (error) { throw storageError(error, 'load the task'); }
    },
    /** @param {TaskQuery} options @param {{today: string, localNow: string}} clock */
    async listTasks(options, clock) {
      const { search = '', categoryId, filter = 'all', sort = 'due', limit = 50, offset = 0 } = options;
      if (typeof search !== 'string' || !['today','upcoming','overdue','completed','all'].includes(filter) || !Object.hasOwn(sortSql, sort) || !Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0) throw new DatabaseError('VALIDATION', 'Invalid task filters or pagination.');
      if (categoryId != null) validId(categoryId);
      // SQL fragments are selected exclusively from these reviewed constants.
      const predicates = {
        all: '1', completed: "t.status='completed'", today: "t.status!='completed' AND t.due_date=?",
        upcoming: "t.status!='completed' AND t.due_date>?", overdue: overdueSql,
      };
      const filterValues = filter === 'today' || filter === 'upcoming' ? [clock.today] : filter === 'overdue' ? [clock.today, clock.localNow] : [];
      try {
        const rows = await db.getAllAsync(`${taskSelect} WHERE (${predicates[filter]}) AND (?=0 OR t.category_id IS ?) AND (instr(lower(t.title),lower(?))>0 OR instr(lower(t.description),lower(?))>0) ORDER BY ${sortSql[sort]} LIMIT ? OFFSET ?`, ...filterValues, categoryId === undefined ? 0 : 1, categoryId ?? null, search.trim(), search.trim(), limit, offset);
        return rows.map((row) => /** @type {Task} */ (taskFromRow(row)));
      } catch (error) { throw storageError(error, 'list tasks'); }
    },
    /** @param {string} id @param {TaskInput} input */
    async updateTask(id, input) {
      validId(id); const now = new Date().toISOString();
      try {
        const row = await db.getFirstAsync(`UPDATE tasks SET title=?, description=?, priority=?, status=?, due_date=?, due_time=?, category_id=?,
          completed_at=CASE WHEN ?='completed' THEN COALESCE(completed_at,?) ELSE NULL END,
          updated_at=MAX(updated_at,created_at,?) WHERE id=? RETURNING *`, input.title, input.description, input.priority, input.status, input.dueDate, input.dueTime, input.categoryId, input.status, now, now, id);
        return taskFromRow(row);
      } catch (error) { throw storageError(error, 'update the task'); }
    },
    /** @param {string} id @param {import('../../features/tasks/validation/taskInput.js').Status} status */
    async setTaskStatus(id, status) {
      validId(id); const now = new Date().toISOString();
      try { return taskFromRow(await db.getFirstAsync(`UPDATE tasks SET status=?, completed_at=CASE WHEN ?='completed' THEN COALESCE(completed_at,?) ELSE NULL END, updated_at=MAX(updated_at,?) WHERE id=? RETURNING *`, status, status, now, now, id)); }
      catch (error) { throw storageError(error, 'change task status'); }
    },
    /** Single SQLite statement: FK cascade and triggers commit or roll back together. @param {string} id */
    async deleteTask(id) {
      validId(id);
      try { return (await db.runAsync('DELETE FROM tasks WHERE id=?', id)).changes === 1; }
      catch (error) { throw storageError(error, 'delete the task'); }
    },
    /** @param {{today: string, localNow: string}} clock */
    async summary(clock) {
      try {
        /** @type {{incomplete: number, today: number, overdue: number, completed: number} | null} */
        const row = await db.getFirstAsync(`SELECT COUNT(CASE WHEN t.status!='completed' THEN 1 END) AS incomplete,
          COUNT(CASE WHEN t.status!='completed' AND t.due_date=? THEN 1 END) AS today,
          COUNT(CASE WHEN ${overdueSql} THEN 1 END) AS overdue,
          COUNT(CASE WHEN t.status='completed' THEN 1 END) AS completed FROM tasks t`, clock.today, clock.today, clock.localNow);
        if (!row) throw new DatabaseError('STORAGE', 'Task summary unavailable.');
        return { ...row };
      } catch (error) { throw storageError(error, 'load task summary'); }
    },
    async listCategories() {
      try {
        /** @type {TaskCategory[]} */
        const rows = await db.getAllAsync('SELECT id,name FROM task_categories ORDER BY name COLLATE NOCASE,id');
        return rows.map((row) => ({ ...row }));
      } catch (error) { throw storageError(error, 'load task categories'); }
    },
    /** @param {string} name */
    async createCategory(name) {
      const id = validId(createId()); const now = new Date().toISOString();
      try { await db.runAsync('INSERT INTO task_categories (id,name,created_at,updated_at) VALUES (?,?,?,?)', id, name, now, now); return { id, name }; }
      catch (error) { throw storageError(error, 'create the category'); }
    },
    /** @param {string} id @param {string} name */
    async updateCategory(id, name) {
      validId(id);
      try { return (await db.runAsync('UPDATE task_categories SET name=?,updated_at=MAX(updated_at,?) WHERE id=?', name, new Date().toISOString(), id)).changes === 1; }
      catch (error) { throw storageError(error, 'rename the category'); }
    },
    /** @param {string} id */
    async deleteCategory(id) {
      validId(id);
      try { return (await db.runAsync('DELETE FROM task_categories WHERE id=?', id)).changes === 1; }
      catch (error) { throw storageError(error, 'delete the category'); }
    },
    /** @param {string} taskId */
    async listSubtasks(taskId) {
      validId(taskId);
      try { return (await db.getAllAsync('SELECT * FROM subtasks WHERE task_id=? ORDER BY created_at,id', taskId)).map(subtaskFromRow); }
      catch (error) { throw storageError(error, 'load subtasks'); }
    },
    /** @param {string} taskId @param {string} title */
    async createSubtask(taskId, title) {
      validId(taskId); const id = validId(createId()); const now = new Date().toISOString();
      try { return subtaskFromRow(await db.getFirstAsync('INSERT INTO subtasks (id,task_id,title,created_at,updated_at) VALUES (?,?,?,?,?) RETURNING *', id, taskId, title, now, now)); }
      catch (error) {
        const failure = storageError(error, 'create the subtask');
        if (failure.code === 'REFERENCE') throw new DatabaseError('REFERENCE', 'The parent task no longer exists. Return to Tasks.', error);
        throw failure;
      }
    },
    /** @param {string} id @param {string} title @param {boolean} completed */
    async updateSubtask(id, title, completed) {
      validId(id);
      if (typeof completed !== 'boolean') throw new DatabaseError('VALIDATION', 'Invalid checklist state.');
      try {
        const row = await db.getFirstAsync('UPDATE subtasks SET title=?,completed=?,updated_at=MAX(updated_at,?) WHERE id=? RETURNING *', title, Number(completed), new Date().toISOString(), id);
        return row ? subtaskFromRow(row) : null;
      } catch (error) { throw storageError(error, 'update the subtask'); }
    },
    /** @param {string} id */
    async deleteSubtask(id) {
      validId(id);
      try { return (await db.runAsync('DELETE FROM subtasks WHERE id=?', id)).changes === 1; }
      catch (error) { throw storageError(error, 'delete the subtask'); }
    },
  };
}
