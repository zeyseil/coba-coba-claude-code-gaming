// Pure status logic — no React, no storage. `now` is injected by the caller so
// this stays deterministic and testable; it must never call Date.now() itself.
//
// Check order is fixed by spec and must not be reordered. The !task.deadline
// guard is mandatory before any comparison: a task without a deadline is never
// overdue, and a completed task is never overdue.
export function getTaskStatus(task, now) {
  if (task.completed) return "completed";
  if (!task.deadline) return "upcoming";
  if (new Date(task.deadline) < now) return "overdue";
  return "upcoming";
}
