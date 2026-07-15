// Theme persistence, isolated in one place. Values: "light" | "dark".

const STORAGE_KEY = "theme";

// Read the stored theme, falling back to the OS preference when nothing is saved.
export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch (e) {
    /* ignore: storage unavailable */
  }
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

// Persist the user's choice.
export function setStoredTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    /* ignore: storage unavailable */
  }
}

// Reflect the theme onto the document by toggling the `.dark` class.
export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}
