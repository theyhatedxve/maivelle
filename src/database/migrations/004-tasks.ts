export const tasksSchema: import('../types.ts').Migration = {
  version: 4,
  name: 'tasks-categories-and-subtasks',
  sql: `
    CREATE TABLE task_categories (
      id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
      name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL CHECK(updated_at >= created_at)
    );
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
      title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 240),
      description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 100000),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'completed')),
      due_date TEXT CHECK(due_date IS NULL OR (length(due_date) = 10 AND due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(due_date, '+0 days') IS NOT NULL AND date(due_date, '+0 days') = due_date)),
      due_time TEXT CHECK(due_time IS NULL OR (due_date IS NOT NULL AND length(due_time) = 5 AND due_time GLOB '[0-2][0-9]:[0-5][0-9]' AND substr(due_time, 1, 2) <= '23')),
      category_id TEXT REFERENCES task_categories(id) ON DELETE SET NULL ON UPDATE RESTRICT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL CHECK(updated_at >= created_at),
      CHECK((status = 'completed' AND completed_at IS NOT NULL) OR (status != 'completed' AND completed_at IS NULL))
    );
    CREATE TABLE subtasks (
      id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE RESTRICT,
      title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 240),
      completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL CHECK(updated_at >= created_at)
    );
    CREATE INDEX tasks_status_due_idx ON tasks(status, due_date, due_time, id);
    CREATE INDEX tasks_updated_idx ON tasks(updated_at DESC, id);
    CREATE INDEX tasks_category_idx ON tasks(category_id);
    CREATE INDEX subtasks_parent_idx ON subtasks(task_id, created_at, id);
    CREATE TRIGGER subtasks_insert_touch AFTER INSERT ON subtasks BEGIN
      UPDATE tasks SET updated_at = MAX(updated_at, NEW.updated_at) WHERE id = NEW.task_id;
    END;
    CREATE TRIGGER subtasks_update_touch AFTER UPDATE ON subtasks BEGIN
      UPDATE tasks SET updated_at = MAX(updated_at, NEW.updated_at) WHERE id = NEW.task_id;
    END;
    CREATE TRIGGER subtasks_delete_touch AFTER DELETE ON subtasks BEGIN
      UPDATE tasks SET updated_at = MAX(updated_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = OLD.task_id;
    END;
  `,
};
