// The ONLY module allowed to import Capacitor. Everything to do with scheduling,
// updating, or cancelling OS-level notifications flows through here, so the UI
// and the rest of the app never depend on the platform plugin directly (spec
// Constraints: "UI tidak boleh memanggil Capacitor secara langsung").
//
// All functions are async, matching the storage.js convention: today some are
// effectively synchronous, but the plugin surface is promise-based and a future
// migration must not force callers to change.
//
// The scheduling POLICY (which task, at what instant) lives in the pure
// getScheduledReminders in reminder.js. This file only carries out the plumbing
// the OS needs — it holds no business rules of its own.

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { offsetMsFor, getScheduledReminders } from "./reminder.js";

// Notifications only exist on a real device. On the web the in-app "due soon"
// banner is the fallback (spec Supported Platform: "Web (fallback)"), so every
// function below short-circuits to a harmless result off-device.
export function isSupported() {
  return Capacitor.isNativePlatform();
}

// Ask the OS for notification permission, requesting it once if still
// undecided. Returns one of "granted" | "denied" | "unsupported" so the UI can
// decide whether to show the "open Settings" guidance — the UI never sees a
// Capacitor type.
export async function ensurePermission() {
  if (!isSupported()) return "unsupported";

  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return "granted";
  if (current.display === "denied") return "denied";

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted" ? "granted" : "denied";
}

// Reconcile the OS's scheduled notifications with the current tasks: cancel
// every pending one, then schedule the fresh set. Because the reminder offset
// is global, any change re-derives the whole set, so a full cancel + reschedule
// is the simplest correct strategy — it satisfies every business rule as a
// side effect rather than through per-action bookkeeping:
//   - only unfinished, still-future reminders are produced (getScheduledReminders),
//   - completing / deleting a task drops it from `tasks`, so it is not rescheduled,
//   - changing the offset cancels the old set and builds a new one,
//   - duplicates are impossible because the old set is always cleared first.
//
// Notification ids are a plain 1..N sequence. Capacitor needs an integer id and
// task.id is a UUID, but since the set is fully cancelled and rebuilt every run,
// ids never need to stay stable across runs — so there is no UUID->int hashing
// and no risk of hash collisions.
export async function syncNotifications(tasks, offsetValue, now = new Date()) {
  if (!isSupported()) return;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  const reminders = getScheduledReminders(tasks, now, offsetMsFor(offsetValue));
  if (reminders.length === 0) return;

  await LocalNotifications.schedule({
    notifications: reminders.map(({ task, fireAt }, index) => ({
      id: index + 1,
      title: "Task due soon",
      body: task.title,
      // allowWhileIdle maps to setExactAndAllowWhileIdle() on Android so the
      // alarm still fires under Doze (Architecture Notes: Android).
      schedule: { at: fireAt, allowWhileIdle: true },
    })),
  });
}

// Deep-link to the OS notification settings for this app, used when permission
// was denied and the user must re-grant it by hand.
export async function openNotificationSettings() {
  if (!isSupported()) return;
  await LocalNotifications.openSettings();
}
