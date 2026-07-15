import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import TaskRow from "./TaskRow";
import { useTheme } from "./useTheme";
import { getTasks, createTask, updateTask, deleteTask } from "./lib/storage";

export default function App() {
  const { theme, toggle } = useTheme();

  // Storage is the single source of truth: after every mutation we refetch and
  // reset state, never patching the array by hand.
  // tasks === null means "not loaded yet" (loading); an array means loaded.
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [newTitle, setNewTitle] = useState("");

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
      await createTask({ title: newTitle });
      setNewTitle("");
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
          <button type="submit">Add</button>
        </form>

        {error && <p>{error}</p>}

        {tasks === null ? (
          <p>Loading…</p>
        ) : tasks.length === 0 ? (
          <p>No tasks yet</p>
        ) : (
          <ul>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
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
