/** @typedef {{id: string, project_id: string | null, project_name: string, project_color: string, type: string, status: string, start_ms: number, end_ms: number | null}} TimeSlice */
/** Local civil boundaries use calendar arithmetic, including 23/25 hour DST days. @param {Date} date */
export function dayStart(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}
/** @param {number} ms */
export function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** @param {number} now */
export function periods(now) {
  const date = new Date(now);
  const day = dayStart(date);
  const week = new Date(day);
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  return {
    day,
    week: week.getTime(),
    month: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
  };
}
/** Clip each persisted active segment, never session envelope (pauses are excluded).
 * @param {TimeSlice[]} rows @param {number} from @param {number} to @param {number} now */
export function aggregateTime(rows, from, to, now) {
  let totalMs = 0;
  const ids = new Set();
  /** @type {Map<string, {id: string, name: string, color: string, durationMs: number, sessions: Set<string>}>} */
  const projects = new Map();
  /** @type {Map<string, number>} */ const days = new Map();
  for (const row of rows) {
    const start = Math.max(from, row.start_ms);
    const end = Math.min(to, row.end_ms ?? now, now);
    if (end <= start) continue;
    const duration = end - start;
    totalMs += duration;
    ids.add(row.id);
    const key =
      row.project_id ?? `deleted:${row.project_name}:${row.project_color}`;
    const project = projects.get(key) ?? {
      id: key,
      name: row.project_name,
      color: row.project_color,
      durationMs: 0,
      sessions: new Set(),
    };
    project.durationMs += duration;
    project.sessions.add(row.id);
    projects.set(key, project);
    let cursor = start;
    while (cursor < end) {
      const next = new Date(dayStart(new Date(cursor)));
      next.setDate(next.getDate() + 1);
      const boundary = Math.min(end, next.getTime());
      const day = dayKey(cursor);
      days.set(day, (days.get(day) ?? 0) + boundary - cursor);
      cursor = boundary;
    }
  }
  return {
    totalMs,
    sessionCount: ids.size,
    projects: [...projects.values()]
      .map(({ sessions, ...project }) => ({
        ...project,
        sessionCount: sessions.size,
      }))
      .sort(
        (a, b) => b.durationMs - a.durationMs || a.name.localeCompare(b.name)
      ),
    days: [...days]
      .map(([date, durationMs]) => ({ date, durationMs }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
/** @param {number} ms */
export function formatDuration(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
