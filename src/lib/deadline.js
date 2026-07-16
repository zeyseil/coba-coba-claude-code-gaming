// Pure conversion between local date+time form inputs and the ISO string stored
// on a task. No React, no storage. No date library — built-in Date only.

function pad(n) {
  return String(n).padStart(2, "0");
}

// Combine a local date ("YYYY-MM-DD") and optional time ("HH:MM") into an ISO
// string. Empty date -> null (no deadline). Empty time -> defaults to 23:59
// local. The numeric Date(...) constructor interprets its arguments in LOCAL
// time (the wall clock the user typed); toISOString() then stores it as UTC, so
// the stored instant matches that local wall clock. We deliberately avoid
// new Date("YYYY-MM-DD"), which parses date-only strings as UTC (a day-shift
// footgun).
export function toISODeadline(dateStr, timeStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "23:59").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

// Format an ISO deadline for display, per spec: date only when the local time is
// 23:59 (the date-only default), date + time otherwise. null -> "". Uses local
// getters so the shown wall clock matches what toISODeadline stored.
export function formatDeadline(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  const date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const hh = dt.getHours();
  const mm = dt.getMinutes();
  if (hh === 23 && mm === 59) return date;
  return `${date} ${pad(hh)}:${pad(mm)}`;
}

// Split an ISO string back into local date + time inputs for prefilling a form.
// null -> both empty. Using the local getters recovers the same wall clock that
// toISODeadline stored, so the round-trip is lossless in any timezone.
export function fromISODeadline(iso) {
  if (!iso) return { date: "", time: "" };
  const dt = new Date(iso);
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}
