// Sort preference persistence, isolated in one place — the same pattern as
// theme.js. This is a UI preference, so it does NOT go through storage.js (that
// module owns task DATA); components never touch localStorage directly.
// Values: "manual" | "priority" | "deadline".

const STORAGE_KEY = "sortBy";
const SORT_OPTIONS = ["manual", "priority", "deadline"];

// Read the stored sort, falling back to "manual" when nothing valid is saved.
export function getStoredSort() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (SORT_OPTIONS.includes(stored)) return stored;
  } catch (e) {
    /* ignore: storage unavailable */
  }
  return "manual";
}

// Persist the user's choice.
export function setStoredSort(sortBy) {
  try {
    localStorage.setItem(STORAGE_KEY, sortBy);
  } catch (e) {
    /* ignore: storage unavailable */
  }
}
