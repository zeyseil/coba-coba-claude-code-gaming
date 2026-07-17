import { describe, it, expect } from "vitest";
import {
  REMINDER_OFFSETS,
  offsetMsFor,
  getDueSoonTasks,
  getScheduledReminders,
} from "./reminder.js";

// A fixed "now" so every case is deterministic; the engine never reads the clock
// itself. 2026-07-17 12:00 local.
const NOW = new Date(2026, 6, 17, 12, 0, 0);
const ONE_HOUR = 60 * 60 * 1000;

// Minimal task shape — only the fields the engine reads.
function task(overrides) {
  return { completed: false, deadline: null, ...overrides };
}

// Build an ISO deadline offsetMs milliseconds from NOW.
function deadlineFromNow(offsetMs) {
  return new Date(NOW.getTime() + offsetMs).toISOString();
}

describe("offsetMsFor", () => {
  it("resolves a known value to its milliseconds", () => {
    expect(offsetMsFor("1h")).toBe(ONE_HOUR);
  });

  it("returns null for 'off' and for unknown values", () => {
    expect(offsetMsFor("off")).toBeNull();
    expect(offsetMsFor("nonsense")).toBeNull();
  });

  it("keeps every REMINDER_OFFSETS entry resolvable", () => {
    for (const option of REMINDER_OFFSETS) {
      expect(offsetMsFor(option.value)).toBe(option.ms);
    }
  });
});

describe("getDueSoonTasks", () => {
  it("returns [] when the offset is null (reminders off)", () => {
    const tasks = [task({ deadline: deadlineFromNow(ONE_HOUR / 2) })];
    expect(getDueSoonTasks(tasks, NOW, null)).toEqual([]);
  });

  it("returns [] for an empty task list", () => {
    expect(getDueSoonTasks([], NOW, ONE_HOUR)).toEqual([]);
  });

  it("includes a deadline exactly at now (window start, inclusive)", () => {
    const t = task({ deadline: deadlineFromNow(0) });
    expect(getDueSoonTasks([t], NOW, ONE_HOUR)).toEqual([t]);
  });

  it("includes a deadline exactly at now + offset (window end, inclusive)", () => {
    const t = task({ deadline: deadlineFromNow(ONE_HOUR) });
    expect(getDueSoonTasks([t], NOW, ONE_HOUR)).toEqual([t]);
  });

  it("excludes a deadline just past the window", () => {
    const t = task({ deadline: deadlineFromNow(ONE_HOUR + 1000) });
    expect(getDueSoonTasks([t], NOW, ONE_HOUR)).toEqual([]);
  });

  it("excludes overdue tasks (deadline before now)", () => {
    const t = task({ deadline: deadlineFromNow(-1000) });
    expect(getDueSoonTasks([t], NOW, ONE_HOUR)).toEqual([]);
  });

  it("excludes completed tasks even inside the window", () => {
    const t = task({ completed: true, deadline: deadlineFromNow(ONE_HOUR / 2) });
    expect(getDueSoonTasks([t], NOW, ONE_HOUR)).toEqual([]);
  });

  it("excludes tasks without a deadline", () => {
    const t = task({ deadline: null });
    expect(getDueSoonTasks([t], NOW, ONE_HOUR)).toEqual([]);
  });

  it("sorts results most-urgent-first by deadline", () => {
    const later = task({ deadline: deadlineFromNow(ONE_HOUR) });
    const sooner = task({ deadline: deadlineFromNow(ONE_HOUR / 4) });
    expect(getDueSoonTasks([later, sooner], NOW, ONE_HOUR)).toEqual([
      sooner,
      later,
    ]);
  });
});

describe("getScheduledReminders", () => {
  it("returns [] when the offset is null (reminders off)", () => {
    const tasks = [task({ deadline: deadlineFromNow(2 * ONE_HOUR) })];
    expect(getScheduledReminders(tasks, NOW, null)).toEqual([]);
  });

  it("computes fireAt as deadline minus the offset", () => {
    // Deadline 2h out, remind 1h before -> fire 1h from now.
    const t = task({ deadline: deadlineFromNow(2 * ONE_HOUR) });
    const result = getScheduledReminders([t], NOW, ONE_HOUR);
    expect(result).toHaveLength(1);
    expect(result[0].task).toBe(t);
    expect(result[0].fireAt.getTime()).toBe(NOW.getTime() + ONE_HOUR);
  });

  it("drops a reminder whose fire time has already passed", () => {
    // Deadline 10 min out with a 1h offset -> fire time is 50 min in the past.
    // The task is NOT overdue, but its reminder is: still excluded.
    const t = task({ deadline: deadlineFromNow(10 * 60 * 1000) });
    expect(getScheduledReminders([t], NOW, ONE_HOUR)).toEqual([]);
  });

  it("excludes completed tasks", () => {
    const t = task({ completed: true, deadline: deadlineFromNow(2 * ONE_HOUR) });
    expect(getScheduledReminders([t], NOW, ONE_HOUR)).toEqual([]);
  });

  it("excludes tasks without a deadline", () => {
    const t = task({ deadline: null });
    expect(getScheduledReminders([t], NOW, ONE_HOUR)).toEqual([]);
  });

  it("sorts results earliest-fire-first", () => {
    const later = task({ deadline: deadlineFromNow(4 * ONE_HOUR) });
    const sooner = task({ deadline: deadlineFromNow(2 * ONE_HOUR) });
    const result = getScheduledReminders([later, sooner], NOW, ONE_HOUR);
    expect(result.map((r) => r.task)).toEqual([sooner, later]);
  });
});
