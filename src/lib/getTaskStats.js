// Pure stats aggregation — no React, no storage. Always computed from the
// FULL task list (never the filtered/visible one), same rule as the progress
// bar: filters must not affect these numbers.
export function getTaskStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const active = total - completed;

  // Initialize all three priorities to 0 so a priority with no tasks still
  // shows up (rather than being absent from the object).
  const byPriority = { high: 0, medium: 0, low: 0 };
  for (const task of tasks) {
    byPriority[task.priority]++;
  }

  // Tags are already normalized (trimmed/lowercased/deduped per task) in
  // storage.js, so counting occurrences needs no further cleanup here.
  const byTag = {};
  for (const tag of tasks.flatMap((t) => t.tags)) {
    byTag[tag] = (byTag[tag] ?? 0) + 1;
  }

  return { total, active, completed, byPriority, byTag };
}
