import { useState } from "react";
import { getTaskStatus } from "./lib/taskStatus";
import { toISODeadline, fromISODeadline } from "./lib/deadline";

// One task row. Owns only its local edit state; the task list and all storage
// mutations live in App. onUpdate returns true on success so the row knows
// whether to leave edit mode. `now` is injected from App for status.
export default function TaskRow({ task, now, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftPriority, setDraftPriority] = useState("medium");
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("");

  function startEdit() {
    const { date, time } = fromISODeadline(task.deadline);
    setDraft(task.title);
    setDraftPriority(task.priority);
    setDraftDate(date);
    setDraftTime(time);
    setIsEditing(true);
  }

  function cancel() {
    // Discard the drafts; the stored task is untouched.
    setIsEditing(false);
  }

  async function save(e) {
    e.preventDefault();
    // Let storage.js validate the title. On rejection (empty/whitespace)
    // onUpdate returns false, so we stay in edit mode with the drafts intact.
    const ok = await onUpdate(task.id, {
      title: draft,
      priority: draftPriority,
      deadline: toISODeadline(draftDate, draftTime),
    });
    if (ok) setIsEditing(false);
  }

  const status = getTaskStatus(task, now);

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
          <select
            value={draftPriority}
            onChange={(e) => setDraftPriority(e.target.value)}
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
          />
          <input
            type="time"
            value={draftTime}
            onChange={(e) => setDraftTime(e.target.value)}
          />
          <button type="submit">Save</button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          <span onClick={startEdit}>{task.title}</span>
          <span> {task.priority} </span>
          <span> {status} </span>
          <button onClick={() => onDelete(task.id)}>Delete</button>
        </>
      )}
    </li>
  );
}
