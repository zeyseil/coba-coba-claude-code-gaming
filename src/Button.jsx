// Presentational button. Owns look and generic behavior only — no business
// logic. Extracted because there are now more than three real callers (App and
// TaskRow, add/save/cancel/delete/add-tag/remove-tag).
const BASE =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:bg-disabled-bg disabled:text-disabled-fg";

const VARIANTS = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  secondary: "border border-border bg-surface text-text hover:border-accent",
  ghost: "border border-transparent text-text-muted hover:border-accent",
  danger: "border border-transparent text-status-overdue hover:border-accent",
};

export default function Button({ variant = "secondary", className = "", ...props }) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
  );
}
