const pad = (number: number) => String(number).padStart(2, '0');
/** Calendar dates and times are local wall-clock deadlines, not UTC midnight. */
export function taskClock(now: Date = new Date()) {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return {
    today,
    localNow: `${today}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${String(now.getMilliseconds()).padStart(3, '0')}`,
  };
}

export function isTaskOverdue(
  task: {
    status: string;
    dueDate: string | null;
    dueTime: string | null;
  },
  now: Date = new Date(),
) {
  if (task.status === 'completed' || !task.dueDate) return false;
  const clock = taskClock(now);
  return task.dueTime
    ? `${task.dueDate}T${task.dueTime}:00.000` < clock.localNow
    : task.dueDate < clock.today;
}

export function dueLabel(task: { dueDate: string | null; dueTime: string | null }) {
  return task.dueDate
    ? `Due ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ' · all day'}`
    : 'No deadline';
}
