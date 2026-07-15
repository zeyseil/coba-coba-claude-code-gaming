import { getTaskStatus } from "./taskStatus";

// Pure filtering — no React, no storage. The single source of truth for filter
// logic. `now` is injected by the caller (never calls Date.now() itself).
//
// filters shape:
//   { status: "all"|"active"|"completed",
//     priorities: string[],          // [] means NO restriction (all pass)
//     date: "any"|"today"|"overdue",
//     search: string }               // empty/whitespace means NO restriction
//
// All dimensions are combined with AND: a task passes only if it passes every
// dimension. Input order is preserved (Array.filter keeps order); no sorting.
export function getVisibleTasks(tasks, filters, now) {
  const search = filters.search.trim().toLowerCase();

  return tasks.filter((task) => {
    const status = getTaskStatus(task, now);

    // Status (exclusive). active = not "completed".
    if (filters.status === "active" && status === "completed") return false;
    if (filters.status === "completed" && status !== "completed") return false;

    // Priority (multi). [] = no restriction, so every priority passes.
    if (
      filters.priorities.length > 0 &&
      !filters.priorities.includes(task.priority)
    ) {
      return false;
    }

    // Date (exclusive).
    if (filters.date === "today") {
      if (!task.deadline) return false; // no deadline is never "today"
      if (!isSameLocalDay(new Date(task.deadline), now)) return false;
    }
    if (filters.date === "overdue" && status !== "overdue") return false;

    // Search (case-insensitive substring on title). Empty = no restriction.
    if (search !== "" && !task.title.toLowerCase().includes(search)) {
      return false;
    }

    return true; // passed every dimension
  });
}

// Compare LOCAL calendar days, not instants. Local getters give the wall-clock
// date in the viewer's timezone; comparing UTC days (e.g. toISOString slice)
// would be wrong near midnight in non-UTC zones.
function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
