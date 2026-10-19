import { DatabaseError } from '../../../database/errors.js';
import { validateNoteInput } from '../validation/noteInput.js';

/**
 * Notifications invalidate views; every refresh reads SQLite, never an in-memory record cache.
 * @param {ReturnType<typeof import('../../../database/repositories/notesRepository.js').createNotesRepository>} notes
 * @param {ReturnType<typeof import('../../../database/repositories/noteCategoriesRepository.js').createNoteCategoriesRepository>} categories
 */
export function createNotesService(notes, categories) {
  const listeners = new Set(/** @type {(() => void)[]} */ ([]));
  const notify = () => { for (const listener of listeners) listener(); };
  /** @template T @param {Promise<T>} work */
  async function changed(work) { const result = await work; notify(); return result; }
  return {
    /** @param {() => void} listener */
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    list: notes.list,
    getById: notes.getById,
    countActive: notes.countActive,
    async categories() { return /** @type {import('../../../database/repositories/noteCategoriesRepository.js').Category[]} */ (await categories.list()); },
    /** @param {string} name */
    createCategory(name) { return changed(categories.create(name)); },
    /** @param {string | null} id @param {Parameters<typeof validateNoteInput>[0]} input */
    async save(id, input) {
      const value = validateNoteInput(input);
      const result = id ? await notes.update(id, value) : await notes.create(value);
      if (!result) throw new DatabaseError('NOT_FOUND', 'This note no longer exists. Return to the library.');
      notify(); return result;
    },
    /** @param {string} id @param {'pinned' | 'archived'} flag @param {boolean} enabled */
    async setFlag(id, flag, enabled) {
      const result = await notes.setFlag(id, flag, enabled);
      if (!result) throw new DatabaseError('NOT_FOUND', 'This note no longer exists. Refresh the library.');
      notify(); return result;
    },
    /** Confirmation must come from the user's destructive-action dialog. @param {string} id @param {boolean} confirmed */
    async remove(id, confirmed) { if (confirmed !== true) return false; return changed(notes.remove(id)); },
  };
}
