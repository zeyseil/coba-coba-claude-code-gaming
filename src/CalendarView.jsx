import { useState } from "react";
import { getTaskStatus } from "./lib/taskStatus";
import { groupTasksByDate, getMonthGrid, dateKey } from "./lib/groupTasksByDate";
import TaskRow from "./TaskRow";
import Button from "./Button";

const MAX_VISIBLE_PER_DAY = 3;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

// Calendar is a pure view layer over the same Task data the list uses — no
// calendar-specific storage, no duplicate task state. Filters from the list
// view intentionally do NOT apply here: the calendar always shows every
// deadline-bearing task, independent of what's filtered in List.
export default function CalendarView({ tasks, now, folders, onUpdate, onDelete }) {
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(() => dateKey(now));

  const grid = getMonthGrid(visibleMonth.getFullYear(), visibleMonth.getMonth());
  const byDate = groupTasksByDate(tasks);
  const todayKey = dateKey(now);
  const selectedTasks = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  function goToMonth(delta) {
    setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  function goToToday() {
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayKey);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" aria-label="Previous month" onClick={() => goToMonth(-1)}>
            ←
          </Button>
          <h2 className="min-w-[10ch] text-center text-sm font-semibold">
            {MONTH_LABEL_FORMAT.format(visibleMonth)}
          </h2>
          <Button type="button" variant="secondary" aria-label="Next month" onClick={() => goToMonth(1)}>
            →
          </Button>
        </div>
        <Button type="button" variant="secondary" onClick={goToToday}>
          Today
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-surface px-1 py-1 text-center text-xs font-medium text-text-muted"
          >
            {label}
          </div>
        ))}
        {grid.map((day) => {
          const key = dateKey(day);
          const inMonth = day.getMonth() === visibleMonth.getMonth();
          const dayTasks = byDate.get(key) ?? [];
          const shown = dayTasks.slice(0, MAX_VISIBLE_PER_DAY);
          const hiddenCount = dayTasks.length - shown.length;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(key)}
              aria-label={`${key}: ${dayTasks.length} task${dayTasks.length === 1 ? "" : "s"}`}
              className={`flex min-h-20 flex-col items-stretch gap-0.5 bg-surface px-1 py-1 text-left transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                inMonth ? "text-text" : "text-text-muted"
              } ${key === selectedDate ? "ring-2 ring-inset ring-accent" : ""}`}
            >
              <span
                className={`text-xs tabular-nums ${
                  key === todayKey ? "font-semibold text-accent" : ""
                }`}
              >
                {day.getDate()}
              </span>
              {shown.map((task) => {
                const status = getTaskStatus(task, now);
                return (
                  <span
                    key={task.id}
                    className={`truncate rounded px-1 text-[11px] leading-tight ${
                      status === "overdue"
                        ? "text-status-overdue"
                        : "text-text-muted"
                    }`}
                  >
                    {task.title}
                  </span>
                );
              })}
              {hiddenCount > 0 && (
                <span className="text-[11px] leading-tight text-text-muted">
                  +{hiddenCount} more
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text">{selectedDate}</h3>
          {selectedTasks.length === 0 ? (
            <p className="text-sm text-text-muted">No tasks for this date.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {selectedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  now={now}
                  reorderable={false}
                  selectionMode={false}
                  selected={false}
                  folders={folders}
                  onToggleSelect={() => {}}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
