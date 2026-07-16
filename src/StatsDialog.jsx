// Presentational only. Holds no computation — stats are computed by
// getTaskStats and passed in as a prop, same pattern as FilterControls.
const PRIORITY_BADGE = {
  high: "bg-priority-high-bg text-priority-high-fg",
  medium: "bg-priority-medium-bg text-priority-medium-fg",
  low: "bg-priority-low-bg text-priority-low-fg",
};

export default function StatsDialog({ stats }) {
  const tagEntries = Object.entries(stats.byTag).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-border p-3">
          <div className="text-2xl font-semibold tabular-nums">{stats.total}</div>
          <div className="text-xs text-text-muted">Total</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-2xl font-semibold tabular-nums">{stats.active}</div>
          <div className="text-xs text-text-muted">Active</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-2xl font-semibold tabular-nums">
            {stats.completed}
          </div>
          <div className="text-xs text-text-muted">Completed</div>
        </div>
      </div>

      <fieldset className="space-y-2 border-0 p-0">
        <legend className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          By priority
        </legend>
        <div className="flex flex-wrap gap-2">
          {["high", "medium", "low"].map((priority) => (
            <span
              key={priority}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_BADGE[priority]}`}
            >
              {priority}: {stats.byPriority[priority]}
            </span>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2 border-0 p-0">
        <legend className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          By tag
        </legend>
        {tagEntries.length === 0 ? (
          <p className="text-sm text-text-muted">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tagEntries.map(([tag, count]) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-muted"
              >
                {tag} ({count})
              </span>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
