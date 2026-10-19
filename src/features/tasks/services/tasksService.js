import { DatabaseError } from '../../../database/errors.js';
import { requiredTitle, stableId, taskStatus, validateTaskInput } from '../validation/taskInput.js';
import { isTaskOverdue, taskClock } from './taskDates.js';

/** @param {ReturnType<typeof import('../../../database/repositories/tasksRepository.js').createTasksRepository>} repository @param {() => Date} [now] */
export function createTasksService(repository, now = () => new Date()) {
  const listeners = new Set(/** @type {(() => void)[]} */ ([]));
  const notify = () => { for (const listener of listeners) listener(); };
  /** @template T @param {Promise<T>} operation */
  async function changed(operation) { const result = await operation; notify(); return result; }
  /** @template T @param {T | null} result */
  function found(result) { if (!result) throw new DatabaseError('NOT_FOUND', 'This record no longer exists. Refresh the task list.'); return result; }
  return {
    /** @param {() => void} listener */
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** @param {unknown} input */
    async createTask(input) { return changed(repository.createTask(validateTaskInput(input))); },
    /** @param {string} id */
    async getTaskById(id) { const task = await repository.getTaskById(stableId(id)); return task ? { ...task, overdue: isTaskOverdue(task, now()) } : null; },
    /** @param {import('../../../database/repositories/tasksRepository.js').TaskQuery} [options] */
    async listTasks(options = {}) {
      if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some((key) => !['search','categoryId','filter','sort','limit','offset'].includes(key))) throw new DatabaseError('VALIDATION', 'Invalid task list options.');
      const time = now();
      return (await repository.listTasks(options, taskClock(time))).map((task) => ({ ...task, overdue: isTaskOverdue(task, time) }));
    },
    /** @param {string} id @param {unknown} input */
    async updateTask(id, input) { const result = found(await repository.updateTask(stableId(id), validateTaskInput(input))); notify(); return result; },
    /** @param {string} id @param {unknown} status */
    async setTaskStatus(id, status) { const result = found(await repository.setTaskStatus(stableId(id), taskStatus(status))); notify(); return result; },
    /** @param {string} id @param {boolean} confirmed */
    async deleteTask(id, confirmed) { if (confirmed !== true) return false; return changed(repository.deleteTask(stableId(id))); },
    summary() { return repository.summary(taskClock(now())); },
    listCategories: repository.listCategories,
    /** @param {string} name */
    async createCategory(name) {
      try { return await changed(repository.createCategory(requiredTitle(name, 80))); }
      catch (error) { if (error instanceof DatabaseError && error.code === 'CONFLICT') throw new DatabaseError('CONFLICT', 'A task category with this name already exists.', error); throw error; }
    },
    /** @param {string} id @param {string} name */
    async updateCategory(id, name) { return changed(repository.updateCategory(stableId(id), requiredTitle(name, 80))); },
    /** @param {string} id @param {boolean} confirmed */
    async deleteCategory(id, confirmed) { if (confirmed !== true) return false; return changed(repository.deleteCategory(stableId(id))); },
    /** @param {string} id */
    async listSubtasks(id) { return repository.listSubtasks(stableId(id)); },
    /** @param {string} taskId @param {string} title */
    async createSubtask(taskId, title) { return changed(repository.createSubtask(stableId(taskId), requiredTitle(title))); },
    /** @param {string} id @param {string} title @param {boolean} completed */
    async updateSubtask(id, title, completed) { const result = found(await repository.updateSubtask(stableId(id), requiredTitle(title), completed)); notify(); return result; },
    /** @param {string} id @param {boolean} confirmed */
    async deleteSubtask(id, confirmed) { if (confirmed !== true) return false; return changed(repository.deleteSubtask(stableId(id))); },
  };
}
