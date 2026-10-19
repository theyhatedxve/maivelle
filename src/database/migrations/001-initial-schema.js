/** @type {import('../types.js').Migration} */
export const initialSchema = {
  version: 1,
  name: 'initial-settings-and-notes',
  sql: `
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY NOT NULL CHECK(length(key) BETWEEN 1 AND 128),
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL CHECK(updated_at >= created_at)
    );
    CREATE TABLE note_categories (
      id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
      name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL CHECK(updated_at >= created_at)
    );
    CREATE TABLE notes (
      id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
      title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 240),
      body TEXT NOT NULL DEFAULT '' CHECK(length(body) <= 100000),
      category_id TEXT REFERENCES note_categories(id) ON UPDATE RESTRICT ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL CHECK(updated_at >= created_at)
    );
  `,
};
