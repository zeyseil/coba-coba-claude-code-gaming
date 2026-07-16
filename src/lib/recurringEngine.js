// Recurring Task engine: pure functions only. No React, no storage access —
// callers (App.jsx) read/write via storage.js and pass plain data in/out.
// Kept separate from Calendar per spec §10: Calendar only ever reads task
// instances, it never touches recurrence.

// Add whole months to a Date, clamping the day to the target month's last
// day when it doesn't exist there (e.g. Jan 31 + 1 month -> Feb 28/29, not
// Mar 3). This also handles the leap-year edge case (Feb 29 + 1 year ->
// Feb 28 on a non-leap year) since addYears is addMonths(date, years * 12).
function addMonthsClamped(date, months) {
  const targetMonthIndex = date.getMonth() + months;
  const first = new Date(date.getFullYear(), targetMonthIndex, 1);
  const lastDayOfTargetMonth = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0
  ).getDate();
  const day = Math.min(date.getDate(), lastDayOfTargetMonth);
  return new Date(
    first.getFullYear(),
    first.getMonth(),
    day,
    date.getHours(),
    date.getMinutes()
  );
}

// Compute the next occurrence's deadline from the previous instance's
// deadline (not from "now" and not from the template's original startDate),
// so the schedule doesn't drift if a user manually edits an instance's
// deadline. Generation only ever happens on Complete (event-driven), so
// there is no catch-up logic for missed periods while the app was closed.
export function computeNextDeadline(previousDeadlineISO, recurrence) {
  const prev = new Date(previousDeadlineISO);
  const { frequency, interval } = recurrence;

  let next;
  switch (frequency) {
    case "daily":
      next = new Date(
        prev.getFullYear(),
        prev.getMonth(),
        prev.getDate() + interval,
        prev.getHours(),
        prev.getMinutes()
      );
      break;
    case "weekly":
      next = new Date(
        prev.getFullYear(),
        prev.getMonth(),
        prev.getDate() + interval * 7,
        prev.getHours(),
        prev.getMinutes()
      );
      break;
    case "monthly":
      next = addMonthsClamped(prev, interval);
      break;
    case "yearly":
      next = addMonthsClamped(prev, interval * 12);
      break;
    default:
      throw new Error(`Unknown recurrence frequency: ${frequency}`);
  }

  return next.toISOString();
}

// Build a createTask() input from a template + a computed deadline. Instance
// inherits title/priority/tags/folderId from the template (spec decision:
// full inheritance, not title-only) and is tagged with templateId so it
// renders with the "Recurring" badge and can be traced back to its template.
export function buildInstanceFromTemplate(template, deadlineISO) {
  return {
    title: template.title,
    priority: template.priority,
    deadline: deadlineISO,
    tags: template.tags,
    folderId: template.folderId,
    templateId: template.id,
  };
}
