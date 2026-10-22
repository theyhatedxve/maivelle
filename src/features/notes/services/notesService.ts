import { DatabaseError } from '../../../database/errors.ts';
import { validateNoteInput } from '../validation/noteInput.ts';
/** Notifications invalidate views; every refresh reads SQLite, never an in-memory record cache. */
export function createNotesService(
  notes: ReturnType<
    typeof import('../../../database/repositories/notesRepository.ts').createNotesRepository
  >,
  categories: ReturnType<
    typeof import('../../../database/repositories/noteCategoriesRepository.ts').createNoteCategoriesRepository
  >,
) {
  const listeners = new Set([] as (() => void)[]);
  const notify = () => {
    for (const listener of listeners) listener();
  };

  async function changed<T>(work: Promise<T>) {
    const result = await work;
    notify();
    return result;
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    list: notes.list,
    /** Library-only previews; editor/export reads retain complete bodies. */
    listLibrary: (options: Parameters<typeof notes.list>[0]) =>
      notes.list({ ...options, preview: true }),
    getById: notes.getById,
    countActive: notes.countActive,
    async categories() {
      return (await categories.list()) as import('../../../database/repositories/noteCategoriesRepository.ts').Category[];
    },

    createCategory(name: string) {
      return changed(categories.create(name));
    },

    async save(id: string | null, input: Parameters<typeof validateNoteInput>[0]) {
      const value = validateNoteInput(input);
      const result = id ? await notes.update(id, value) : await notes.create(value);
      if (!result)
        throw new DatabaseError('NOT_FOUND', 'This note no longer exists. Return to the library.');
      notify();
      return result;
    },

    async setFlag(id: string, flag: 'pinned' | 'archived', enabled: boolean) {
      const result = await notes.setFlag(id, flag, enabled);
      if (!result)
        throw new DatabaseError('NOT_FOUND', 'This note no longer exists. Refresh the library.');
      notify();
      return result;
    },
    /** Confirmation must come from the user's destructive-action dialog. */
    async remove(id: string, confirmed: boolean) {
      if (confirmed !== true) return false;
      return changed(notes.remove(id));
    },
  };
}
