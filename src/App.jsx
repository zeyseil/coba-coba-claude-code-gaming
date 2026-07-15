import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import TaskRow from "./TaskRow";
import FilterControls from "./FilterControls";
import { useTheme } from "./useTheme";
import { getTasks, createTask, updateTask, deleteTask } from "./lib/storage";
import { toISODeadline } from "./lib/deadline";
import { getVisibleTasks } from "./lib/getVisibleTasks";

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

      <main>
        <form onSubmit={handleAdd}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New task"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
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
          />
          <button type="button" onClick={addNewTag}>
            Add tag
          </button>
          {newTags.map((tag, i) => (
            <span key={i}>
              {tag}
              <button
                type="button"
                onClick={() => setNewTags(newTags.filter((_, j) => j !== i))}
              >
                x
              </button>
            </span>
          ))}
          <button type="submit">Add</button>
        </form>

        {error && <p>{error}</p>}

        <FilterControls
          filters={filters}
          onChange={setFilters}
          availableTags={availableTags}
        />

        {tasks === null ? (
          <p>Loading…</p>
        ) : tasks.length === 0 ? (
          <p>No tasks yet</p>
        ) : visible.length === 0 ? (
          <p>No tasks match your filters</p>
        ) : (
          <ul>
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
