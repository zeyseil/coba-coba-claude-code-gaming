import { useState } from "react";

// One task row. Owns only its local edit state (isEditing + draft); the task
// list and all storage mutations live in App. onUpdate returns true on success
// so the row knows whether to leave edit mode.
export default function TaskRow({ task, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEdit() {
    setDraft(task.title);
    setIsEditing(true);
  }

  function cancel() {
    // Discard the draft; the stored title is untouched.
    setIsEditing(false);
  }

  async function save(e) {
    e.preventDefault();
    // Let storage.js validate the title. On rejection (empty/whitespace)
    // onUpdate returns false, so we stay in edit mode with the draft intact.
    const ok = await onUpdate(task.id, { title: draft });
    if (ok) setIsEditing(false);
  }

  return (
    <li>
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onUpdate(task.id, { completed: !task.completed })}
      />
      {isEditing ? (
        <form onSubmit={save}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit">Save</button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          <span onClick={startEdit}>{task.title}</span>
          <button onClick={() => onDelete(task.id)}>Delete</button>
        </>
      )}
    </li>
  );
}
