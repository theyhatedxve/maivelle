/** @type {import('../types.js').Migration} */
export const notesManagement = {
  version: 3,
  name: 'notes-pin-and-archive',
  sql: `
    ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0, 1));
    ALTER TABLE notes ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1));
    CREATE INDEX notes_library_idx ON notes(is_archived, is_pinned DESC, updated_at DESC, id ASC);
  `,
};
