// Presentational filter controls. Holds no filter logic and never filters the
// list — it just emits a new `filters` object. Filter state lives in the parent
// (App); the actual filtering happens in getVisibleTasks.
//
// The four dimensions are independent and combined with AND, so they must be
// separate controls (not one row of mutually exclusive buttons): Status and
// Date are exclusive radio groups, Priority is a multi checkbox set, Search is
// a text input. You can select Active + High + Today + "react" all at once.
const PRIORITIES = ["high", "medium", "low"];

export default function FilterControls({ filters, onChange }) {
  function togglePriority(priority) {
    const next = filters.priorities.includes(priority)
      ? filters.priorities.filter((p) => p !== priority)
      : [...filters.priorities, priority];
    onChange({ ...filters, priorities: next });
  }

  return (
    <div>
      <fieldset>
        <legend>Status</legend>
        {["all", "active", "completed"].map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="status"
              checked={filters.status === value}
              onChange={() => onChange({ ...filters, status: value })}
            />
            {value}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Priority</legend>
        {PRIORITIES.map((priority) => (
          <label key={priority}>
            <input
              type="checkbox"
              checked={filters.priorities.includes(priority)}
              onChange={() => togglePriority(priority)}
            />
            {priority}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Date</legend>
        {["any", "today", "overdue"].map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="date"
              checked={filters.date === value}
              onChange={() => onChange({ ...filters, date: value })}
            />
            {value}
          </label>
        ))}
      </fieldset>

      <label>
        Search
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </label>
    </div>
  );
}
