import { useState } from "react";
import { getTaskStatus } from "./lib/taskStatus";
import { toISODeadline, fromISODeadline } from "./lib/deadline";
import Button from "./Button";

// Static value->className map for the priority badge. Presentation only; the
// stored priority string is unchanged.
const PRIORITY_BADGE = {
  high: "bg-priority-high-bg text-priority-high-fg",
  medium: "bg-priority-medium-bg text-priority-medium-fg",
  low: "bg-priority-low-bg text-priority-low-fg",
};

const FIELD =
  "w-full sm:w-auto min-h-11 sm:min-h-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

// One task row. Owns only its local edit state; the task list and all storage
// mutations live in App. onUpdate returns true on success so the row knows
// whether to leave edit mode. `now` is injected from App for status.
export default function TaskRow({
  task,
  now,
  index,
  total,
  reorderable,
  onReorder,
  onUpdate,
  onDelete,
}) {
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

  // Drop target lives on the row, but only while reordering is allowed. onDragOver
  // must preventDefault so onDrop can fire. The dragged source index travels in
  // the native dataTransfer — no React state needed.
  const dragProps = reorderable
    ? {
        onDragOver: (e) => e.preventDefault(),
        onDrop: (e) => {
          e.preventDefault();
          const from = Number(e.dataTransfer.getData("text/plain"));
          if (!Number.isNaN(from)) onReorder(from, index);
        },
      }
    : {};

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3" {...dragProps}>
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onUpdate(task.id, { completed: !task.completed })}
        className="size-5 sm:size-4 [accent-color:var(--color-accent)]"
      />
      {isEditing ? (
        <form
          onSubmit={save}
          className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={FIELD}
          />
          <select
            value={draftPriority}
            onChange={(e) => setDraftPriority(e.target.value)}
            className={FIELD}
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className={FIELD}
          />
          <input
            type="time"
            value={draftTime}
            onChange={(e) => setDraftTime(e.target.value)}
            className={FIELD}
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
            className={FIELD}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={addDraftTag}
            className="w-full sm:w-auto"
          >
            Add tag
          </Button>
          {draftTags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-muted"
            >
              {tag}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraftTags(draftTags.filter((_, j) => j !== i))}
              >
                x
              </Button>
            </span>
          ))}
          <Button type="submit" variant="primary" className="w-full sm:w-auto">
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={cancel}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
        </form>
      ) : (
        <>
          {reorderable && (
            <>
              <span
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/plain", String(index))
                }
                className="cursor-grab select-none text-text-muted"
                aria-hidden="true"
              >
                ⠿
              </span>
              <Button
                type="button"
                variant="ghost"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => onReorder(index, index - 1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label="Move down"
                disabled={index === total - 1}
                onClick={() => onReorder(index, index + 1)}
              >
                ↓
              </Button>
            </>
          )}
          <span
            onClick={startEdit}
            className={`min-w-0 basis-full sm:basis-auto sm:flex-1 cursor-pointer break-words line-clamp-2 text-sm text-text ${
              task.completed ? "line-through text-text-muted" : ""
            }`}
          >
            {task.title}
          </span>
          <span
            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_BADGE[task.priority]}`}
          >
            {task.priority}
          </span>
          {status === "overdue" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-status-overdue">
              ⚠ Overdue
            </span>
          )}
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-muted"
            >
              {tag}
            </span>
          ))}
          <Button variant="danger" onClick={() => onDelete(task.id)}>
            Delete
          </Button>
        </>
      )}
    </li>
  );
}
