import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getTaskStatus } from "./lib/taskStatus";
import { toISODeadline, fromISODeadline, formatDeadline } from "./lib/deadline";
import Button from "./Button";
import SubtaskList from "./SubtaskList";

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
  // Subtask checklist is collapsed by default; independent of isEditing so it
  // can be operated (add/toggle/delete) whether or not the title is being edited.
  const [expanded, setExpanded] = useState(false);

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
    setConfirmingDelete(false);
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
    if (ok) {
      setConfirmingDelete(false);
      setIsEditing(false);
    }
  }

  const status = getTaskStatus(task, now);

  // Sortable wiring from @dnd-kit. Disabled unless reordering is allowed (Sort =
  // Manual and unfiltered) AND the row isn't being edited (avoids an accidental
  // drag while typing). The DndContext + drag logic live in App; this hook only
  // reports position and exposes the drag handle props.
  const dragEnabled = reorderable && !isEditing;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !dragEnabled });

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
      {/* Drag handle: fixed leftmost position in both view and edit mode, so
          the row layout never shifts as Sort By or edit state changes. When
          dragging isn't allowed (Sort != Manual, filtered, selection mode, or
          the row is being edited) an invisible placeholder of the same size
          holds the slot instead of removing it. @dnd-kit listeners drive
          mouse, touch, AND keyboard reorder (Space to lift, arrows to move,
          Space to drop — announced to screen readers). touch-action:none lets
          touch-drag work without scrolling the list. */}
      {dragEnabled ? (
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
      ) : (
        <span aria-hidden="true" className="invisible select-none px-1">
          ⠿
        </span>
      )}
      {/* Selection checkbox: only in selection mode. Ephemeral UI state
          (drives App's selectedIds), separate from the completed checkbox in
          the edit form — the two do not conflict. Rounded (vs. a square
          checkbox) so it reads as distinct at a glance. Native checkboxes
          ignore border-radius while appearance:auto (the browser draws its
          own square widget), so this one opts out with appearance-none and is
          drawn manually. The fill is driven by the `selected` prop directly
          (same pattern as the completed-title line-through below) rather than
          the :checked pseudo-class, which proved unreliable to repaint right
          after a React-driven toggle. appearance-none also drops the native
          focus ring, so the focus-visible ring below is required, not
          decorative — without it the checkbox is invisible to keyboard users. */}
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(task.id)}
          aria-label={`Select task: ${task.title}`}
          className={`size-5 sm:size-4 shrink-0 appearance-none rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            selected ? "border-accent bg-accent" : "border-border"
          }`}
        />
      )}
      <button
        type="button"
        onClick={() => onUpdate(task.id, { favorite: !task.favorite })}
        aria-label={
          task.favorite
            ? `Unfavorite task: ${task.title}`
            : `Favorite task: ${task.title}`
        }
        aria-pressed={task.favorite}
        className={`inline-flex shrink-0 items-center justify-center min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          task.favorite ? "text-accent" : "text-text-muted"
        }`}
      >
        {task.favorite ? "★" : "☆"}
      </button>
      {/* Subtask expand/collapse, always shown (even with zero subtasks) so
          there's a way to add the first one. Progress badge only shows once
          there's something to count. Lives outside the edit form so the
          checklist stays operable whether or not the title is being edited
          (same "always active" treatment as complete/favorite). */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? `Collapse subtasks: ${task.title}`
            : `Expand subtasks: ${task.title}`
        }
        className="inline-flex shrink-0 items-center gap-1 min-h-11 sm:min-h-0 rounded-lg border border-border bg-progress-track px-2 py-1 text-xs text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        {task.subtasks.length > 0
          ? `${task.subtasks.filter((s) => s.completed).length}/${task.subtasks.length}`
          : "Subtasks"}
      </button>
      {isEditing ? (
        <form
          onSubmit={save}
          className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          {/* Completed toggle and delete live only in edit mode now — the row
              view is kept lean; both actions are one click (title) away. */}
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => onUpdate(task.id, { completed: !task.completed })}
              className="size-5 sm:size-4 [accent-color:var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            Completed
          </label>
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
          {confirmingDelete ? (
            <>
              <Button
                variant="danger"
                aria-label={`Confirm delete: ${task.title}`}
                onClick={() => onDelete(task.id)}
                className="w-full sm:w-auto"
              >
                Confirm
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmingDelete(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="danger"
              onClick={() => setConfirmingDelete(true)}
              className="w-full sm:w-auto"
            >
              Delete
            </Button>
          )}
        </form>
      ) : (
        <>
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
          {task.templateId && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-progress-track px-2 py-1 text-xs text-text-muted">
              ↻ Recurring
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
        </>
      )}
      {expanded && (
        <SubtaskList
          subtasks={task.subtasks}
          onChange={(subtasks) => onUpdate(task.id, { subtasks })}
        />
      )}
    </li>
  );
}
