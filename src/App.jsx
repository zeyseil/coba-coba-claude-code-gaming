import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import TaskRow from "./TaskRow";
import FilterControls from "./FilterControls";
import { useTheme } from "./useTheme";
import { getTasks, createTask, updateTask, deleteTask } from "./lib/storage";
import { toISODeadline } from "./lib/deadline";
import { getVisibleTasks } from "./lib/getVisibleTasks";
import Button from "./Button";

export default function App() {
  const { theme, toggle } = useTheme();

  // Storage is the single source of truth: after every mutation we refetch and
  // reset state, never patching the array by hand.
  // tasks === null means "not loaded yet" (loading); an array means loaded.
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newTags, setNewTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState("");

  // Filter state lives here, in the list's parent. The actual filtering is done
  // by getVisibleTasks — never in this component.
  const [filters, setFilters] = useState({
    status: "all",
    priorities: [],
    date: "any",
    search: "",
    tags: [],
  });

  // One instant shared by every row this render; injected into getTaskStatus.
  const now = new Date();
  const visible = tasks ? getVisibleTasks(tasks, filters, now) : [];

  // Tag filter options are DERIVED from existing tasks (union of all task.tags),
  // plus any currently-selected tag so an orphaned-but-active tag stays
  // uncheckable. This is option derivation, not filtering.
  const taskTags = tasks ? [...new Set(tasks.flatMap((t) => t.tags))] : [];
  const availableTags = [...new Set([...taskTags, ...filters.tags])];

  // Progress is computed from ALL tasks (state `tasks`), never from `visible`.
  // Filters must not affect the progress bar (spec). Percentage is derived, not
  // stored on the model.
  const total = tasks ? tasks.length : 0;
  const completed = tasks ? tasks.filter((t) => t.completed).length : 0;
  const progress = total === 0 ? 0 : completed / total; // float 0..1; 0 when empty

  // A filter is active when any dimension deviates from its default. Drives the
  // "Showing X of Y" status line only.
  const filterActive =
    filters.status !== "all" ||
    filters.priorities.length > 0 ||
    filters.date !== "any" ||
    filters.search.trim() !== "" ||
    filters.tags.length > 0;

  function addNewTag() {
    if (newTagInput === "") return;
    setNewTags([...newTags, newTagInput]);
    setNewTagInput("");
  }

  async function refresh() {
    try {
      setTasks(await getTasks());
    } catch (e) {
      setError(String(e?.message ?? e));
      setTasks([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      // Let storage.js validate the title (empty/whitespace is rejected there).
      await createTask({
        title: newTitle,
        priority: newPriority,
        deadline: toISODeadline(newDate, newTime),
        tags: newTags,
      });
      setNewTitle("");
      setNewPriority("medium");
      setNewDate("");
      setNewTime("");
      setNewTags([]);
      setNewTagInput("");
      setError(null);
      await refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    }
  }

  // Used for both toggling completed and saving an edited title. Returns true
  // on success so a row can decide whether to leave edit mode.
  async function handleUpdate(id, patch) {
    try {
      await updateTask(id, patch);
      setError(null);
      await refresh();
      return true;
    } catch (err) {
      setError(String(err?.message ?? err));
      return false;
    }
  }

  async function handleDelete(id) {
    try {
      await deleteTask(id);
      setError(null);
      await refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
        <h1 className="text-2xl font-semibold">My Tasks</h1>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 space-y-6">
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New task"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds a tag without submitting the whole task form.
              if (e.key === "Enter") {
                e.preventDefault();
                addNewTag();
              }
            }}
            placeholder="New tag"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <Button type="button" variant="secondary" onClick={addNewTag}>
            Add tag
          </Button>
          {newTags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-muted"
            >
              {tag}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNewTags(newTags.filter((_, j) => j !== i))}
              >
                x
              </Button>
            </span>
          ))}
          <Button type="submit" variant="primary">
            Add
          </Button>
        </form>

        {error && <p className="text-sm text-status-overdue">{error}</p>}

        <FilterControls
          filters={filters}
          onChange={setFilters}
          availableTags={availableTags}
        />

        {/* Progress bar: always rendered, always from ALL tasks. Native
            <progress>, styled with utilities only (track + size); the fill
            follows accent-color. */}
        <div className="flex items-center gap-3">
          <progress
            value={progress}
            max={1}
            className="h-2 w-full appearance-none rounded-lg bg-progress-track [accent-color:var(--color-accent)]"
          />
          <span className="text-sm tabular-nums text-text-muted">
            {Math.floor(progress * 100)}%
          </span>
        </div>

        {/* Status line, separate from the progress bar. Single source of the
            loading / no-tasks / showing-count status. */}
        {tasks === null ? (
          <p className="text-sm text-text-muted">Loading tasks...</p>
        ) : total === 0 ? (
          <p className="text-sm text-text-muted">No tasks yet.</p>
        ) : filterActive ? (
          <p className="text-sm text-text-muted">
            Showing {visible.length} of {total} tasks
          </p>
        ) : null}

        {visible.length === 0 ? (
          tasks && total > 0 ? (
            <p className="text-sm text-text-muted">No tasks match your filters</p>
          ) : null
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                now={now}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
