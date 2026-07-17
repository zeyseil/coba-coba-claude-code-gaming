// The scheduler's only time rule, deliberately kept apart from Tauri so it can
// be tested without an app handle, a window, or a real clock.
//
// This mirrors the split that already exists on the JS side: reminder.js holds
// the pure policy (which task, at what instant) and notificationService.js does
// the plumbing. Here partition_due is the policy and lib.rs is the plumbing.
//
// Times are epoch milliseconds rather than ISO strings so this side never has to
// parse a date: the JS caller sends fireAt.getTime() and the comparison stays a
// plain integer one. That is the whole reason there is no chrono dependency.

use serde::{Deserialize, Serialize};

// What the tray process needs to know about a reminder, and nothing more. It
// deliberately does not carry the task: the scheduler never needs the id, the
// deadline, the priority or the tags, so the renderer sends only these two
// fields and the task database can stay in localStorage where it already lives.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Reminder {
    pub title: String,
    // camelCase across the IPC boundary to match the JS caller; snake_case here
    // to match Rust. serde bridges the two so neither side has to bend.
    #[serde(rename = "fireAt")]
    pub fire_at: i64,
}

/// Split reminders into (due now, still pending) at `now_ms`.
///
/// The boundary is inclusive: a reminder is due the instant its fire time is
/// reached. This is the mirror image of the `fireAt > now` rule that
/// getScheduledReminders uses to drop already-passed fire times — the same line,
/// read from the other side.
///
/// Fire times that slipped past while the machine was asleep stay due rather
/// than being dropped, so a reminder arrives late instead of never. That matches
/// the allowWhileIdle behaviour the Android build already has, and it is why the
/// caller can get away with polling on an interval instead of holding a timer
/// per reminder.
pub fn partition_due(reminders: Vec<Reminder>, now_ms: i64) -> (Vec<Reminder>, Vec<Reminder>) {
    reminders.into_iter().partition(|r| r.fire_at <= now_ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_000_000;

    fn reminder(title: &str, fire_at: i64) -> Reminder {
        Reminder {
            title: title.to_string(),
            fire_at,
        }
    }

    #[test]
    fn fire_time_in_the_past_is_due() {
        let (due, pending) = partition_due(vec![reminder("Pay rent", NOW - 1)], NOW);
        assert_eq!(due, vec![reminder("Pay rent", NOW - 1)]);
        assert!(pending.is_empty());
    }

    #[test]
    fn fire_time_in_the_future_is_pending() {
        let (due, pending) = partition_due(vec![reminder("Pay rent", NOW + 1)], NOW);
        assert!(due.is_empty());
        assert_eq!(pending, vec![reminder("Pay rent", NOW + 1)]);
    }

    #[test]
    fn the_exact_fire_instant_is_due() {
        let (due, pending) = partition_due(vec![reminder("Pay rent", NOW)], NOW);
        assert_eq!(due.len(), 1);
        assert!(pending.is_empty());
    }

    #[test]
    fn a_long_overdue_fire_time_still_fires_rather_than_being_dropped() {
        // The machine slept through it; late is the intended behaviour.
        let a_week = 7 * 24 * 60 * 60 * 1000;
        let (due, _) = partition_due(vec![reminder("Pay rent", NOW - a_week)], NOW);
        assert_eq!(due.len(), 1);
    }

    #[test]
    fn empty_list_yields_nothing() {
        let (due, pending) = partition_due(vec![], NOW);
        assert!(due.is_empty());
        assert!(pending.is_empty());
    }

    #[test]
    fn mixed_list_is_split_and_order_is_preserved_within_each_half() {
        let (due, pending) = partition_due(
            vec![
                reminder("first due", NOW - 10),
                reminder("first pending", NOW + 10),
                reminder("second due", NOW - 5),
                reminder("second pending", NOW + 20),
            ],
            NOW,
        );
        assert_eq!(
            due.iter().map(|r| r.title.as_str()).collect::<Vec<_>>(),
            vec!["first due", "second due"]
        );
        assert_eq!(
            pending.iter().map(|r| r.title.as_str()).collect::<Vec<_>>(),
            vec!["first pending", "second pending"]
        );
    }

    // Pins the wire format against the JS caller: notificationService.js sends
    // `fireAt`, so a rename on either side must break a test, not a release.
    #[test]
    fn parses_the_camel_case_payload_the_js_side_sends() {
        let parsed: Vec<Reminder> =
            serde_json::from_str(r#"[{"title":"Pay rent","fireAt":1000}]"#).unwrap();
        assert_eq!(parsed, vec![reminder("Pay rent", 1000)]);
    }

    #[test]
    fn round_trips_through_the_cache_file_format() {
        let original = vec![reminder("Pay rent", 1000), reminder("Call mum", 2000)];
        let json = serde_json::to_string(&original).unwrap();
        let parsed: Vec<Reminder> = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, original);
    }
}
