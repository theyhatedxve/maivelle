import { DatabaseError } from '../../../database/errors.ts';
import { requiredTitle, stableId, taskStatus, validateTaskInput } from '../validation/taskInput.ts';
import { isTaskOverdue, taskClock } from './taskDates.ts';

export function createTasksService(
  repository: ReturnType<
    typeof import('../../../database/repositories/tasksRepository.ts').createTasksRepository
  >,
  now: () => Date = () => new Date(),
) {
  const listeners = new Set([] as (() => void)[]);
  const notify = () => {
    for (const listener of listeners) listener();
  };

  async function changed<T>(operation: Promise<T>) {
    const result = await operation;
    notify();
    return result;
  }

  function found<T>(result: T | null) {
    if (!result)
      throw new DatabaseError('NOT_FOUND', 'This record no longer exists. Refresh the task list.');
    return result;
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async createTask(input: unknown) {
      return changed(repository.createTask(validateTaskInput(input)));
    },

    async getTaskById(id: string) {
      const task = await repository.getTaskById(stableId(id));
      return task ? { ...task, overdue: isTaskOverdue(task, now()) } : null;
    },

    async listTasks(
      options: import('../../../database/repositories/tasksRepository.ts').TaskQuery = {},
    ) {
      if (
        !options ||
        typeof options !== 'object' ||
        Array.isArray(options) ||
        Object.keys(options).some(
          (key) => !['search', 'categoryId', 'filter', 'sort', 'limit', 'offset'].includes(key),
        )
      )
        throw new DatabaseError('VALIDATION', 'Invalid task list options.');
      const time = now();
      return (await repository.listTasks(options, taskClock(time))).map((task) => ({
        ...task,
        overdue: isTaskOverdue(task, time),
      }));
    },

    async updateTask(id: string, input: unknown) {
      const result = found(await repository.updateTask(stableId(id), validateTaskInput(input)));
      notify();
      return result;
    },

    async setTaskStatus(id: string, status: unknown) {
      const result = found(await repository.setTaskStatus(stableId(id), taskStatus(status)));
      notify();
      return result;
    },

    async deleteTask(id: string, confirmed: boolean) {
      if (confirmed !== true) return false;
      return changed(repository.deleteTask(stableId(id)));
    },
    summary() {
      return repository.summary(taskClock(now()));
    },
    listCategories: repository.listCategories,

    async createCategory(name: string) {
      try {
        return await changed(repository.createCategory(requiredTitle(name, 80)));
      } catch (error) {
        if (error instanceof DatabaseError && error.code === 'CONFLICT')
          throw new DatabaseError(
            'CONFLICT',
            'A task category with this name already exists.',
            error,
          );
        throw error;
      }
    },

    async updateCategory(id: string, name: string) {
      return changed(repository.updateCategory(stableId(id), requiredTitle(name, 80)));
    },

    async deleteCategory(id: string, confirmed: boolean) {
      if (confirmed !== true) return false;
      return changed(repository.deleteCategory(stableId(id)));
    },

    async listSubtasks(id: string) {
      return repository.listSubtasks(stableId(id));
    },

    async createSubtask(taskId: string, title: string) {
      return changed(repository.createSubtask(stableId(taskId), requiredTitle(title)));
    },

    async updateSubtask(id: string, title: string, completed: boolean) {
      const result = found(
        await repository.updateSubtask(stableId(id), requiredTitle(title), completed),
      );
      notify();
      return result;
    },

    async deleteSubtask(id: string, confirmed: boolean) {
      if (confirmed !== true) return false;
      return changed(repository.deleteSubtask(stableId(id)));
    },
  };
}
