import * as SQLite from 'expo-sqlite';
import { uuid } from 'expo';
import { initializeDatabase } from '../../database/initialize.ts';
import { migrations } from '../../database/migrations/index.ts';
import { createNotesRepository } from '../../database/repositories/notesRepository.ts';
import { createTasksRepository } from '../../database/repositories/tasksRepository.ts';
import { createTasksService } from '../../features/tasks/services/tasksService.ts';
import { DatabaseError } from '../../database/errors.ts';

function ensure(condition: unknown, label: string) {
  if (!condition) throw new DatabaseError('TEST_FAILED', label);
}
export async function runNativeTaskChecks() {
  if (!__DEV__)
    throw new DatabaseError(
      'DEVELOPMENT_ONLY',
      'Synthetic diagnostics are disabled in release builds.',
    );
  const filename = `maivelle-isolated-tasks-${uuid.v4()}.db`;
  const db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });
  const results = [];
  let passed = false;
  try {
    await initializeDatabase(db, migrations.slice(0, 3));
    const notes = createNotesRepository(db, uuid.v4);
    const note = await notes.create({ title: 'Synthetic pre-Tasks note' });
    await initializeDatabase(db);
    await initializeDatabase(db);
    ensure(
      (await notes.getById(note.id))?.title === note.title &&
        (
          await db.getAllAsync<import('../../database/rows.ts').MigrationLedgerRow>(
            'SELECT * FROM schema_migrations',
          )
        ).length === migrations.length,
      'Migration preserves existing Notes and is idempotent',
    );
    results.push('PASS: migration 4 preserves Notes and is idempotent');
    const service = createTasksService(
      createTasksRepository(db, uuid.v4),
      () => new Date(2026, 9, 19, 12, 0, 0, 500),
    );
    const category = await service.createCategory('Synthetic task category');
    const task = await service.createTask({
      title: 'Synthetic native task',
      description: '100%_ literal fixture',
      categoryId: category.id,
      dueDate: '2026-10-19',
      dueTime: '09:00',
      priority: 'urgent',
    });
    ensure(
      (await service.listTasks({ search: '100%_', filter: 'overdue', categoryId: category.id }))[0]
        ?.id === task.id,
      'Bound search and filters',
    );
    const updated = await service.updateTask(task.id, { ...task, title: 'Updated native fixture' });
    ensure(
      updated.createdAt === task.createdAt && updated.id === task.id,
      'Edit preserves identity',
    );
    results.push('PASS: task create/read/edit, literal search, category and overdue filters');
    const complete = await service.setTaskStatus(task.id, 'completed');
    ensure(
      complete.completedAt &&
        (await service.summary()).completed === 1 &&
        (await service.listTasks({ filter: 'overdue' })).length === 0,
      'Completion timestamp and filters',
    );
    ensure(
      (await service.setTaskStatus(task.id, 'todo')).completedAt === null &&
        (await service.summary()).today === 1,
      'Reopen clears completion',
    );
    const dateOnly = await service.createTask({
      title: 'Synthetic date only',
      dueDate: '2026-10-19',
    });
    ensure(
      !(await service.getTaskById(dateOnly.id))?.overdue && (await service.summary()).overdue === 1,
      'Date-only deadline',
    );
    results.push('PASS: completion/reopen timestamps, summary and date-only deadlines');
    const subtask = await service.createSubtask(task.id, 'Synthetic checklist item');
    await service.updateSubtask(subtask.id, 'Updated checklist item', true);
    ensure((await service.getTaskById(task.id))?.completedSubtaskCount === 1, 'Subtask progress');
    await service.updateCategory(category.id, 'Renamed synthetic category');
    await service.deleteCategory(category.id, true);
    ensure(
      (await service.getTaskById(task.id))?.categoryId === null &&
        (await service.listSubtasks(task.id)).length === 1,
      'Category removal preserves records',
    );
    ensure(
      !(await service.deleteTask(task.id, false)) && (await service.getTaskById(task.id)),
      'Cancelled delete',
    );
    ensure(
      (await service.deleteTask(task.id, true)) &&
        (await service.listSubtasks(task.id)).length === 0,
      'Parent cascade',
    );
    results.push('PASS: categories, subtask CRUD/progress, cancelled delete and parent cascade');
    let rejected = false;
    try {
      await service.createTask({ title: '', dueDate: '2026-02-30' });
    } catch (error) {
      rejected = error instanceof DatabaseError && error.code === 'VALIDATION';
    }
    ensure(rejected, 'Invalid input rejected');
    await service.deleteTask(dateOnly.id, true);
    ensure((await service.summary()).incomplete === 0, 'Cleanup count');
    results.push('PASS: invalid task input and deletion counts');
    passed = true;
    return results;
  } finally {
    await db.closeAsync();
    // Only this invocation's isolated fixture is removed, never the application file.
    if (passed) await SQLite.deleteDatabaseAsync(filename);
  }
}
