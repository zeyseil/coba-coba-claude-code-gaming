import { useState } from "react";
import Button from "./Button";

// Action bar shown only in selection mode. Presentational: all selection state
// (selectedIds, selectionMode) lives in App; this component only reports intents
// via callbacks. The two-step delete confirmation is local state here, mirroring
// the per-row pattern in TaskRow — bulk delete is destructive, so it asks first.
export default function SelectionBar({
  selectedCount,
  visibleCount,
  onSelectAll,
  onClear,
  onComplete,
  onUncomplete,
  onDelete,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const none = selectedCount === 0;
  const allSelected = selectedCount === visibleCount;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text animate-[fade-slide-in_150ms_ease-out]">
      <span className="tabular-nums text-text-muted">
        {selectedCount} selected
      </span>

      {allSelected ? (
        <Button type="button" variant="secondary" onClick={onClear}>
          Clear
        </Button>
      ) : (
        <Button type="button" variant="secondary" onClick={onSelectAll}>
          Select all
        </Button>
      )}

      <Button
        type="button"
        variant="secondary"
        disabled={none}
        onClick={onComplete}
      >
        Complete
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={none}
        onClick={onUncomplete}
      >
        Uncomplete
      </Button>

      {confirmingDelete ? (
        <>
          <Button
            variant="danger"
            aria-label={`Confirm delete ${selectedCount} tasks`}
            onClick={() => {
              onDelete();
              setConfirmingDelete(false);
            }}
          >
            Delete {selectedCount}?
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="danger"
          disabled={none}
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </Button>
      )}
    </div>
  );
}
