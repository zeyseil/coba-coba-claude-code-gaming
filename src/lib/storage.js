// The only module allowed to touch localStorage. Every storage access lives in
// readState/writeState below; if we ever migrate to a database, this file is the
// single thing that changes. All functions are async on purpose (localStorage is
// sync today, but the API is shaped for a future async backend).

const STORAGE_KEY = "tasks";
const SCHEMA_VERSION = 4;

const PRIORITIES = ["high", "medium", "low"];
const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];

// Read and validate the persisted state. On corrupt/invalid/unknown-version
// data, warn and return empty state WITHOUT overwriting the bad data — it
// only gets replaced on the next successful write.
function readState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return { tasks: [], folders: [], templates: [] };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn("storage: could not parse tasks, ignoring corrupt data", e);
    return { tasks: [], folders: [], templates: [] };
  }

  // v2/v3 payloads are accepted as-is: their tasks are missing `templateId`
  // (v2 is also missing `subtasks`), which sanitizeTask below defaults —
  // same forward-compatible approach used for `folderId` when v1 tasks were
  // first read as v2.
  const isCompatibleVersion =
    parsed.version === SCHEMA_VERSION ||
    parsed.version === 3 ||
    parsed.version === 2;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !isCompatibleVersion ||
    !Array.isArray(parsed.tasks)
  ) {
    console.warn("storage: unexpected schema, ignoring", parsed);
    return { tasks: [], folders: [], templates: [] };
  }

  // Sanitize each task so corrupt localStorage can't crash the app downstream
  // (e.g. tags: null breaking task.tags.map in the UI). We coerce fixable
  // fields to safe defaults, but DROP tasks missing a hard requirement (id or a
  // real title) since we can't invent those. `order` falls back to the array
  // index here, so a missing/invalid order still yields a stable sequence.
  const tasks = parsed.tasks
    .map((raw, index) => sanitizeTask(raw, index))
    .filter((task) => task !== null);

  const folders = Array.isArray(parsed.folders)
    ? parsed.folders
        .map((raw, index) => sanitizeFolder(raw, index))
        .filter((folder) => folder !== null)
    : [];

  const templates = Array.isArray(parsed.templates)
    ? parsed.templates
        .map((raw, index) => sanitizeTemplate(raw, index))
        .filter((template) => template !== null)
    : [];

  return { tasks, folders, templates };
}

// Validate one persisted task. Returns a valid task, or null when it must be
// dropped. Coerce vs drop: title is required by spec and id identifies the task,
// so both are drop conditions; everything else has a safe default.
function sanitizeTask(raw, index) {
  if (typeof raw !== "object" || raw === null) return null;
  if (typeof raw.id !== "string" || raw.id === "") return null;
  if (typeof raw.title !== "string" || raw.title.trim() === "") return null;

  return {
    id: raw.id,
    title: raw.title,
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : "medium",
    deadline: typeof raw.deadline === "string" ? raw.deadline : null,
    tags: normalizeTags(raw.tags),
    completed: Boolean(raw.completed),
    favorite: Boolean(raw.favorite),
    folderId: typeof raw.folderId === "string" ? raw.folderId : null,
    subtasks: normalizeSubtasks(raw.subtasks),
    templateId: typeof raw.templateId === "string" ? raw.templateId : null,
    order: Number.isFinite(raw.order) ? raw.order : index,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
  };
}

// Validate one persisted folder. Returns a valid folder, or null when it must
// be dropped (missing id or a real name — same drop-vs-coerce logic as tasks).
function sanitizeFolder(raw, index) {
  if (typeof raw !== "object" || raw === null) return null;
  if (typeof raw.id !== "string" || raw.id === "") return null;
  if (typeof raw.name !== "string" || raw.name.trim() === "") return null;

  return {
    id: raw.id,
    name: raw.name,
    order: Number.isFinite(raw.order) ? raw.order : index,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
  };
}

// Validate one persisted recurring template. Returns a valid template, or
// null when it must be dropped (missing id/title/startDate or a bad
// recurrence — same drop-vs-coerce logic as tasks/folders).
function sanitizeTemplate(raw, index) {
  if (typeof raw !== "object" || raw === null) return null;
  if (typeof raw.id !== "string" || raw.id === "") return null;
  if (typeof raw.title !== "string" || raw.title.trim() === "") return null;
  if (typeof raw.startDate !== "string" || raw.startDate === "") return null;

  const frequency = FREQUENCIES.includes(raw.recurrence?.frequency)
    ? raw.recurrence.frequency
    : null;
  const interval = Number.isFinite(raw.recurrence?.interval)
    ? Math.max(1, Math.trunc(raw.recurrence.interval))
    : null;
  if (!frequency || !interval) return null;

  return {
    id: raw.id,
    title: raw.title,
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : "medium",
    tags: normalizeTags(raw.tags),
    folderId: typeof raw.folderId === "string" ? raw.folderId : null,
    recurrence: { frequency, interval },
    startDate: raw.startDate,
    active: raw.active === undefined ? true : Boolean(raw.active),
    order: Number.isFinite(raw.order) ? raw.order : index,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
  };
}

