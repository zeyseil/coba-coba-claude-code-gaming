import { useState } from "react";
import Button from "./Button";

const FIELD =
  "min-h-11 sm:min-h-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

// Checklist inside a task. Presentational: every change (add/toggle/rename/
// delete) computes the next full array and hands it to onChange in one call;
// this component holds no subtask data itself, only transient UI state
// (the add-input draft, and which row is renaming/confirming-delete).
export default function SubtaskList({ subtasks, onChange }) {
  const [newTitle, setNewTitle] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  function addSubtask(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (title === "") return;
    onChange([...subtasks, { id: crypto.randomUUID(), title, completed: false }]);
    setNewTitle("");
  }

  function toggleSubtask(id) {
    onChange(
      subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  }

  function startRename(subtask) {
    setRenamingId(subtask.id);
    setRenamingTitle(subtask.title);
    setConfirmingDeleteId(null);
  }

  function saveRename(e) {
    e.preventDefault();
    const title = renamingTitle.trim();
    if (title === "") return;
    onChange(
      subtasks.map((s) => (s.id === renamingId ? { ...s, title } : s))
    );
    setRenamingId(null);
  }

  function deleteSubtask(id) {
    onChange(subtasks.filter((s) => s.id !== id));
    setConfirmingDeleteId(null);
  }

  return (
    <div className="w-full basis-full space-y-2 pl-8">
      {subtasks.length > 0 && (
        <ul className="space-y-1">
          {subtasks.map((subtask) => (
            <li key={subtask.id} className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => toggleSubtask(subtask.id)}
                className="size-4 shrink-0 [accent-color:var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
              {renamingId === subtask.id ? (
                <form
                  onSubmit={saveRename}
                  className="flex flex-1 flex-wrap items-center gap-2"
                >
                  <input
                    value={renamingTitle}
                    onChange={(e) => setRenamingTitle(e.target.value)}
                    className={FIELD}
                  />
                  <Button type="submit" variant="primary">
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRenamingId(null)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit subtask: ${subtask.title}`}
                    onClick={() => startRename(subtask)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        startRename(subtask);
                      }
                    }}
                    className={`min-w-0 flex-1 cursor-pointer break-words text-sm text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                      subtask.completed ? "line-through text-text-muted" : ""
                    }`}
                  >
                    {subtask.title}
                  </span>
                  {confirmingDeleteId === subtask.id ? (
                    <>
                      <Button
                        variant="danger"
                        aria-label={`Confirm delete subtask: ${subtask.title}`}
                        onClick={() => deleteSubtask(subtask.id)}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => setConfirmingDeleteId(subtask.id)}
                    >
                      Delete
                    </Button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addSubtask} className="flex flex-wrap items-center gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New subtask"
          className={FIELD}
        />
        <Button type="submit" variant="secondary">
          Add subtask
        </Button>
      </form>
    </div>
  );
}
