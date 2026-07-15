// Header button that flips between light and dark theme.
export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors hover:border-accent"
    >
      <span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
