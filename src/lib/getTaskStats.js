// Pure stats aggregation — no React, no storage. Always computed from the
// FULL task list (never the filtered/visible one), same rule as the progress
// bar: filters must not affect these numbers.
export function getTaskStats(tasks, folders = [], templates = []) {
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

  // Folder breakdown: one entry per folder (in the same order as `folders`,
  // already sorted by `order`), plus a trailing "No folder" bucket.
  const byFolder = folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    count: tasks.filter((t) => t.folderId === folder.id).length,
  }));
  const noFolderCount = tasks.filter((t) => t.folderId === null).length;

  // Subtask breakdown: aggregate only, not per-task.
  const allSubtasks = tasks.flatMap((t) => t.subtasks);
  const subtaskStats = {
    totalSubtasks: allSubtasks.length,
    completedSubtasks: allSubtasks.filter((s) => s.completed).length,
    tasksWithSubtasks: tasks.filter((t) => t.subtasks.length > 0).length,
  };

  // Recurring template breakdown: per-template instance count, plus an
  // orphaned bucket for tasks whose templateId no longer matches any
  // template (the template was deleted — deleteTemplate unassigns instances
  // rather than deleting them, see storage.js).
  const templateIds = new Set(templates.map((t) => t.id));
  const byTemplate = templates.map((template) => ({
    id: template.id,
    title: template.title,
    active: template.active,
    instanceCount: tasks.filter((t) => t.templateId === template.id).length,
  }));
  const activeTemplateCount = templates.filter((t) => t.active).length;
  const pausedTemplateCount = templates.length - activeTemplateCount;
  const orphanedInstanceCount = tasks.filter(
    (t) => t.templateId !== null && !templateIds.has(t.templateId),
  ).length;

  return {
    total,
    active,
    completed,
    byPriority,
    byTag,
    byFolder,
    noFolderCount,
    subtaskStats,
    byTemplate,
    activeTemplateCount,
    pausedTemplateCount,
    orphanedInstanceCount,
  };
}