// Persist tasks, folders, and templates under the current schema version.
function writeState({ tasks, folders, templates }) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: SCHEMA_VERSION, tasks, folders, templates })
  );
}

// Reject names that are missing, non-string, or only whitespace.
function assertValidName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("Folder name must be a non-empty string");
  }
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

// Normalize subtasks: drop entries missing a real id/title, coerce `completed`
// to a boolean. Unlike tags, titles are kept as-typed (not lowercased) since
// they aren't used as a dedupe key.
function normalizeSubtasks(subtasks) {
  if (!Array.isArray(subtasks)) return [];
  const out = [];
  for (const s of subtasks) {
    if (typeof s !== "object" || s === null) continue;
    if (typeof s.id !== "string" || s.id === "") continue;
    if (typeof s.title !== "string" || s.title.trim() === "") continue;
    out.push({ id: s.id, title: s.title, completed: Boolean(s.completed) });
  }
  return out;
}

// Return all tasks, sorted ascending by `order` (order is the source of truth
// for sequence; a new task gets the smallest order and shows up on top).
export async function getTasks() {
  const { tasks } = readState();
  return [...tasks].sort((a, b) => a.order - b.order);
}

// Create a task from user input, filling id/createdAt/order/defaults ourselves.
// `templateId` defaults to null (a regular task); the recurring engine passes
// it explicitly when generating an instance.
export async function createTask(input) {
  assertValidTitle(input.title);

  const { tasks, folders, templates } = readState();
  const topOrder =
    tasks.length === 0 ? 0 : Math.min(...tasks.map((t) => t.order)) - 1;

  const task = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    priority: PRIORITIES.includes(input.priority) ? input.priority : "medium",
    deadline: input.deadline ?? null,
    tags: normalizeTags(input.tags),
    completed: false,
    favorite: false,
    folderId: typeof input.folderId === "string" ? input.folderId : null,
    subtasks: [],
    templateId: typeof input.templateId === "string" ? input.templateId : null,
    order: topOrder,
    createdAt: new Date().toISOString(),
  };

  writeState({ tasks: [task, ...tasks], folders, templates });
  return task;
}

// Patch an existing task. id and createdAt are protected (patch values ignored).
export async function updateTask(id, patch) {
  const { tasks, folders, templates } = readState();
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
    subtasks:
      "subtasks" in patch
        ? normalizeSubtasks(patch.subtasks)
        : current.subtasks,
  };

  const next = [...tasks];
  next[index] = updated;
  writeState({ tasks: next, folders, templates });
  return updated;
}

// Reindex the whole list so each task's `order` matches its position in
// orderedIds (0..N-1). One write. Ids not present keep their relative order at
// the end — a safety net against data loss if a partial list is ever passed.
export async function reorderTasks(orderedIds) {
  const { tasks, folders, templates } = readState();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ordered = [];
  for (const id of orderedIds) {
    const task = byId.get(id);
    if (task) {
      ordered.push(task);
      byId.delete(id);
    }
  }
  for (const leftover of byId.values()) ordered.push(leftover); // shouldn't happen
  const next = ordered.map((task, index) => ({ ...task, order: index }));
  writeState({ tasks: next, folders, templates });
}

// Re-insert a previously deleted task exactly as it was (same id/order/
// createdAt), so undo restores its original position. getTasks() sorts by
// `order`, so the task lands back in its old slot. Idempotent: if the id already
// exists (double undo), do nothing.
export async function restoreTask(task) {
  const { tasks, folders, templates } = readState();
  if (tasks.some((t) => t.id === task.id)) return;
  writeState({ tasks: [...tasks, task], folders, templates });
}

// Remove a task by id. Idempotent: a missing id is a no-op, not an error.
export async function deleteTask(id) {
  const { tasks, folders, templates } = readState();
  const next = tasks.filter((t) => t.id !== id);
  if (next.length !== tasks.length) {
    writeState({ tasks: next, folders, templates });
  }
}

// Return all folders, sorted ascending by `order`.
export async function getFolders() {
  const { folders } = readState();
  return [...folders].sort((a, b) => a.order - b.order);
}

