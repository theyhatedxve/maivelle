export type Database = Pick<
  import('expo-sqlite').SQLiteDatabase,
  'execAsync' | 'getFirstAsync' | 'getAllAsync' | 'runAsync'
>;
export type Migration = {
  version: number;
  name: string;
  sql: string;
};
export type NoteRow = {
  id: string;
  title: string;
  body: string;
  category_id: string | null;
  created_at: string;
  updated_at: string;
  is_pinned?: number;
  is_archived?: number;
};
export type Note = {
  id: string;
  title: string;
  body: string;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  archived: boolean;
};

export {};
