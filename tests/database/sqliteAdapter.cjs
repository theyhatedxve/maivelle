const { DatabaseSync } = require('node:sqlite');

// Real SQLite, not a SQL mock. This adapter only supplies Expo's async method shape.
function openTestDatabase(filename = ':memory:') {
  const native = new DatabaseSync(filename);
  return {
    native,
    async execAsync(sql) { native.exec(sql); },
    async runAsync(sql, ...params) {
      const result = native.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async getFirstAsync(sql, ...params) { return native.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql, ...params) { return native.prepare(sql).all(...params); },
    async closeAsync() { native.close(); },
    async withExclusiveTransactionAsync(action) {
      native.exec('BEGIN IMMEDIATE');
      try { await action(this); native.exec('COMMIT'); }
      catch(error) { native.exec('ROLLBACK'); throw error; }
    },
  };
}
module.exports = { openTestDatabase };
