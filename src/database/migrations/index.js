import { initialSchema } from './001-initial-schema.js';
import { notesIndexes } from './002-notes-indexes.js';
import { notesManagement } from './003-notes-management.js';
import { tasksSchema } from './004-tasks.js';
import { calendarSchema } from './005-calendar.js';
import { medicineSchema } from './006-medicine.js';
import { timeTrackerSchema } from './007-time-tracker.js';

export const migrations = [initialSchema, notesIndexes, notesManagement, tasksSchema, calendarSchema, medicineSchema, timeTrackerSchema];
