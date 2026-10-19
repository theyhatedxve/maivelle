import { DatabaseError, storageError } from '../errors.js';

/** @param {unknown} value @param {string} field */
function validId(value, field = 'Identifier') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) {
    throw new DatabaseError('VALIDATION', `${field} must be a valid stable identifier.`);
  }
  return value;
}

/** @param {unknown} value @param {boolean} partial */
function validateInput(value, partial) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseError('VALIDATION', 'Note input must be an object.');
  if (Object.keys(value).some((key) => !['title', 'body', 'categoryId'].includes(key))) throw new DatabaseError('VALIDATION', 'Note input contains unsupported fields.');
  /** @type {{title?: unknown, body?: unknown, categoryId?: unknown}} */
  const input = value;
  if ((!partial || 'title' in input) && (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 240)) {
    throw new DatabaseError('VALIDATION', 'A note title must contain 1 to 240 characters.');
  }
  if ('body' in input && (typeof input.body !== 'string' || input.body.length > 100000)) throw new DatabaseError('VALIDATION', 'Note text must be a string of at most 100000 characters.');
  if ('categoryId' in input && input.categoryId !== null) validId(input.categoryId, 'Category');
  if (partial && !Object.keys(input).length) throw new DatabaseError('VALIDATION', 'Provide at least one field to update.');
  return {
    title: typeof input.title === 'string' ? input.title.trim() : undefined,
    body: typeof input.body === 'string' ? input.body : undefined,
    categoryId: typeof input.categoryId === 'string' ? input.categoryId : null,
    hasCategory: 'categoryId' in input,
  };
}

/** @param {import('../types.js').NoteRow | null} row @returns {import('../types.js').Note | null} */
function noteFromRow(row) {
  return row ? { id: row.id, title: row.title, body: row.body, categoryId: row.category_id, createdAt: row.created_at, updatedAt: row.updated_at, pinned: row.is_pinned === 1, archived: row.is_archived === 1 } : null;
}

/**
 * All user values are bound. List pagination is bounded for the virtualized library.
 * @param {import('../types.js').Database} db
 * @param {() => string} createId Native callers pass Expo uuid.v4; tests pass node:crypto.randomUUID.
 */
export function createNotesRepository(db, createId) {
  return {
    /** @param {unknown} input */
    async create(input) {
      const value = validateInput(input, false);
      const id = validId(createId());
      const now = new Date().toISOString();
      try {
        /** @type {import('../types.js').NoteRow | null} */
        const row = await db.getFirstAsync('INSERT INTO notes (id, title, body, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *', id, value.title ?? '', value.body ?? '', value.categoryId, now, now);
        if (!row) throw new DatabaseError('STORAGE', 'The note was not returned after creation.');
        return /** @type {import('../types.js').Note} */ (noteFromRow(row));
      } catch (error) { throw storageError(error, 'create the note'); }
    },
    /** @param {string} id */
    async getById(id) {
      validId(id);
      try {
        return noteFromRow(await db.getFirstAsync('SELECT * FROM notes WHERE id = ?', id));
      } catch (error) { throw storageError(error, 'read the note'); }
    },
    /** @param {{categoryId?: string | null, search?: string, archived?: boolean, limit?: number, offset?: number}} [options] */
    async list(options = {}) {
      if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some((key) => !['categoryId', 'search', 'archived', 'limit', 'offset'].includes(key))) {
        throw new DatabaseError('VALIDATION', 'Unsupported note list options.');
      }
      const { categoryId, search = '', archived, limit = 100, offset = 0 } = options;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0) throw new DatabaseError('VALIDATION', 'Pagination requires a limit of 1–200 and a non-negative offset.');
      if (categoryId !== undefined && categoryId !== null) validId(categoryId, 'Category');
      if (typeof search !== 'string' || search.length > 100000 || (archived !== undefined && typeof archived !== 'boolean')) throw new DatabaseError('VALIDATION', 'Invalid search or archive filter.');
      try {
        // Only these reviewed predicates enter SQL. A direct equality lets SQLite
        // use notes_library_idx for the library's active/archived ordering.
        const archivePredicate = archived === undefined ? '1' : 'is_archived = ?';
        const archiveValues = archived === undefined ? [] : [Number(archived)];
        /** @type {import('../types.js').NoteRow[]} */
        const rows = await db.getAllAsync(`SELECT * FROM notes
          WHERE ${archivePredicate}
          AND (? = 0 OR category_id IS ?)
          AND (instr(lower(title), lower(?)) > 0 OR instr(lower(body), lower(?)) > 0)
          ORDER BY is_pinned DESC, updated_at DESC, id ASC LIMIT ? OFFSET ?`,
        ...archiveValues, categoryId === undefined ? 0 : 1, categoryId ?? null, search.trim(), search.trim(), limit, offset);
        return rows.map((row) => /** @type {import('../types.js').Note} */ (noteFromRow(row)));
      } catch (error) { throw storageError(error, 'list notes'); }
    },
    /** @param {string} id @param {unknown} input */
    async update(id, input) {
      validId(id);
      const value = validateInput(input, true);
      try {
        /** @type {import('../types.js').NoteRow | null} */
        const row = await db.getFirstAsync(`UPDATE notes SET
          title = CASE WHEN ? THEN ? ELSE title END,
          body = CASE WHEN ? THEN ? ELSE body END,
          category_id = CASE WHEN ? THEN ? ELSE category_id END,
          updated_at = MAX(updated_at, created_at, ?)
          WHERE id = ? RETURNING *`, value.title !== undefined ? 1 : 0, value.title ?? '', value.body !== undefined ? 1 : 0, value.body ?? '', value.hasCategory ? 1 : 0, value.categoryId, new Date().toISOString(), id);
        return noteFromRow(row);
      } catch (error) { throw storageError(error, 'update the note'); }
    },
    async countActive() {
      try {
        const row = await db.getFirstAsync(/** @type {string} */ ('SELECT COUNT(*) AS total FROM notes WHERE is_archived = 0'));
        return /** @type {{total: number}} */ (row).total;
      } catch (error) { throw storageError(error, 'count notes'); }
    },
    /** @param {string} id @param {'pinned' | 'archived'} flag @param {boolean} enabled */
    async setFlag(id, flag, enabled) {
      validId(id);
      if (!['pinned', 'archived'].includes(flag) || typeof enabled !== 'boolean') throw new DatabaseError('VALIDATION', 'Invalid note management action.');
      try {
        const row = await db.getFirstAsync(`UPDATE notes SET
          is_pinned = CASE WHEN ? THEN ? ELSE is_pinned END,
          is_archived = CASE WHEN ? THEN ? ELSE is_archived END,
          updated_at = MAX(updated_at, created_at, ?) WHERE id = ? RETURNING *`,
        flag === 'pinned' ? 1 : 0, Number(enabled), flag === 'archived' ? 1 : 0, Number(enabled), new Date().toISOString(), id);
        return noteFromRow(/** @type {import('../types.js').NoteRow | null} */ (row));
      } catch (error) { throw storageError(error, 'manage the note'); }
    },
    /** @param {string} id */
    async remove(id) {
      validId(id);
      try {
        const result = await db.runAsync('DELETE FROM notes WHERE id = ?', id);
        return result.changes === 1;
      } catch (error) { throw storageError(error, 'delete the note'); }
    },
  };
}
