// Pure helpers for Calendar View. No React, no storage. Built-in Date only —
// same "local getters, no UTC" rule as lib/deadline.js so a deadline stored as
// today 23:59 lands in today's cell, not tomorrow's via a UTC shift.

function pad(n) {
  return String(n).padStart(2, "0");
}

// Local YYYY-MM-DD key for a Date, used both to group tasks and to key grid
// cells so the two line up regardless of timezone.
export function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Group tasks by the local date of their deadline. Tasks without a deadline
// are skipped (spec: never shown on the calendar). One entry per task (a
// deadline is a single instant, never a range).
export function groupTasksByDate(tasks) {
  const map = new Map();
  for (const task of tasks) {
    if (!task.deadline) continue;
    const key = dateKey(new Date(task.deadline));
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(task);
  }
  return map;
}

// 6 weeks (42 days) covering `month` (0-11) of `year`, including the leading/
// trailing days from adjacent months needed to fill whole weeks. Sunday-first,
// matching <input type="date"> week numbering. Pure Date arithmetic handles
// leap years and year rollover for free (only the day argument varies).
export function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const days = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}
