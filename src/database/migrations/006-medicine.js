/** @type {import('../types.js').Migration} */
export const medicineSchema = {
  version: 6,
  name: 'medicine-schedule-revisions-and-dose-history',
  sql: `
    CREATE TABLE medicines (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 240),
      form TEXT NOT NULL DEFAULT '' CHECK(length(form)<=120),
      instructions TEXT NOT NULL DEFAULT '' CHECK(length(instructions)<=2000),
      notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=10000),
      active INTEGER NOT NULL CHECK(active IN (0,1)),
      start_date TEXT, end_date TEXT CHECK(end_date IS NULL OR start_date IS NULL OR end_date>=start_date),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE medicine_schedules (
      id TEXT PRIMARY KEY NOT NULL,
      medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
      weekdays TEXT NOT NULL CHECK(json_valid(weekdays)),
      times TEXT NOT NULL CHECK(json_valid(times)),
      start_date TEXT, end_date TEXT CHECK(end_date IS NULL OR start_date IS NULL OR end_date>=start_date),
      effective_from TEXT NOT NULL, retired_at TEXT,
      medicine_start TEXT, medicine_end TEXT,
      enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
      is_current INTEGER NOT NULL CHECK(is_current IN (0,1)),
      name_snapshot TEXT NOT NULL, instructions_snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL,
      CHECK(retired_at IS NULL OR retired_at>=effective_from),
      UNIQUE(id,medicine_id)
    );
    CREATE TABLE medicine_dose_logs (
      occurrence_id TEXT PRIMARY KEY NOT NULL,
      schedule_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      scheduled_local TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      timezone TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('taken','skipped')),
      action_at TEXT NOT NULL,
      name_snapshot TEXT NOT NULL, instructions_snapshot TEXT NOT NULL,
      FOREIGN KEY(schedule_id,medicine_id) REFERENCES medicine_schedules(id,medicine_id) ON DELETE RESTRICT,
      UNIQUE(schedule_id,scheduled_local)
    );
    CREATE TABLE medicine_notification_jobs (
      occurrence_id TEXT PRIMARY KEY NOT NULL,
      schedule_id TEXT NOT NULL REFERENCES medicine_schedules(id) ON DELETE RESTRICT,
      notification_id TEXT NOT NULL UNIQUE,
      scheduled_at TEXT NOT NULL,
      delivery TEXT NOT NULL CHECK(delivery IN ('alarmClock','bestEffort')),
      updated_at TEXT NOT NULL
    );
    CREATE INDEX medicines_active_name ON medicines(active,name);
    CREATE INDEX medicine_schedule_range ON medicine_schedules(medicine_id,is_current,effective_from,retired_at);
    CREATE INDEX medicine_dose_history ON medicine_dose_logs(medicine_id,scheduled_local);
    CREATE INDEX medicine_jobs_schedule ON medicine_notification_jobs(schedule_id);
  `,
};
