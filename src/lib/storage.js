// The only module allowed to touch localStorage. Every storage access lives in
// readState/writeState below; if we ever migrate to a database, this file is the
// single thing that changes. All functions are async on purpose (localStorage is
// sync today, but the API is shaped for a future async backend).

const STORAGE_KEY = "tasks";
const SCHEMA_VERSION = 1;

const PRIORITIES = ["high", "medium", "low"];

// Read and validate the persisted state. On corrupt/invalid/unknown-version
// data, warn and return an empty task list WITHOUT overwriting the bad data —
// it only gets replaced on the next successful write.
function readState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn("storage: could not parse tasks, ignoring corrupt data", e);
    return [];
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    parsed.version !== SCHEMA_VERSION ||
    !Array.isArray(parsed.tasks)
  ) {
    console.warn("storage: unexpected schema, ignoring", parsed);
    return [];
  }

  return parsed.tasks;
}

// Persist the task list under the current schema version.
function writeState(tasks) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: SCHEMA_VERSION, tasks })
  );
}

// Reject titles that are missing, non-string, or only whitespace.
function assertValidTitle(title) {
  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("Task title must be a non-empty string");
  }
}

// Normalize tags: trim + lowercase, drop empties (after trim) and duplicates.
// This is validation, so it lives here — components never normalize tags.
function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const norm = t.trim().toLowerCase();
    if (norm === "") continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

// Return all tasks, sorted ascending by `order` (order is the source of truth
// for sequence; a new task gets the smallest order and shows up on top).
export async function getTasks() {
  const tasks = readState();
  return [...tasks].sort((a, b) => a.order - b.order);
}

// Create a task from user input, filling id/createdAt/order/defaults ourselves.
export async function createTask(input) {
  assertValidTitle(input.title);

  const tasks = readState();
  const topOrder =
    tasks.length === 0 ? 0 : Math.min(...tasks.map((t) => t.order)) - 1;

  const task = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    priority: PRIORITIES.includes(input.priority) ? input.priority : "medium",
    deadline: input.deadline ?? null,
    tags: normalizeTags(input.tags),
    completed: false,
    order: topOrder,
    createdAt: new Date().toISOString(),
  };

  writeState([task, ...tasks]);
  return task;
}

// Patch an existing task. id and createdAt are protected (patch values ignored).
export async function updateTask(id, patch) {
  const tasks = readState();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    throw new Error(`Task not found: ${id}`);
  }

  if ("title" in patch) {
    assertValidTitle(patch.title);
  }

  const current = tasks[index];
  const updated = {
    ...current,
    ...patch,
    // Re-assert protected fields last so a patch cannot override them.
    id: current.id,
    createdAt: current.createdAt,
    title: "title" in patch ? patch.title.trim() : current.title,
    tags: "tags" in patch ? normalizeTags(patch.tags) : current.tags,
  };

  const next = [...tasks];
  next[index] = updated;
  writeState(next);
  return updated;
}

// Remove a task by id. Idempotent: a missing id is a no-op, not an error.
export async function deleteTask(id) {
  const tasks = readState();
  const next = tasks.filter((t) => t.id !== id);
  if (next.length !== tasks.length) {
    writeState(next);
  }
}
