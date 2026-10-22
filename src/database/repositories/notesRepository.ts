import { DatabaseError, storageError } from '../errors.ts';
// ECMAScript trim whitespace: preserve the existing library preview for leading
// spaces, newlines and Unicode whitespace without transferring the whole body.
const previewWhitespace =
  '\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';

function validId(value: unknown, field: string = 'Identifier') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) {
    throw new DatabaseError('VALIDATION', `${field} must be a valid stable identifier.`);
  }
  return value;
}

function validateInput(value: unknown, partial: boolean) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DatabaseError('VALIDATION', 'Note input must be an object.');
  if (Object.keys(value).some((key) => !['title', 'body', 'categoryId'].includes(key)))
    throw new DatabaseError('VALIDATION', 'Note input contains unsupported fields.');

  const input: {
    title?: unknown;
    body?: unknown;
    categoryId?: unknown; // spaces, newlines and Unicode whitespace without transferring the whole body.
  } = value;
  if (
    (!partial || 'title' in input) &&
    (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 240)
  ) {
    throw new DatabaseError('VALIDATION', 'A note title must contain 1 to 240 characters.');
  }
  if ('body' in input && (typeof input.body !== 'string' || input.body.length > 100000))
    throw new DatabaseError(
      'VALIDATION',
      'Note text must be a string of at most 100000 characters.',
    );
  if ('categoryId' in input && input.categoryId !== null) validId(input.categoryId, 'Category');
  if (partial && !Object.keys(input).length)
    throw new DatabaseError('VALIDATION', 'Provide at least one field to update.');
  return {
    title: typeof input.title === 'string' ? input.title.trim() : undefined,
    body: typeof input.body === 'string' ? input.body : undefined,
    categoryId: typeof input.categoryId === 'string' ? input.categoryId : null,
    hasCategory: 'categoryId' in input,
  };
}

