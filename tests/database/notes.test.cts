const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { openTestDatabase } = require('./sqliteAdapter.cts');
const { initializeDatabase } = require('../../src/database/initialize.ts');
const { migrations } = require('../../src/database/migrations/index.ts');
const { createNotesRepository } = require('../../src/database/repositories/notesRepository.ts');
const {
  createNoteCategoriesRepository,
} = require('../../src/database/repositories/noteCategoriesRepository.ts');
const { createNotesService } = require('../../src/features/notes/services/notesService.ts');
async function fixture(t) {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db);
  const notes = createNotesRepository(db, randomUUID);
  return {
    db,
    notes,
    service: createNotesService(notes, createNoteCategoriesRepository(db, randomUUID)),
  };
}
test('service creates content-only notes, updates stable IDs and preserves creation time', async (t) => {
  const { service } = await fixture(t);
  const note = await service.save(null, { title: ' ', body: 'Synthetic idea', categoryId: null });
  assert.equal(note.title, 'Untitled note');
  const changed = await service.save(note.id, {
    title: 'Edited fixture',
    body: 'Changed content',
    categoryId: null,
  });
  assert.equal(changed.id, note.id);
  assert.equal(changed.createdAt, note.createdAt);
  assert.ok(changed.updatedAt >= note.updatedAt);
  assert.equal(await service.countActive(), 1);
  await assert.rejects(
    service.save(randomUUID(), { title: 'Absent', body: '', categoryId: null }),
    { code: 'NOT_FOUND' },
  );
});
test('search matches title/content locally and treats wildcard and SQL input literally', async (t) => {
  const { service } = await fixture(t);
  await service.save(null, {
    title: 'Synthetic IDEA',
    body: 'A 100%_literal sample',
    categoryId: null,
  });
  await service.save(null, { title: 'Other', body: 'Plain text', categoryId: null });
  for (const search of ['idea', '100%_', '_literal'])
    assert.equal((await service.list({ search })).length, 1);
  assert.equal((await service.list({ search: "' OR 1=1 --" })).length, 0);
  assert.equal((await service.list({ search: 'missing' })).length, 0);
});
test('pin ordering, archive filters and dashboard active counts follow SQLite mutations', async (t) => {
  const { service } = await fixture(t);
  const first = await service.save(null, { title: 'First', body: '', categoryId: null });
  await service.save(null, { title: 'Second', body: '', categoryId: null });
  const pinned = await service.setFlag(first.id, 'pinned', true);
  assert.equal(pinned.pinned, true);
  assert.equal((await service.list({ archived: false }))[0].id, first.id);
  assert.equal((await service.setFlag(first.id, 'pinned', false)).pinned, false);
  assert.equal((await service.setFlag(first.id, 'archived', true)).archived, true);
  assert.equal(await service.countActive(), 1);
  assert.equal((await service.list({ archived: true })).length, 1);
  assert.equal((await service.list({ archived: false })).length, 1);
  await service.setFlag(first.id, 'archived', false);
  assert.equal(await service.countActive(), 2);
  assert.equal((await service.getById(first.id)).createdAt, first.createdAt);
});
test('categories assign, filter, clear, reject invalid and duplicate names', async (t) => {
  const { service } = await fixture(t);
  const category = await service.createCategory('  Synthetic category  ');
  assert.equal(category.name, 'Synthetic category');
  assert.deepEqual(await service.categories(), [category]);
  const note = await service.save(null, {
    title: 'Categorized',
    body: '',
    categoryId: category.id,
  });
  assert.equal((await service.list({ categoryId: category.id }))[0].id, note.id);
  assert.equal((await service.list({ categoryId: null })).length, 0);
  await service.save(note.id, { title: note.title, body: '', categoryId: null });
  assert.equal((await service.list({ categoryId: null })).length, 1);
  for (const name of ['', ' ', 'x'.repeat(81), null])
    await assert.rejects(service.createCategory(name), { code: 'VALIDATION' });
  await assert.rejects(service.createCategory(category.name), { code: 'CONFLICT' });
});
test('destructive service refuses unconfirmed deletion and publishes successful changes only', async (t) => {
  const { service } = await fixture(t);
  let changes = 0;
  const unsubscribe = service.subscribe(() => changes++);
  const note = await service.save(null, { title: 'Deletion fixture', body: '', categoryId: null });
  assert.equal(await service.remove(note.id, false), false);
  assert.equal(await service.countActive(), 1);
  assert.equal(changes, 1);
  await assert.rejects(service.save(null, { title: '', body: ' ', categoryId: null }), {
    code: 'VALIDATION',
  });
  assert.equal(changes, 1);
  assert.equal(await service.remove(note.id, true), true);
  assert.equal(await service.getById(note.id), null);
  assert.equal(changes, 2);
  unsubscribe();
  await service.createCategory('After unsubscribe');
  assert.equal(changes, 2);
});
test('invalid form fields, flags and filters never alter stored records', async (t) => {
  const { service } = await fixture(t);
  for (const input of [
    null,
    {},
    { title: '', body: '' },
    { title: ' ', body: '\n ' },
    { title: 'x'.repeat(241), body: '' },
    { title: 'x', body: 'x'.repeat(100001) },
    { title: 'x', body: 2 },
  ]) {
    await assert.rejects(service.save(null, input), { code: 'VALIDATION' });
  }
  await assert.rejects(service.setFlag(randomUUID(), 'pinned', 1), { code: 'VALIDATION' });
  await assert.rejects(service.list({ archived: 'false' }), { code: 'VALIDATION' });
  assert.equal(await service.countActive(), 0);
});
test('v2 data and category references survive v3 flags and repeated initialization', async (t) => {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db, migrations.slice(0, 2));
  const notes = createNotesRepository(db, randomUUID);
  const category = await createNoteCategoriesRepository(db, randomUUID).create('Legacy fixture');
  const original = await notes.create({
    title: 'Existing v2 note',
    body: 'Keep intact',
    categoryId: category.id,
  });
  await initializeDatabase(db);
  await initializeDatabase(db);
  assert.deepEqual(await notes.getById(original.id), original);
  const row = await db.getFirstAsync(
    'SELECT is_pinned, is_archived FROM notes WHERE id=?',
    original.id,
  );
  assert.equal(row.is_pinned, 0);
  assert.equal(row.is_archived, 0);
  assert.equal((await db.getAllAsync('SELECT * FROM schema_migrations')).length, migrations.length);
  await assert.rejects(
    db.runAsync('UPDATE notes SET is_pinned=2 WHERE id=?', original.id),
    /CHECK/,
  );
});
test('pagination is stable and covers more than one FlatList page without loss', async (t) => {
  const { notes } = await fixture(t);
  for (let index = 0; index < 57; index++) await notes.create({ title: `Synthetic ${index}` });
  const first = await notes.list({ limit: 50, offset: 0, archived: false });
  const second = await notes.list({ limit: 50, offset: 50, archived: false });
  assert.equal(first.length, 50);
  assert.equal(second.length, 7);
  assert.equal(new Set([...first, ...second].map((note) => note.id)).size, 57);
});
