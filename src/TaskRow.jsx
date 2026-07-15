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
  const [draftTags, setDraftTags] = useState([]);
  const [draftTagInput, setDraftTagInput] = useState("");

  function startEdit() {
    const { date, time } = fromISODeadline(task.deadline);
    setDraft(task.title);
    setDraftPriority(task.priority);
    setDraftDate(date);
    setDraftTime(time);
    setDraftTags(task.tags);
    setDraftTagInput("");
    setIsEditing(true);
  }

  function addDraftTag() {
    if (draftTagInput === "") return;
    setDraftTags([...draftTags, draftTagInput]);
    setDraftTagInput("");
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
      tags: draftTags,
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
          <input
            type="text"
            value={draftTagInput}
            onChange={(e) => setDraftTagInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds a tag without submitting the edit form.
              if (e.key === "Enter") {
                e.preventDefault();
                addDraftTag();
              }
            }}
            placeholder="New tag"
          />
          <button type="button" onClick={addDraftTag}>
            Add tag
          </button>
          {draftTags.map((tag, i) => (
            <span key={i}>
              {tag}
              <button
                type="button"
                onClick={() => setDraftTags(draftTags.filter((_, j) => j !== i))}
              >
                x
              </button>
            </span>
          ))}
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
          {task.tags.map((tag) => (
            <span key={tag}> {tag} </span>
          ))}
          <button onClick={() => onDelete(task.id)}>Delete</button>
        </>
      )}
    </li>
  );
}
