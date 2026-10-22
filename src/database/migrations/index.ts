import { initialSchema } from './001-initial-schema.ts';
import { notesIndexes } from './002-notes-indexes.ts';
import { notesManagement } from './003-notes-management.ts';
import { tasksSchema } from './004-tasks.ts';
import { calendarSchema } from './005-calendar.ts';
import { medicineSchema } from './006-medicine.ts';
import { timeTrackerSchema } from './007-time-tracker.ts';
import { financeSchema } from './008-finance.ts';
import { budgetsSchema } from './009-budgets.ts';
import { vaultSchema } from './010-vault.ts';
import { calendarReminders } from './011-calendar-reminders.ts';
export const migrations = [
  initialSchema,
  notesIndexes,
  notesManagement,
  tasksSchema,
  calendarSchema,
  medicineSchema,
  timeTrackerSchema,
  financeSchema,
  budgetsSchema,
  vaultSchema,
  calendarReminders,
];
