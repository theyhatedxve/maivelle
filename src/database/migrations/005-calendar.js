/** @type {import('../types.js').Migration} */
export const calendarSchema = {
  version: 5,
  name: 'calendar-events-rules-and-exceptions',
  sql: `
    CREATE TABLE calendar_event_categories (
      id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
      name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
      color TEXT NOT NULL CHECK(color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL CHECK(updated_at >= created_at)
    );
    CREATE TABLE calendar_events (
      id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
      title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 240),
      description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 100000),
      location TEXT NOT NULL DEFAULT '' CHECK(length(location) <= 500),
      start_local TEXT NOT NULL CHECK(length(start_local)=16 AND datetime(start_local) IS NOT NULL),
      end_local TEXT NOT NULL CHECK(length(end_local)=16 AND datetime(end_local) IS NOT NULL AND end_local>start_local),
      all_day INTEGER NOT NULL CHECK(all_day IN (0,1)),
      category_id TEXT REFERENCES calendar_event_categories(id) ON DELETE SET NULL ON UPDATE RESTRICT,
      recurrence_json TEXT NOT NULL DEFAULT 'null' CHECK(json_valid(recurrence_json)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL CHECK(updated_at >= created_at),
      CHECK(all_day=0 OR (substr(start_local,12)='00:00' AND substr(end_local,12)='00:00'))
    );
    CREATE TABLE calendar_event_exceptions (
      event_id TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE ON UPDATE RESTRICT,
      occurrence_start TEXT NOT NULL CHECK(length(occurrence_start)=16 AND datetime(occurrence_start) IS NOT NULL),
      kind TEXT NOT NULL CHECK(kind IN ('cancelled','edited')),
      title TEXT, description TEXT, location TEXT, start_local TEXT, end_local TEXT,
      all_day INTEGER CHECK(all_day IN (0,1)),
      category_id TEXT REFERENCES calendar_event_categories(id) ON DELETE SET NULL ON UPDATE RESTRICT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL CHECK(updated_at >= created_at),
      PRIMARY KEY(event_id, occurrence_start),
      CHECK(kind='cancelled' OR (title IS NOT NULL AND length(trim(title)) BETWEEN 1 AND 240
        AND description IS NOT NULL AND length(description)<=100000 AND location IS NOT NULL AND length(location)<=500
        AND start_local IS NOT NULL AND length(start_local)=16 AND datetime(start_local) IS NOT NULL
        AND end_local IS NOT NULL AND length(end_local)=16 AND datetime(end_local) IS NOT NULL AND end_local>start_local
        AND all_day IS NOT NULL AND (all_day=0 OR (substr(start_local,12)='00:00' AND substr(end_local,12)='00:00'))))
    );
    CREATE INDEX calendar_range_idx ON calendar_events(start_local,end_local);
    CREATE INDEX calendar_category_idx ON calendar_events(category_id);
    CREATE INDEX calendar_override_range_idx ON calendar_event_exceptions(start_local,end_local);
    CREATE INDEX calendar_exception_category_idx ON calendar_event_exceptions(category_id);
  `,
};
