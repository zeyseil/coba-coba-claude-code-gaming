// Reminder engine: pure functions only. No React, no storage access, no
// Notification API — callers pass plain data in and render the result. `now` is
// injected by the caller for the same reason as taskStatus.js: this must stay
// deterministic and testable, and must never call Date.now() itself.
//
// The offset is global (one setting for every task), not per-task, so nothing
// here needs a new field on the Task model — "due soon" is derived entirely
// from the existing task.deadline.
//
// This module is deliberately UI-agnostic. The question it answers — which
// tasks need reminding, and when — is the same question a desktop tray or an
// OS-scheduled mobile notification would ask later, so those can reuse it
// as-is.

// The offset choices, in one place: this drives both the dropdown options and
// the validation in reminderPreference.js, so the list can't drift between the
// two. `ms: null` means reminders are off.
export const REMINDER_OFFSETS = [
  { value: "off", label: "Off", ms: null },
  { value: "1h", label: "1 hour before", ms: 60 * 60 * 1000 },
  { value: "1d", label: "1 day before", ms: 24 * 60 * 60 * 1000 },
  { value: "3d", label: "3 days before", ms: 3 * 24 * 60 * 60 * 1000 },
];

// Look up an offset's milliseconds by its stored value. Unknown values and
// "off" both yield null, which getDueSoonTasks treats as "no reminders".
export function offsetMsFor(value) {
  const option = REMINDER_OFFSETS.find((o) => o.value === value);
  return option ? option.ms : null;
}

// Tasks whose deadline falls inside the reminder window: now <= deadline <=
// now + offsetMs, sorted most-urgent-first.
//
// Overdue tasks are deliberately NOT included. A past deadline already has its
// own indicator (getTaskStatus -> "overdue"), and keeping the two orthogonal
// mirrors how Status and Date stay separate dimensions in the filters: one
// thing, one marker. Completed tasks are never due soon, matching the status
// precedence rule.
export function getDueSoonTasks(tasks, now, offsetMs) {
  if (offsetMs === null) return [];

  const from = now.getTime();
  const until = from + offsetMs;

  return tasks
    .filter((task) => {
      if (task.completed) return false;
      if (!task.deadline) return false;
      const deadline = new Date(task.deadline).getTime();
      return deadline >= from && deadline <= until;
    })
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}

// Which tasks should have an OS-level alarm, and at what instant it should fire:
// fireAt = deadline - offsetMs, i.e. "remind me `offset` before it is due".
//
// This answers a different question from getDueSoonTasks, which is why both
// exist. getDueSoonTasks asks "who is due soon RIGHT NOW" for the in-app banner
// and so keeps looking at `deadline`. This asks "when should the OS wake up",
// which is a moment in the future, and so looks at the fire time instead. The
// two share the same exclusions (completed, no deadline, reminders off) because
// they describe the same user-facing notion of a reminder.
//
// Fire times at or before `now` are dropped: an alarm for a moment that has
// already passed would either fire instantly or be silently ignored by the OS.
// This is the "Reminder lampau" edge case — a task whose deadline is still in
// the future can already be past its fire time (deadline in 10 minutes with a
// 1-hour offset), so this is not the same check as excluding overdue tasks.
export function getScheduledReminders(tasks, now, offsetMs) {
  if (offsetMs === null) return [];

  const from = now.getTime();

  return tasks
    .filter((task) => !task.completed && task.deadline)
    .map((task) => ({
      task,
      fireAt: new Date(new Date(task.deadline).getTime() - offsetMs),
    }))
    .filter(({ fireAt }) => fireAt.getTime() > from)
    .sort((a, b) => a.fireAt - b.fireAt);
}
