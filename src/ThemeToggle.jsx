import Button from "./Button";

// Header button that flips between light and dark theme. Uses the shared
// Button so it picks up the same focus ring and disabled handling as every
// other header control.
export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>
      <span>{isDark ? "Light" : "Dark"}</span>
    </Button>
  );
}
