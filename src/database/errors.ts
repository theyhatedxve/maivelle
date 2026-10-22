export class DatabaseError extends Error {
  readonly code: string;

  constructor(code: string, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'DatabaseError';
    this.code = code;
  }
}

export function storageError(error: unknown, operation: string) {
  if (error instanceof DatabaseError) return error;
  const detail = error instanceof Error ? error.message : '';
  if (/FOREIGN KEY/i.test(detail))
    return new DatabaseError('REFERENCE', 'The selected category no longer exists.', error);
  if (/UNIQUE|PRIMARY KEY/i.test(detail))
    return new DatabaseError('CONFLICT', 'A record with this identifier already exists.', error);
  if (/constraint|NOT NULL/i.test(detail))
    return new DatabaseError('CONSTRAINT', 'The record violates a database constraint.', error);
  if (/locked|busy/i.test(detail))
    return new DatabaseError('BUSY', 'The database is busy. Try again shortly.', error);
  return new DatabaseError(
    'STORAGE',
    `Could not ${operation}. Existing data has not been reset.`,
    error,
  );
}
