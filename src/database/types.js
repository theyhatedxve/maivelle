/** @typedef {Pick<import('expo-sqlite').SQLiteDatabase, 'execAsync' | 'getFirstAsync' | 'getAllAsync' | 'runAsync'>} Database */
/** @typedef {{version: number, name: string, sql: string}} Migration */
/** @typedef {{id: string, title: string, body: string, category_id: string | null, created_at: string, updated_at: string, is_pinned?: number, is_archived?: number}} NoteRow */
/** @typedef {{id: string, title: string, body: string, categoryId: string | null, createdAt: string, updatedAt: string, pinned: boolean, archived: boolean}} Note */
export {};
