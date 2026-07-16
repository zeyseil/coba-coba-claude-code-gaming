// Presentational button. Owns look and generic behavior only — no business
// logic. Extracted because there are now more than three real callers (App and
// TaskRow, add/save/cancel/delete/add-tag/remove-tag).
const BASE =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm min-h-11 sm:min-h-0 transition-[color,background-color,border-color,opacity,transform] duration-150 enabled:active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed";

// Hover and active are gated behind `enabled:` so a disabled button stays
// visually inert instead of still reacting to the pointer.
// success/danger/neutral are filled (bg + fg pair), matching primary's style
// rather than secondary/ghost's border-only look — these three carry a
// specific meaning (complete / delete / undo-complete) that a solid color
// communicates faster than a border does.
const VARIANTS = {
  primary: "bg-accent text-accent-fg enabled:hover:opacity-90",
  secondary:
    "border border-border bg-surface text-text enabled:hover:border-accent",
  ghost:
    "border border-transparent text-text-muted enabled:hover:border-accent",
  danger: "bg-danger-bg text-danger-fg enabled:hover:opacity-90",
  success: "bg-success-bg text-success-fg enabled:hover:opacity-90",
  neutral: "bg-neutral-bg text-neutral-fg enabled:hover:opacity-90",
};

export default function Button({ variant = "secondary", className = "", ...props }) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
  );
}
