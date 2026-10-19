const pad = (/** @type {number} */ number) => String(number).padStart(2, '0');
/** Calendar dates and times are local wall-clock deadlines, not UTC midnight. @param {Date} [now] */
export function taskClock(now = new Date()) {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { today, localNow: `${today}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${String(now.getMilliseconds()).padStart(3, '0')}` };
}
/** @param {{status: string, dueDate: string | null, dueTime: string | null}} task @param {Date} [now] */
export function isTaskOverdue(task, now = new Date()) {
  if (task.status === 'completed' || !task.dueDate) return false;
  const clock = taskClock(now);
  return task.dueTime ? `${task.dueDate}T${task.dueTime}:00.000` < clock.localNow : task.dueDate < clock.today;
}
/** @param {{dueDate: string | null, dueTime: string | null}} task */
export function dueLabel(task) { return task.dueDate ? `Due ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ' · all day'}` : 'No deadline'; }