function noteFromRow(row: import('../types.ts').NoteRow | null): import('../types.ts').Note | null {
  return row
    ? {
        id: row.id,
        title: row.title,
        body: row.body,
        categoryId: row.category_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        pinned: row.is_pinned === 1,
        archived: row.is_archived === 1,
      }
    : null;
}
/** All user values are bound. List pagination is bounded for the virtualized library. */
export function createNotesRepository(db: import('../types.ts').Database, createId: () => string) {
  return {
    async create(input: unknown) {
      const value = validateInput(input, false);
      const id = validId(createId());
      const now = new Date().toISOString();
      try {
        const row: import('../types.ts').NoteRow | null = await db.getFirstAsync(
          'INSERT INTO notes (id, title, body, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
          id,
          value.title ?? '',
          value.body ?? '',
          value.categoryId,
          now,
          now,
        );
        if (!row) throw new DatabaseError('STORAGE', 'The note was not returned after creation.');
        return noteFromRow(row) as import('../types.ts').Note;
      } catch (error) {
        throw storageError(error, 'create the note');
      }
    },

    async getById(id: string) {
      validId(id);
      try {
        return noteFromRow(
          await db.getFirstAsync<import('../rows.ts').NotesRow>(
            'SELECT * FROM notes WHERE id = ?',
            id,
          ),
        );
      } catch (error) {
        throw storageError(error, 'read the note');
      }
    },

    async list(
      options: {
        categoryId?: string | null;
        search?: string;
        archived?: boolean;
        limit?: number;
        offset?: number;
        preview?: boolean;
        sort?: 'pinned' | 'recent';
      } = {},
    ) {
      if (
        !options ||
        typeof options !== 'object' ||
        Array.isArray(options) ||
        Object.keys(options).some(
          (key) =>
            !['categoryId', 'search', 'archived', 'limit', 'offset', 'preview', 'sort'].includes(
              key,
            ),
        )
      ) {
        throw new DatabaseError('VALIDATION', 'Unsupported note list options.');
      }
      const {
        categoryId,
        search = '',
        archived,
        limit = 100,
        offset = 0,
        preview = false,
        sort = 'pinned',
      } = options;
      if (typeof preview !== 'boolean')
        throw new DatabaseError('VALIDATION', 'Invalid note preview option.');
      if (!['pinned', 'recent'].includes(sort))
        throw new DatabaseError('VALIDATION', 'Invalid note sort order.');
      if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 200 ||
        !Number.isSafeInteger(offset) ||
        offset < 0
      )
        throw new DatabaseError(
          'VALIDATION',
          'Pagination requires a limit of 1–200 and a non-negative offset.',
        );
      if (categoryId !== undefined && categoryId !== null) validId(categoryId, 'Category');
      if (
        typeof search !== 'string' ||
        search.length > 100000 ||
        (archived !== undefined && typeof archived !== 'boolean')
      )
        throw new DatabaseError('VALIDATION', 'Invalid search or archive filter.');
      try {
        // Only these reviewed predicates enter SQL. A direct equality lets SQLite
        // use notes_library_idx for the library's active/archived ordering.
        const archivePredicate = archived === undefined ? '1' : 'is_archived = ?';
        const archiveValues = archived === undefined ? [] : [Number(archived)];
        const fields = preview
          ? 'id,title,substr(ltrim(body, ?),1,240) AS body,category_id,created_at,updated_at,is_pinned,is_archived'
          : '*';

        const rows: import('../types.ts').NoteRow[] = await db.getAllAsync(
          `SELECT ${fields} FROM notes
          WHERE ${archivePredicate}
          AND (? = 0 OR category_id IS ?)
          AND (instr(lower(title), lower(?)) > 0 OR instr(lower(body), lower(?)) > 0)
          ORDER BY ${sort === 'recent' ? 'updated_at DESC, id ASC' : 'is_pinned DESC, updated_at DESC, id ASC'} LIMIT ? OFFSET ?`,
          ...(preview ? [previewWhitespace] : []),
          ...archiveValues,
          categoryId === undefined ? 0 : 1,
          categoryId ?? null,
          search.trim(),
          search.trim(),
          limit,
          offset,
        );
        return rows.map((row) => noteFromRow(row) as import('../types.ts').Note);
      } catch (error) {
        throw storageError(error, 'list notes');
      }
    },

    async update(id: string, input: unknown) {
      validId(id);
      const value = validateInput(input, true);
      try {
        const row: import('../types.ts').NoteRow | null = await db.getFirstAsync(
          `UPDATE notes SET
          title = CASE WHEN ? THEN ? ELSE title END,
          body = CASE WHEN ? THEN ? ELSE body END,
          category_id = CASE WHEN ? THEN ? ELSE category_id END,
          updated_at = MAX(updated_at, created_at, ?)
          WHERE id = ? RETURNING *`,
          value.title !== undefined ? 1 : 0,
          value.title ?? '',
          value.body !== undefined ? 1 : 0,
          value.body ?? '',
          value.hasCategory ? 1 : 0,
          value.categoryId,
          new Date().toISOString(),
          id,
        );
        return noteFromRow(row);
      } catch (error) {
        throw storageError(error, 'update the note');
      }
    },
    async countActive() {
      try {
        const row = await db.getFirstAsync(
          'SELECT COUNT(*) AS total FROM notes WHERE is_archived = 0' as string,
        );
        return (
          row as {
            total: number;
          }
        ).total;
      } catch (error) {
        throw storageError(error, 'count notes');
      }
    },

    async setFlag(id: string, flag: 'pinned' | 'archived', enabled: boolean) {
      validId(id);
      if (!['pinned', 'archived'].includes(flag) || typeof enabled !== 'boolean')
        throw new DatabaseError('VALIDATION', 'Invalid note management action.');
      try {
        const row = await db.getFirstAsync(
          `UPDATE notes SET
          is_pinned = CASE WHEN ? THEN ? ELSE is_pinned END,
          is_archived = CASE WHEN ? THEN ? ELSE is_archived END,
          updated_at = MAX(updated_at, created_at, ?) WHERE id = ? RETURNING *`,
          flag === 'pinned' ? 1 : 0,
          Number(enabled),
          flag === 'archived' ? 1 : 0,
          Number(enabled),
          new Date().toISOString(),
          id,
        );
        return noteFromRow(row as import('../types.ts').NoteRow | null);
      } catch (error) {
        throw storageError(error, 'manage the note');
      }
    },

    async remove(id: string) {
      validId(id);
      try {
        const result = await db.runAsync('DELETE FROM notes WHERE id = ?', id);
        return result.changes === 1;
      } catch (error) {
        throw storageError(error, 'delete the note');
      }
    },
  };
}
