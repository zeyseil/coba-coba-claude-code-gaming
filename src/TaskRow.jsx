import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getTaskStatus } from "./lib/taskStatus";
import { toISODeadline, fromISODeadline, formatDeadline } from "./lib/deadline";
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
  reorderable,
  selectionMode,
  selected,
  folders,
  onToggleSelect,
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
  const [draftFolderId, setDraftFolderId] = useState(null);
  // Two-step delete confirmation lives here, local to the row (same pattern as
  // isEditing). Delete only removes the task after an explicit Confirm.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function startEdit() {
    const { date, time } = fromISODeadline(task.deadline);
    setDraft(task.title);
    setDraftPriority(task.priority);
    setDraftDate(date);
    setDraftTime(time);
    setDraftTags(task.tags);
    setDraftTagInput("");
    setDraftFolderId(task.folderId);
    // Clear any pending delete confirmation so it doesn't linger when the row
    // returns from edit mode to the view mode.
    setConfirmingDelete(false);
    setIsEditing(true);
  }

  function addDraftTag() {
    // Trim before the empty check: a whitespace-only tag would otherwise show
    // as a chip, then get silently dropped by normalizeTags on save.
    const tag = draftTagInput.trim();
    if (tag === "") return;
    setDraftTags([...draftTags, tag]);
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
      folderId: draftFolderId,
    });
    if (ok) setIsEditing(false);
  }

  const status = getTaskStatus(task, now);

  // Sortable wiring from @dnd-kit. Disabled unless reordering is allowed (Sort =
  // Manual and unfiltered), matching the spec. The DndContext + drag logic live
  // in App; this hook only reports position and exposes the drag handle props.
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !reorderable });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={sortableStyle}
      className={`flex flex-wrap items-center gap-3 px-4 py-3 transition-colors ${
        isDragging ? "opacity-40" : "hover:bg-row-hover"
      }`}
    >
      {/* Selection checkbox: only in selection mode, leftmost. Ephemeral UI
          state (drives App's selectedIds), separate from the completed checkbox
          below — the two do not conflict. Rounded (vs. the square completed
          checkbox) so the two are distinguishable at a glance when both show.
          Native checkboxes ignore border-radius while appearance:auto (the
          browser draws its own square widget), so this one opts out with
          appearance-none and is drawn manually. The fill is driven by the
          `selected` prop directly (same pattern as the completed-title
          line-through below) rather than the :checked pseudo-class, which
          proved unreliable to repaint right after a React-driven toggle. */}
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(task.id)}
          aria-label={`Select task: ${task.title}`}
          className={`size-5 sm:size-4 shrink-0 appearance-none rounded-full border-2 transition-colors ${
            selected ? "border-accent bg-accent" : "border-border"
          }`}
        />
      )}
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onUpdate(task.id, { completed: !task.completed })}
        className="size-5 sm:size-4 [accent-color:var(--color-accent)]"
      />
      <button
        type="button"
        onClick={() => onUpdate(task.id, { favorite: !task.favorite })}
        aria-label={
          task.favorite
            ? `Unfavorite task: ${task.title}`
            : `Favorite task: ${task.title}`
        }
        aria-pressed={task.favorite}
        className={`shrink-0 text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          task.favorite ? "text-accent" : "text-text-muted"
        }`}
      >
        {task.favorite ? "★" : "☆"}
      </button>
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
          <select
            value={draftFolderId ?? ""}
            onChange={(e) => setDraftFolderId(e.target.value || null)}
            className={FIELD}
          >
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
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
          {/* Drag handle. @dnd-kit listeners drive mouse, touch, AND keyboard
              reorder (Space to lift, arrows to move, Space to drop — announced
              to screen readers). touch-action:none lets touch-drag work without
              scrolling the list. */}
          {reorderable && (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Drag to reorder: ${task.title}`}
              className="cursor-grab select-none px-1 text-text-muted [touch-action:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              ⠿
            </button>
          )}
          {/* In selection mode the title is plain, non-interactive text —
              edit-on-click is disabled so it doesn't compete with selecting.
              Otherwise it's a <span> (kept for flex/line-clamp/line-through)
              with button semantics + keyboard support so it's operable. */}
          {selectionMode ? (
            <span
              className={`min-w-0 basis-full sm:basis-auto sm:flex-1 break-words line-clamp-2 text-sm text-text transition-colors ${
                task.completed ? "line-through text-text-muted" : ""
              }`}
            >
              {task.title}
            </span>
          ) : (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Edit task: ${task.title}`}
              onClick={startEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault(); // Space would otherwise scroll the page
                  startEdit();
                }
              }}
              className={`min-w-0 basis-full sm:basis-auto sm:flex-1 cursor-pointer break-words line-clamp-2 text-sm text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                task.completed ? "line-through text-text-muted" : ""
              }`}
            >
              {task.title}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_BADGE[task.priority]}`}
          >
            {task.priority}
          </span>
          {task.deadline && (
            <span className="text-xs text-text-muted">
              {formatDeadline(task.deadline)}
            </span>
          )}
          {status === "overdue" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-status-overdue">
              ⚠ Overdue
            </span>
          )}
          {task.folderId && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-progress-track px-2 py-1 text-xs text-text-muted">
              {folders.find((f) => f.id === task.folderId)?.name ?? "?"}
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
          {confirmingDelete ? (
            <>
              <Button
                variant="danger"
                aria-label={`Confirm delete: ${task.title}`}
                onClick={() => onDelete(task.id)}
              >
                Confirm
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
        </>
      )}
    </li>
  );
}
