// Presentational filter controls. Holds no filter logic and never filters the
// list — it just emits a new `filters` object. Filter state lives in the parent
// (App); the actual filtering happens in getVisibleTasks.
//
// The four dimensions are independent and combined with AND, so they must be
// separate controls (not one row of mutually exclusive buttons): Status and
// Date are exclusive radio groups, Priority is a multi checkbox set, Search is
// a text input. You can select Active + High + Today + "react" all at once.
const PRIORITIES = ["high", "medium", "low"];

export default function FilterControls({
  filters,
  onChange,
  availableTags,
  availableFolders,
}) {
  function togglePriority(priority) {
    const next = filters.priorities.includes(priority)
      ? filters.priorities.filter((p) => p !== priority)
      : [...filters.priorities, priority];
    onChange({ ...filters, priorities: next });
  }

  function toggleTag(tag) {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: next });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <fieldset className="space-y-2 border-0 p-0">
        <legend className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Status
        </legend>
        <div className="flex flex-wrap gap-3">
          {["all", "active", "completed"].map((value) => (
            <label
              key={value}
              className="inline-flex items-center gap-1.5 text-sm text-text"
            >
              <input
                type="radio"
                name="status"
                checked={filters.status === value}
                onChange={() => onChange({ ...filters, status: value })}
                className="[accent-color:var(--color-accent)]"
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2 border-0 p-0">
        <legend className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Priority
        </legend>
        <div className="flex flex-wrap gap-3">
          {PRIORITIES.map((priority) => (
            <label
              key={priority}
              className="inline-flex items-center gap-1.5 text-sm text-text"
            >
              <input
                type="checkbox"
                checked={filters.priorities.includes(priority)}
                onChange={() => togglePriority(priority)}
                className="[accent-color:var(--color-accent)]"
              />
              {priority}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2 border-0 p-0">
        <legend className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Date
        </legend>
        <div className="flex flex-wrap gap-3">
          {["any", "today", "overdue"].map((value) => (
            <label
              key={value}
              className="inline-flex items-center gap-1.5 text-sm text-text"
            >
              <input
                type="radio"
                name="date"
                checked={filters.date === value}
                onChange={() => onChange({ ...filters, date: value })}
                className="[accent-color:var(--color-accent)]"
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2 border-0 p-0">
        <legend className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Tags
        </legend>
        <div className="flex flex-wrap gap-3">
          {availableTags.length === 0 ? (
            <span className="text-sm text-text-muted">no tags</span>
          ) : (
            availableTags.map((tag) => (
              <label
                key={tag}
                className="inline-flex items-center gap-1.5 text-sm text-text"
              >
                <input
                  type="checkbox"
                  checked={filters.tags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                  className="[accent-color:var(--color-accent)]"
                />
                {tag}
              </label>
            ))
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-2 border-0 p-0">
        <legend className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Folder
        </legend>
        <div className="flex flex-wrap gap-3">
          {[
            { value: "all", label: "all" },
            { value: "none", label: "no folder" },
            ...availableFolders.map((f) => ({ value: f.id, label: f.name })),
          ].map(({ value, label }) => (
            <label
              key={value}
              className="inline-flex items-center gap-1.5 text-sm text-text"
            >
              <input
                type="radio"
                name="folder"
                checked={filters.folder === value}
                onChange={() => onChange({ ...filters, folder: value })}
                className="[accent-color:var(--color-accent)]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex w-full items-center gap-1.5 text-sm text-text sm:inline-flex sm:w-auto">
        Search
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full sm:w-auto min-h-11 sm:min-h-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </label>
    </div>
  );
}
