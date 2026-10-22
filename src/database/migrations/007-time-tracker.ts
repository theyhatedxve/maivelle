export const timeTrackerSchema: import('../types.ts').Migration = {
  version: 7,
  name: 'time-tracker-projects-sessions-segments',
  sql: `
    CREATE TABLE time_projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
      description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=2000),
      color TEXT NOT NULL CHECK(length(color)=7 AND color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE time_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT REFERENCES time_projects(id) ON DELETE SET NULL,
      project_name TEXT NOT NULL, project_color TEXT NOT NULL,
      title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 240),
      type TEXT NOT NULL CHECK(type IN ('timer','manual')),
      status TEXT NOT NULL CHECK(status IN ('running','paused','completed')),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      CHECK(type='timer' OR status='completed')
    );
    CREATE UNIQUE INDEX time_one_active ON time_sessions((1)) WHERE status IN ('running','paused');
    CREATE INDEX time_sessions_history ON time_sessions(updated_at DESC,id);
    CREATE INDEX time_sessions_project ON time_sessions(project_id,type);
    CREATE TABLE time_session_segments (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES time_sessions(id) ON DELETE CASCADE,
      start_ms INTEGER NOT NULL CHECK(typeof(start_ms)='integer' AND start_ms BETWEEN 0 AND 253402300799999),
      end_ms INTEGER CHECK(end_ms IS NULL OR (typeof(end_ms)='integer' AND end_ms BETWEEN start_ms AND 253402300799999))
    );
    CREATE UNIQUE INDEX time_one_open_segment ON time_session_segments(session_id) WHERE end_ms IS NULL;
    CREATE INDEX time_segments_session ON time_session_segments(session_id,start_ms);
    CREATE INDEX time_segments_range ON time_session_segments(start_ms,end_ms);
    CREATE TRIGGER time_segment_insert BEFORE INSERT ON time_session_segments BEGIN
      SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM time_sessions WHERE id=NEW.session_id)
        THEN RAISE(ABORT,'Missing time session') END;
      SELECT CASE WHEN NEW.end_ms IS NULL AND NOT EXISTS(SELECT 1 FROM time_sessions WHERE id=NEW.session_id AND status='running')
        THEN RAISE(ABORT,'Only a running timer may have an open segment') END;
      SELECT CASE WHEN EXISTS(SELECT 1 FROM time_session_segments WHERE session_id=NEW.session_id
        AND COALESCE(end_ms,253402300799999)>NEW.start_ms AND COALESCE(NEW.end_ms,253402300799999)>start_ms)
        THEN RAISE(ABORT,'Time segments overlap') END;
    END;
    CREATE TRIGGER time_session_close BEFORE UPDATE OF status ON time_sessions WHEN NEW.status!='running' BEGIN
      SELECT CASE WHEN EXISTS(SELECT 1 FROM time_session_segments WHERE session_id=NEW.id AND end_ms IS NULL)
        THEN RAISE(ABORT,'Close the running segment before changing status') END;
    END;
  `,
};