// Create a folder from user input, filling id/createdAt/order ourselves.
export async function createFolder(input) {
  assertValidName(input.name);

  const { tasks, folders, templates } = readState();
  const topOrder =
    folders.length === 0 ? 0 : Math.max(...folders.map((f) => f.order)) + 1;

  const folder = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    order: topOrder,
    createdAt: new Date().toISOString(),
  };

  writeState({ tasks, folders: [...folders, folder], templates });
  return folder;
}

// Rename an existing folder. id and createdAt are protected.
export async function renameFolder(id, name) {
  assertValidName(name);

  const { tasks, folders, templates } = readState();
  const index = folders.findIndex((f) => f.id === id);
  if (index === -1) {
    throw new Error(`Folder not found: ${id}`);
  }

  const next = [...folders];
  next[index] = { ...next[index], name: name.trim() };
  writeState({ tasks, folders: next, templates });
  return next[index];
}

// Remove a folder by id, and unassign it from any task that pointed to it
// (tasks are never deleted as a side effect of deleting their folder).
// Idempotent: a missing id is a no-op, not an error.
export async function deleteFolder(id) {
  const { tasks, folders, templates } = readState();
  const nextFolders = folders.filter((f) => f.id !== id);
  if (nextFolders.length === folders.length) return;

  const nextTasks = tasks.map((t) =>
    t.folderId === id ? { ...t, folderId: null } : t
  );
  writeState({ tasks: nextTasks, folders: nextFolders, templates });
}

// Reject recurring templates with a bad title/startDate/recurrence shape.
function assertValidTemplateInput(input) {
  assertValidTitle(input.title);
  if (typeof input.startDate !== "string" || input.startDate === "") {
    throw new Error("Recurring template requires a start date");
  }
  if (!FREQUENCIES.includes(input.recurrence?.frequency)) {
    throw new Error("Recurring template requires a valid frequency");
  }
  if (
    !Number.isFinite(input.recurrence?.interval) ||
    input.recurrence.interval < 1
  ) {
    throw new Error("Recurring template requires an interval >= 1");
  }
}

// Return all recurring templates, sorted ascending by `order`.
export async function getTemplates() {
  const { templates } = readState();
  return [...templates].sort((a, b) => a.order - b.order);
}

// Create a recurring template from user input, filling id/createdAt/order
// ourselves. Does NOT generate the first task instance — that's the
// recurring engine's job (storage stays a "dumb" CRUD layer, same as
// createFolder).
export async function createTemplate(input) {
  assertValidTemplateInput(input);

  const { tasks, folders, templates } = readState();
  const topOrder =
    templates.length === 0
      ? 0
      : Math.max(...templates.map((t) => t.order)) + 1;

  const template = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    priority: PRIORITIES.includes(input.priority) ? input.priority : "medium",
    tags: normalizeTags(input.tags),
    folderId: typeof input.folderId === "string" ? input.folderId : null,
    recurrence: {
      frequency: input.recurrence.frequency,
      interval: Math.max(1, Math.trunc(input.recurrence.interval)),
    },
    startDate: input.startDate,
    active: true,
    order: topOrder,
    createdAt: new Date().toISOString(),
  };

  writeState({ tasks, folders, templates: [...templates, template] });
  return template;
}

// Patch an existing template (e.g. toggling `active`, renaming). id and
// createdAt are protected.
export async function updateTemplate(id, patch) {
  const { tasks, folders, templates } = readState();
  const index = templates.findIndex((t) => t.id === id);
  if (index === -1) {
    throw new Error(`Recurring template not found: ${id}`);
  }

  const current = templates[index];
  const merged = { ...current, ...patch, id: current.id, createdAt: current.createdAt };
  assertValidTemplateInput(merged);

  const updated = {
    ...merged,
    title: merged.title.trim(),
    tags: normalizeTags(merged.tags),
  };

  const next = [...templates];
  next[index] = updated;
  writeState({ tasks, folders, templates: next });
  return updated;
}

// Remove a template by id, and unassign it from any task instance that
// pointed to it (instances are never deleted — they become regular tasks,
// per spec §5.6 "Menghapus template tidak menghapus instance lama").
// Idempotent: a missing id is a no-op, not an error.
export async function deleteTemplate(id) {
  const { tasks, folders, templates } = readState();
  const nextTemplates = templates.filter((t) => t.id !== id);
  if (nextTemplates.length === templates.length) return;

  const nextTasks = tasks.map((t) =>
    t.templateId === id ? { ...t, templateId: null } : t
  );
  writeState({ tasks: nextTasks, folders, templates: nextTemplates });
}
