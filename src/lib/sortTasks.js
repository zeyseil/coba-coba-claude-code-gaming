// Pure sorting — no React, no storage. The single place list ordering is
// decided. It never calls Date.now(): Manual uses `order`, Priority uses an
// explicit rank map, Deadline compares tasks' own deadline values. Returns a
// new array; the input is never mutated and `order` is never changed.
//
// Sort and filter are separate concerns: filtering lives in getVisibleTasks.js,
// this file only orders. `completed` never affects ordering — done tasks are
// not sunk to the bottom.
//
// `favorite` is a pin, not a Sort By option: favorited tasks always float to
// the top, in every sortBy mode, and non-favorites fill in below them. Within
// each of those two groups, the normal sortBy ordering still applies.

// Explicit priority ranking. NEVER sort the priority strings alphabetically
// ("high" < "low" < "medium" would be wrong); high beats medium beats low.
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

// Stable tie-breaker: `order` is the source of truth for sequence, so equal
// keys fall back to it. This keeps sorts stable and respects manual ordering.
function byOrder(a, b) {
  return a.order - b.order;
}

function orderWithin(tasks, sortBy) {
  const copy = [...tasks];

  if (sortBy === "priority") {
    return copy.sort((a, b) => {
      const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return diff !== 0 ? diff : byOrder(a, b);
    });
  }

  if (sortBy === "deadline") {
    return copy.sort((a, b) => {
      // Tasks without a deadline always sort to the bottom.
      const aNull = !a.deadline;
      const bNull = !b.deadline;
      if (aNull && bNull) return byOrder(a, b);
      if (aNull) return 1;
      if (bNull) return -1;
      const diff = new Date(a.deadline) - new Date(b.deadline);
      return diff !== 0 ? diff : byOrder(a, b);
    });
  }

  // "manual" (default): ascending by `order`.
  return copy.sort(byOrder);
}

export function sortTasks(tasks, sortBy) {
  const favorites = tasks.filter((t) => t.favorite);
  const rest = tasks.filter((t) => !t.favorite);
  return [...orderWithin(favorites, sortBy), ...orderWithin(rest, sortBy)];
}
