import { DatabaseError } from '../../../database/errors.ts';

export function validateNoteInput(input: {
  title: string;
  body: string;
  categoryId: string | null;
}) {
  if (typeof input?.title !== 'string' || typeof input?.body !== 'string')
    throw new DatabaseError('VALIDATION', 'Enter a note title or content.');
  if (!input.title.trim() && !input.body.trim())
    throw new DatabaseError('VALIDATION', 'Add a title or content before saving.');
  if (input.title.trim().length > 240)
    throw new DatabaseError('VALIDATION', 'The title must be at most 240 characters.');
  if (input.body.length > 100000)
    throw new DatabaseError('VALIDATION', 'Content must be at most 100000 characters.');
  return {
    title: input.title.trim() || 'Untitled note',
    body: input.body,
    categoryId: input.categoryId,
  };
}
