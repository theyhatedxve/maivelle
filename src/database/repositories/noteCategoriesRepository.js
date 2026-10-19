import { DatabaseError, storageError } from '../errors.js';

/** @typedef {{id: string, name: string}} Category */
/** @param {import('../types.js').Database} db @param {() => string} createId */
export function createNoteCategoriesRepository(db, createId) {
  return {
    async list() {
      try {
        const rows = await db.getAllAsync(/** @type {string} */ ('SELECT id, name FROM note_categories ORDER BY name COLLATE NOCASE, id'));
        return /** @type {Category[]} */ (rows).map((row) => ({ id: row.id, name: row.name }));
      } catch (error) { throw storageError(error, 'load categories'); }
    },
    /** @param {string} name @returns {Promise<Category>} */
    async create(name) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new DatabaseError('VALIDATION', 'Category names must contain 1 to 80 characters.');
      const id = createId();
      const now = new Date().toISOString();
      try {
        await db.runAsync('INSERT INTO note_categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', id, name.trim(), now, now);
        return { id, name: name.trim() };
      } catch (error) {
        const failure = storageError(error, 'create the category');
        if (failure.code === 'CONFLICT') throw new DatabaseError('CONFLICT', 'A category with this name already exists.', error);
        throw failure;
      }
    },
  };
}
