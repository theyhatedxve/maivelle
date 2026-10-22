export const notesIndexes: import('../types.ts').Migration = {
  version: 2,
  name: 'notes-list-and-category-indexes',
  sql: `
    CREATE INDEX notes_updated_at_id_idx ON notes(updated_at DESC, id ASC);
    CREATE INDEX notes_category_id_idx ON notes(category_id);
  `,
};
