// The ONLY module that knows which platform it is running on. Everything to do
// with scheduling, updating, or cancelling OS-level notifications flows through
// here, so the UI and the rest of the app never depend on a platform plugin
// directly (spec Constraints: "UI tidak boleh memanggil Capacitor secara
// langsung" — the same reasoning now covers Tauri).
//
// All functions are async, matching the storage.js convention: today some are
// effectively synchronous, but the plugin surface is promise-based and a future
// migration must not force callers to change.
//
// The scheduling POLICY (which task, at what instant) lives in the pure
// getScheduledReminders in reminder.js and is shared by every platform. This
// file only carries out the plumbing each host needs — it holds no business
// rules of its own, which is why adding the desktop host below required no
// change to reminder.js and none to App.jsx.

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { invoke } from "@tauri-apps/api/core";
import { offsetMsFor, getScheduledReminders } from "./reminder.js";

// Which host is running us. Capacitor (Android) and Tauri (Windows desktop) can
// both hand a reminder to something that outlives the window; a plain browser
// cannot, so it gets no OS notifications at all.
function platform() {
  if (Capacitor.isNativePlatform()) return "capacitor";
  // Tauri v2 injects this onto window before any app code runs. Checking the
  // global rather than calling the API keeps this synchronous and keeps the web
  // build from ever reaching into Tauri.
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    return "tauri";
  }
  return "web";
}

// On the web the in-app "due soon" banner is the fallback (spec Supported
// Platform: "Web (fallback)"), so every function below short-circuits to a
// harmless result there.
export function isSupported() {
  return platform() !== "web";
}

// Ask the OS for notification permission, requesting it once if still
// undecided. Returns one of "granted" | "denied" | "unsupported" so the UI can
// decide whether to show the "open Settings" guidance — the UI never sees a
// plugin type.
export async function ensurePermission() {
  const host = platform();
  if (host === "web") return "unsupported";

  // Windows toasts have no runtime permission prompt: an app either has a
  // registered identity (a Start Menu shortcut, created at install time) or it
  // does not, and nothing the app asks at runtime changes that. So there is
  // nothing to request and nothing that can be denied.
  if (host === "tauri") return "granted";

  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return "granted";
  if (current.display === "denied") return "denied";

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted" ? "granted" : "denied";
}

// Reconcile the host's scheduled notifications with the current tasks. Because
// the reminder offset is global, any change re-derives the whole set, so a full
// replace is the simplest correct strategy on every platform — it satisfies
// every business rule as a side effect rather than through per-action
// bookkeeping:
//   - only unfinished, still-future reminders are produced (getScheduledReminders),
//   - completing / deleting a task drops it from `tasks`, so it is not rescheduled,
//   - changing the offset replaces the old set with a new one,
//   - duplicates are impossible because the old set is always cleared first.
//
// An empty list is therefore a meaningful message, not a no-op: it means
// "cancel everything".
export async function syncNotifications(tasks, offsetValue, now = new Date()) {
  const host = platform();
  if (host === "web") return;

  const reminders = getScheduledReminders(tasks, now, offsetMsFor(offsetValue));

  if (host === "tauri") {
    // Epoch millis, not an ISO string: the Rust side then needs no date parsing
    // at all, so it carries no date library and its only time rule stays an
    // integer comparison.
    await invoke("sync_reminders", {
      reminders: reminders.map(({ task, fireAt }) => ({
        title: task.title,
        fireAt: fireAt.getTime(),
      })),
    });
    return;
  }

  // Capacitor. Notification ids are a plain 1..N sequence: Capacitor needs an
  // integer id and task.id is a UUID, but since the set is fully cancelled and
  // rebuilt every run, ids never need to stay stable across runs — so there is
  // no UUID->int hashing and no risk of hash collisions.
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

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
// was denied and the user must re-grant it by hand. Only Android can reach this:
// ensurePermission never reports "denied" on desktop, so the UI that calls this
// never appears there.
export async function openNotificationSettings() {
  if (platform() !== "capacitor") return;
  await LocalNotifications.openSettings();
}
