import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import ThemeToggle from "./ThemeToggle";
import TaskRow from "./TaskRow";
import FilterControls from "./FilterControls";
import StatsDialog from "./StatsDialog";
import SelectionBar from "./SelectionBar";
import { useTheme } from "./useTheme";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  restoreTask,
  reorderTasks,
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
} from "./lib/storage";
import { toISODeadline } from "./lib/deadline";
import { getVisibleTasks } from "./lib/getVisibleTasks";
import { getTaskStats } from "./lib/getTaskStats";
import { sortTasks } from "./lib/sortTasks";
import { getStoredSort, setStoredSort } from "./lib/sortPreference";
import Button from "./Button";

// Lightweight, non-interactive clone shown under the pointer while a row is
// dragged (rendered inside DragOverlay). Kept separate from TaskRow so it
// carries no edit state or hooks — it only needs to look like the row.
function RowOverlay({ task }) {
  if (!task) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-lg">
      <span className="select-none text-text-muted">⠿</span>
      <span className="text-sm text-text">{task.title}</span>
      <span className="inline-flex items-center rounded-lg border border-border px-2 py-0.5 text-xs capitalize text-text-muted">
        {task.priority}
      </span>
    </div>
  );
}

export default function App() {
  // (popups: New task + Filters via native <dialog>)
  const { theme, toggle } = useTheme();

  // Storage is the single source of truth: after every mutation we refetch and
  // reset state, never patching the array by hand.
  // tasks === null means "not loaded yet" (loading); an array means loaded.
  const [tasks, setTasks] = useState(null);
  // Folders: same "storage is the source of truth, refetch after mutation"
  // pattern as tasks. [] means "loaded, none yet" (no separate loading state
  // needed since the UI treats an empty folder list the same either way).
  const [folders, setFolders] = useState([]);
  const [error, setError] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newTags, setNewTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [newFolderId, setNewFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [renamingFolderName, setRenamingFolderName] = useState("");
  const [confirmingDeleteFolderId, setConfirmingDeleteFolderId] = useState(null);

  // Filter state lives here, in the list's parent. The actual filtering is done
  // by getVisibleTasks — never in this component.
  const [filters, setFilters] = useState({
    status: "all",
    priorities: [],
    date: "any",
    search: "",
    tags: [],
    folder: "all",
  });

  // Sort preference is separate from filters (different concern) and persisted
  // via its own module, so it survives reloads. Default "manual".
  const [sortBy, setSortBy] = useState(getStoredSort);

  // The New task form and the filter panel each live in a native <dialog>,
  // driven imperatively via these refs (showModal/close). No "isOpen" state:
  // the dialog element owns its own open state, focus trap, and Escape-to-close.
  const newTaskDialog = useRef(null);
  const filterDialog = useRef(null);
  const statsDialog = useRef(null);
  const foldersDialog = useRef(null);

  // The most recently deleted task(s), kept so they can be restored. An array so
  // one undo covers both single and bulk delete (single delete stores a
  // one-element array). Persists until the next task action
  // (add/edit/toggle/delete/reorder) or an Undo. null means nothing to undo; a
  // new delete replaces the previous batch.
  const [lastDeleted, setLastDeleted] = useState(null);

  // Id of the row currently being dragged, so DragOverlay can render its clone.
  const [activeId, setActiveId] = useState(null);

  // Multi-select. Both are ephemeral UI state (never persisted), operating over
  // `visible`. selectionMode gates the selection checkboxes + action bar; while
  // it's on, drag and edit-on-click are disabled so they don't compete.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Pointer covers mouse + touch; Keyboard makes reorder operable without a
  // mouse (Space to lift, arrows to move). distance:8 stops a plain click/tap on
  // in-row buttons from starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setStoredSort(sortBy);
  }, [sortBy]);

  // One instant shared by every row this render; injected into getTaskStatus.
  const now = new Date();
  // Filter first, then sort, then render — two separate steps.
  const filtered = tasks ? getVisibleTasks(tasks, filters, now) : [];
  const visible = sortTasks(filtered, sortBy);

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
    filters.tags.length > 0 ||
    filters.folder !== "all";

  // Reorder is only allowed on the full, manually-ordered list: Sort By = Manual
  // AND no active filter/search. Derived, not state. Because sortBy is seeded
  // from getStoredSort(), this is correct from the first render after reload.
  const reorderable = sortBy === "manual" && !filterActive && !selectionMode;

  function addNewTag() {
    // Trim before the empty check: a whitespace-only tag would otherwise show
    // as a chip, then get silently dropped by normalizeTags on save.
    const tag = newTagInput.trim();
    if (tag === "") return;
    setNewTags([...newTags, tag]);
    setNewTagInput("");
  }

  async function refresh() {
    try {
      setTasks(await getTasks());
      setFolders(await getFolders());
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
    // Any other task action closes the undo window for the last delete.
    setLastDeleted(null);
    try {
      // Let storage.js validate the title (empty/whitespace is rejected there).
      await createTask({
        title: newTitle,
        priority: newPriority,
        deadline: toISODeadline(newDate, newTime),
        tags: newTags,
        folderId: newFolderId,
      });
      setNewTitle("");
      setNewPriority("medium");
      setNewDate("");
      setNewTime("");
      setNewTags([]);
      setNewTagInput("");
      setNewFolderId(null);
      setError(null);
      await refresh();
      // Only close on success; on validation error we keep the dialog open so
      // the error message stays visible next to the fields.
      newTaskDialog.current?.close();
    } catch (err) {
      setError(String(err?.message ?? err));
    }
  }

  // Used for both toggling completed and saving an edited title. Returns true
  // on success so a row can decide whether to leave edit mode.
  async function handleUpdate(id, patch) {
    setLastDeleted(null); // closes the undo window
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

  // Move the task at index `from` to index `to` within the visible list. Since
  // reorder is gated to the unfiltered manual list, `visible` is the full task
  // set in order, so its ids form the complete permutation we hand to storage.
  async function handleReorder(from, to) {
    if (from === to) return; // dropping onto itself is a no-op
    setLastDeleted(null); // closes the undo window
    try {
      const ids = visible.map((t) => t.id);
      const next = [...ids];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      await reorderTasks(next);
      setError(null);
      await refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    }
  }

  // Translate a @dnd-kit drop into our index-based reorder. `visible` is the
  // full manually-ordered list (reorder is gated to that), so its ids form the
  // complete permutation reorderTasks expects.
  function handleDragEnd(e) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = visible.map((t) => t.id);
    handleReorder(ids.indexOf(active.id), ids.indexOf(over.id));
  }

  async function handleDelete(id) {
    // Grab the full task before removing it, so it can be restored via Undo.
    const removed = tasks?.find((t) => t.id === id);
    try {
      await deleteTask(id);
      setError(null);
      await refresh();
      setLastDeleted(removed ? [removed] : null);
    } catch (err) {
      setError(String(err?.message ?? err));
    }
  }

  // Restore the most recently deleted task(s) to their original positions.
  // Sequential await (not Promise.all): each restoreTask does its own
  // read-modify-write on localStorage, so parallel calls would clobber. One
  // refresh at the end.
  async function handleUndo() {
    if (!lastDeleted) return;
    try {
      for (const task of lastDeleted) {
        await restoreTask(task);
      }
      setLastDeleted(null);
      setError(null);
      await refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    }
  }

  // --- Multi-select -------------------------------------------------------

  // Flip selection mode; leaving it always clears the current selection so we
  // never carry stale ids into the next session of selecting.
  function toggleSelectionMode() {
    setSelectionMode((on) => {
      if (on) setSelectedIds(new Set());
      return !on;
    });
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(visible.map((t) => t.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Bulk complete/uncomplete the selected tasks. Sequential await (see
  // handleUndo). Selection is cleared afterwards so the count can't reference
  // tasks that a filter now hides.
  async function handleBulkComplete(completed) {
    setLastDeleted(null); // closes the undo window
    try {
      for (const id of selectedIds) {
        await updateTask(id, { completed });
      }
      setError(null);
      await refresh();
      clearSelection();
    } catch (err) {
      setError(String(err?.message ?? err));
    }
  }

  // Bulk delete the selected tasks (with Undo). Capture the full task objects
  // BEFORE deleting so restore has their id/order/createdAt. Sequential await,
  // one refresh. Selection mode stays on; the selection just empties.
  async function handleBulkDelete() {
    const ids = [...selectedIds];
    const removed = ids
      .map((id) => tasks?.find((t) => t.id === id))
      .filter(Boolean);
    try {
      for (const id of ids) {
        await deleteTask(id);
      }
      setError(null);
      await refresh();
      setLastDeleted(removed.length > 0 ? removed : null);
      clearSelection();
    } catch (err) {
      setError(String(err?.message ?? err));
    }
  }

  // --- Folders -------------------------------------------------------------

  async function handleCreateFolder(e) {
    e.preventDefault();
    try {
      await createFolder({ name: newFolderName });
      setNewFolderName("");
      setError(null);
      await refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    }
  }

  function startRenameFolder(folder) {
    setRenamingFolderId(folder.id);
    setRenamingFolderName(folder.name);
    setConfirmingDeleteFolderId(null);
  }

  async function saveRenameFolder(e) {
    e.preventDefault();
    try {
      await renameFolder(renamingFolderId, renamingFolderName);
      setRenamingFolderId(null);
      setError(null);
      await refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    }
  }

  // Deleting a folder unassigns it from tasks (storage handles that); it never
  // deletes the tasks themselves.
  async function handleDeleteFolder(id) {
    try {
      await deleteFolder(id);
      setConfirmingDeleteFolderId(null);
      // A deleted folder can no longer be the active filter.
      if (filters.folder === id) setFilters({ ...filters, folder: "all" });
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
        {/* Control row: the heavy New task form and filter panel now live in
            popups, opened from these buttons. Sort By stays here (visible) since
            it orders the list rather than filtering it. */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => newTaskDialog.current.showModal()}
          >
            + New task
          </Button>
          <Button
            type="button"
            variant="secondary"
            aria-label={filterActive ? "Filters (active)" : "Filters"}
            onClick={() => filterDialog.current.showModal()}
          >
            Filters
            {filterActive && (
              <span aria-hidden="true" className="text-accent">
                ●
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => statsDialog.current.showModal()}
          >
            Statistics
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => foldersDialog.current.showModal()}
          >
            Folders
          </Button>
          {/* Always reachable while selecting so Cancel can't disappear if a
              bulk delete empties the visible list. */}
          {(selectionMode || visible.length > 0) && (
            <Button
              type="button"
              variant="secondary"
              onClick={toggleSelectionMode}
            >
              {selectionMode ? "Cancel" : "Select"}
            </Button>
          )}
          <label className="flex items-center gap-1.5 text-sm text-text">
            Sort by
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="min-h-11 sm:min-h-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <option value="manual">Manual</option>
              <option value="priority">Priority</option>
              <option value="deadline">Deadline</option>
            </select>
          </label>
        </div>

        {error && (
          <p className="text-sm text-status-overdue animate-[fade-in_150ms_ease-out]">
            {error}
          </p>
        )}

        {/* New task popup. Native <dialog>: showModal() gives focus trap,
            Escape-to-close, and a backdrop for free. The onClick closes it when
            the backdrop (the dialog element itself) is clicked. */}
        <dialog
          ref={newTaskDialog}
          aria-labelledby="new-task-title"
          onClick={(e) => {
            if (e.target === newTaskDialog.current) newTaskDialog.current.close();
          }}
          className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-surface p-4 text-text [&::backdrop]:bg-overlay"
        >
          <h2 id="new-task-title" className="mb-3 text-lg font-semibold">
            New task
          </h2>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New task"
              className="w-full sm:w-auto min-h-11 sm:min-h-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            className="w-full sm:w-auto min-h-11 sm:min-h-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full sm:w-auto min-h-11 sm:min-h-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-full sm:w-auto min-h-11 sm:min-h-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <select
            value={newFolderId ?? ""}
            onChange={(e) => setNewFolderId(e.target.value || null)}
            className="w-full sm:w-auto min-h-11 sm:min-h-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
            className="w-full sm:w-auto min-h-11 sm:min-h-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={addNewTag}
            className="w-full sm:w-auto"
          >
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
          {/* Add-time errors (e.g. empty title) show here, inside the dialog,
              so feedback is visible while the modal is open. */}
          {error && (
            <p className="w-full text-sm text-status-overdue">{error}</p>
          )}
          <Button type="submit" variant="primary" className="w-full sm:w-auto">
            Add
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => newTaskDialog.current.close()}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
          </form>
        </dialog>

        {/* Filter popup. Same native <dialog> pattern. Filter changes apply live
            (onChange updates state immediately), so there is no Apply button —
            "Done" just closes. */}
        <dialog
          ref={filterDialog}
          aria-labelledby="filter-title"
          onClick={(e) => {
            if (e.target === filterDialog.current) filterDialog.current.close();
          }}
          className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-surface p-4 text-text [&::backdrop]:bg-overlay"
        >
          <h2 id="filter-title" className="mb-3 text-lg font-semibold">
            Filters
          </h2>
          <FilterControls
            filters={filters}
            onChange={setFilters}
            availableTags={availableTags}
            availableFolders={folders}
          />
          <Button
            type="button"
            variant="primary"
            onClick={() => filterDialog.current.close()}
            className="mt-3 w-full sm:w-auto"
          >
            Done
          </Button>
        </dialog>

        {/* Statistics popup. Read-only, same native <dialog> pattern. Always
            computed from ALL tasks (state `tasks`), never `visible` — same
            rule as the progress bar. */}
        <dialog
          ref={statsDialog}
          aria-labelledby="stats-title"
          onClick={(e) => {
            if (e.target === statsDialog.current) statsDialog.current.close();
          }}
          className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-surface p-4 text-text [&::backdrop]:bg-overlay"
        >
          <h2 id="stats-title" className="mb-3 text-lg font-semibold">
            Statistics
          </h2>
          <StatsDialog stats={getTaskStats(tasks ?? [])} />
          <Button
            type="button"
            variant="primary"
            onClick={() => statsDialog.current.close()}
            className="mt-3 w-full sm:w-auto"
          >
            Done
          </Button>
        </dialog>

        {/* Manage folders popup. Same native <dialog> pattern. Rename is
            inline (click name to edit, same pattern as task title edit);
            delete is a two-step inline confirm (same pattern as task/
            selection-bar delete). Deleting a folder unassigns it from tasks,
            it never deletes the tasks. */}
        <dialog
          ref={foldersDialog}
          aria-labelledby="folders-title"
          onClick={(e) => {
            if (e.target === foldersDialog.current) foldersDialog.current.close();
          }}
          className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-surface p-4 text-text [&::backdrop]:bg-overlay"
        >
          <h2 id="folders-title" className="mb-3 text-lg font-semibold">
            Folders
          </h2>
          <form
            onSubmit={handleCreateFolder}
            className="mb-3 flex flex-wrap items-center gap-3"
          >
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder"
              className="w-full sm:w-auto min-h-11 sm:min-h-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            <Button type="submit" variant="primary" className="w-full sm:w-auto">
              Add
            </Button>
          </form>
          {error && (
            <p className="mb-3 text-sm text-status-overdue">{error}</p>
          )}
          {folders.length === 0 ? (
            <p className="text-sm text-text-muted">No folders yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {folders.map((folder) => (
                <li
                  key={folder.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2"
                >
                  {renamingFolderId === folder.id ? (
                    <form
                      onSubmit={saveRenameFolder}
                      className="flex flex-1 flex-wrap items-center gap-2"
                    >
                      <input
                        value={renamingFolderName}
                        onChange={(e) => setRenamingFolderName(e.target.value)}
                        className="min-h-11 sm:min-h-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      />
                      <Button type="submit" variant="primary">
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setRenamingFolderId(null)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Edit folder: ${folder.name}`}
                        onClick={() => startRenameFolder(folder)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            startRenameFolder(folder);
                          }
                        }}
                        className="min-w-0 flex-1 cursor-pointer break-words text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {folder.name}
                      </span>
                      {confirmingDeleteFolderId === folder.id ? (
                        <>
                          <Button
                            variant="danger"
                            aria-label={`Confirm delete folder: ${folder.name}`}
                            onClick={() => handleDeleteFolder(folder.id)}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setConfirmingDeleteFolderId(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="danger"
                          onClick={() => setConfirmingDeleteFolderId(folder.id)}
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
          <Button
            type="button"
            variant="primary"
            onClick={() => foldersDialog.current.close()}
            className="mt-3 w-full sm:w-auto"
          >
            Done
          </Button>
        </dialog>

        {/* Progress bar: always rendered, always from ALL tasks. Custom div
            (not native <progress>) so the fill can transition smoothly across
            browsers when the value changes — native <progress> can't be
            animated reliably (Firefox doesn't animate it at all). */}
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-lg bg-progress-track"
          >
            <div
              className="h-full rounded-lg bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
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

        {/* Bulk-action bar, only in selection mode. Operates over `visible`. */}
        {selectionMode && (
          <SelectionBar
            selectedCount={selectedIds.size}
            visibleCount={visible.length}
            onSelectAll={selectAllVisible}
            onClear={clearSelection}
            onComplete={() => handleBulkComplete(true)}
            onUncomplete={() => handleBulkComplete(false)}
            onDelete={handleBulkDelete}
          />
        )}

        {/* Undo bar for the last delete (single or bulk). Persists until the
            next task action or an Undo (see setLastDeleted calls). */}
        {lastDeleted && lastDeleted.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text-muted animate-[fade-slide-in_150ms_ease-out]">
            <span className="min-w-0 truncate">
              {lastDeleted.length === 1
                ? `Deleted "${lastDeleted[0].title}"`
                : `Deleted ${lastDeleted.length} tasks`}
            </span>
            <Button type="button" variant="secondary" onClick={handleUndo}>
              Undo
            </Button>
          </div>
        )}

        {visible.length === 0 ? (
          tasks && total > 0 ? (
            <p className="text-sm text-text-muted">No tasks match your filters</p>
          ) : null
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveId(e.active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext
              items={visible.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {visible.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    now={now}
                    reorderable={reorderable}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(task.id)}
                    folders={folders}
                    onToggleSelect={toggleSelect}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            </SortableContext>
            {/* Floating clone that follows the pointer while dragging. */}
            <DragOverlay>
              {activeId ? (
                <RowOverlay task={visible.find((t) => t.id === activeId)} />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>
    </div>
  );
}
