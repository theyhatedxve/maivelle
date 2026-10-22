/** SQLite row shapes derived from the versioned schema. No schema or runtime data is changed. */

export interface AppSettingsRow {
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface NoteCategoriesRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface NotesRow {
  id: string;
  title: string;
  body: string;
  category_id: string | null;
  created_at: string;
  updated_at: string;
  is_pinned: number;
  is_archived: number;
}

export interface TaskCategoriesRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TasksRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string | null;
  due_time: string | null;
  category_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubtasksRow {
  id: string;
  task_id: string;
  title: string;
  completed: number;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventCategoriesRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventsRow {
  reminder_minutes: number | null;
  id: string;
  title: string;
  description: string;
  location: string;
  start_local: string;
  end_local: string;
  all_day: number;
  category_id: string | null;
  recurrence_json: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventExceptionsRow {
  reminder_minutes: number | null;
  event_id: string;
  occurrence_start: string;
  kind: string;
  title: string | null;
  description: string | null;
  location: string | null;
  start_local: string | null;
  end_local: string | null;
  all_day: number | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicinesRow {
  id: string;
  name: string;
  form: string;
  instructions: string;
  notes: string;
  active: number;
  start_date: string | null;
  end_date: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface MedicineSchedulesRow {
  id: string;
  medicine_id: string;
  weekdays: string;
  times: string;
  start_date: string | null;
  end_date: string | null;
  effective_from: string;
  retired_at: string | null;
  medicine_start: string | null;
  medicine_end: string | null;
  enabled: number;
  is_current: number;
  name_snapshot: string;
  instructions_snapshot: string;
  created_at: string;
}

export interface MedicineDoseLogsRow {
  occurrence_id: string;
  schedule_id: string;
  medicine_id: string;
  scheduled_local: string;
  scheduled_at: string;
  timezone: string;
  status: string;
  action_at: string;
  name_snapshot: string;
  instructions_snapshot: string;
}

export interface MedicineNotificationJobsRow {
  occurrence_id: string;
  schedule_id: string;
  notification_id: string;
  scheduled_at: string;
  delivery: string;
  updated_at: string;
}

export interface TimeProjectsRow {
  id: string;
  name: string;
  description: string;
  color: string;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface TimeSessionsRow {
  id: string;
  project_id: string | null;
  project_name: string;
  project_color: string;
  title: string;
  type: 'timer' | 'manual';
  status: 'running' | 'paused' | 'completed';
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface TimeSessionSegmentsRow {
  id: string;
  session_id: string;
  start_ms: number;
  end_ms: number | null;
}

export interface FinancialAccountsRow {
  id: string;
  name: string;
  type: string;
  currency: string;
  opening_minor: number;
  archived: number;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionCategoriesRow {
  id: string;
  name: string;
  kind: string;
  color: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionsRow {
  id: string;
  type: string;
  amount_minor: number;
  currency: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  category_key: string | null;
  category_name: string | null;
  category_color: string | null;
  description: string;
  occurred_on: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetsRow {
  id: string;
  name: string;
  currency: string;
  starts_on: string;
  ends_on: string;
  funding_minor: number;
  source_snapshot: string;
  archived: number;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetAccountsRow {
  budget_id: string;
  account_id: string;
}

export interface BudgetAllocationsRow {
  id: string;
  budget_id: string;
  category_key: string;
  category_name: string;
  mode: string;
  value: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetTransactionLinksRow {
  id: string;
  budget_id: string;
  allocation_id: string;
  transaction_id: string;
  created_at: string;
}

export interface BudgetFundingHistoryRow {
  id: string;
  budget_id: string;
  previous_minor: number;
  funding_minor: number;
  reason: string;
  source_snapshot: string;
  created_at: string;
}

export interface VaultMetadataRow {
  slot: number;
  id: string;
  revision: number;
  header: string;
  wrapped_key: string;
  created_at: string;
  updated_at: string;
}

export interface VaultItemsRow {
  id: string;
  vault_id: string;
  revision: number;
  nonce: string;
  envelope: string;
  created_at: string;
  updated_at: string;
}

export interface VaultSettingsRow {
  vault_id: string;
  inactivity_seconds: number;
}

export interface MigrationLedgerRow {
  version: number;
  name: string;
  sql: string;
  applied_at: string;
}
