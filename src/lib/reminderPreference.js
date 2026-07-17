// Reminder-offset preference persistence, isolated in one place — the same
// pattern as sortPreference.js / theme.js. This is a UI preference, so it does
// NOT go through storage.js (that module owns task DATA); components never
// touch localStorage directly. Valid values come from REMINDER_OFFSETS so the
// option list lives in exactly one file.

import { REMINDER_OFFSETS } from "./reminder.js";

const STORAGE_KEY = "reminderOffset";
const VALID_VALUES = REMINDER_OFFSETS.map((o) => o.value);
const DEFAULT_VALUE = "off";

// Read the stored offset, falling back to "off" when nothing valid is saved.
export function getStoredReminderOffset() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (VALID_VALUES.includes(stored)) return stored;
  } catch (e) {
    /* ignore: storage unavailable */
  }
  return DEFAULT_VALUE;
}

// Persist the user's choice.
export function setStoredReminderOffset(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch (e) {
    /* ignore: storage unavailable */
  }
}
