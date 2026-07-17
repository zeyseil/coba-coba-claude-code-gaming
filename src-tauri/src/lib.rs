// The desktop shell: tray, IPC, and the loop that actually fires reminders.
//
// Why this exists at all: the in-app "due soon" banner only shows while the app
// is open, and the Capacitor notifications only exist on Android. On Windows the
// app must keep an eye on the clock after its window is gone, and only a process
// outside the webview can do that.
//
// What lives here is plumbing only. The one time rule — which reminders have
// come due — is in scheduler.rs, apart from Tauri so it can be tested. The rule
// deciding which task deserves a reminder at all is further out still, in the
// JS getScheduledReminders, shared with Android.
//
// Notably absent: the task database. This process is told what to say and when,
// and needs nothing else, so tasks stay in localStorage where they already are.

mod autostart;
mod scheduler;

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use scheduler::{partition_due, Reminder};
use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, State, WindowEvent, Wry};
use tauri_plugin_notification::NotificationExt;

// How often the tray wakes up to look for reminders that have come due.
//
// A poll rather than one timer per reminder, for three reasons that all point
// the same way: a timer set hours ahead is lost when the machine sleeps, it
// drifts when the clock or timezone changes, and it silently misfires past the
// ~24-day ceiling most timer APIs carry. A poll just notices on its next tick.
// Reminders are set an hour or more ahead, so 30s of slop is imperceptible.
const TICK: Duration = Duration::from_secs(30);

// The argument autostart passes so we know to start in the tray with no window.
const HIDDEN_FLAG: &str = "--hidden";

// Everything the tray knows. Not tasks, not folders — just what to say and when.
// Mutex because two things touch it: the IPC command (when the user changes
// anything) and the ticker thread (every 30s).
struct AppState {
    reminders: Mutex<Vec<Reminder>>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        // A clock set before 1970 is the only way this fails. Treating it as the
        // epoch means every reminder reads as due and fires now, which is noisy
        // but honest — better than silently dropping the lot.
        .unwrap_or(0)
}

fn cache_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("reminders.json"))
}

// The reminders owed from the last session.
//
// A missing or unreadable cache is normal, not an error — it just means nothing
// is owed yet. This mirrors readState() in storage.js, which also treats a
// corrupt payload as "start empty" rather than crashing, and which likewise
// never overwrites bad data on read: the next sync replaces it wholesale.
fn read_cache(app: &AppHandle) -> Vec<Reminder> {
    let Ok(path) = cache_path(app) else {
        return Vec::new();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_cache(app: &AppHandle, reminders: &[Reminder]) -> Result<(), String> {
    let path = cache_path(app)?;
    let json = serde_json::to_string(reminders).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

// The renderer's whole side of the contract: "here is the complete set of
// reminders you owe from now on". It is called on every task change, so the set
// is always rebuilt rather than patched — the same reasoning as the cancel-all-
// then-reschedule-all on Android. An empty list is a real message: cancel
// everything.
#[tauri::command]
fn sync_reminders(
    app: AppHandle,
    state: State<AppState>,
    reminders: Vec<Reminder>,
) -> Result<(), String> {
    *state.reminders.lock().unwrap() = reminders.clone();
    write_cache(&app, &reminders)
}

// Fire whatever has come due, keep the rest. Runs every TICK.
fn fire_due(app: &AppHandle) {
    let state = app.state::<AppState>();

    let due = {
        let mut owed = state.reminders.lock().unwrap();
        // mem::take swaps the vec out for an empty one and hands us ownership,
        // which partition_due needs. The lock is held across the split (it is
        // pure and instant) but released before any notification is shown, so a
        // sync_reminders arriving mid-tick never waits on the OS.
        let (due, pending) = partition_due(std::mem::take(&mut *owed), now_ms());
        *owed = pending;
        due
    };

    if due.is_empty() {
        return;
    }

    for reminder in &due {
        // Wording identical to the Android notification on purpose: same app,
        // same event, so it should read the same on either device.
        let _ = app
            .notification()
            .builder()
            .title("Task due soon")
            .body(&reminder.title)
            .show();
    }

    // Persist the shrunken set so a fired reminder does not come back after a
    // restart. Re-reading the state rather than reusing `pending` from above is
    // deliberate: a sync_reminders may have landed while we were talking to the
    // OS, and if so its set is the newer truth.
    let pending = state.reminders.lock().unwrap().clone();
    let _ = write_cache(app, &pending);
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn toggle_autostart(item: &CheckMenuItem<Wry>) {
    let result = if autostart::is_enabled() {
        autostart::disable()
    } else {
        match std::env::current_exe() {
            Ok(exe) => autostart::enable(&exe, HIDDEN_FLAG),
            Err(e) => Err(e),
        }
    };

    if let Err(e) = result {
        eprintln!("autostart toggle failed: {e}");
    }

    // Read the registry back instead of trusting the toggle. A CheckMenuItem
    // flips its own tick the moment it is clicked, so if the write failed the
    // menu would claim a setting that is not there — and a checkbox that lies is
    // worse than no checkbox.
    let _ = item.set_checked(autostart::is_enabled());
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let handle = app.handle();

    let open = MenuItem::with_id(handle, "open", "Open", true, None::<&str>)?;
    let autostart_item = CheckMenuItem::with_id(
        handle,
        "autostart",
        "Start with Windows",
        true,
        autostart::is_enabled(),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(handle, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(handle, &[&open, &autostart_item, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("To-Do List Modern")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => show_main_window(app),
            "autostart" => toggle_autostart(&autostart_item),
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Autostart can race a manual launch. A second copy would own its
            // own reminder set and fire everything twice, so the newcomer hands
            // over to the instance already running.
            show_main_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            reminders: Mutex::new(Vec::new()),
        })
        .invoke_handler(tauri::generate_handler![sync_reminders])
        .setup(|app| {
            let handle = app.handle().clone();

            // Start from what we owed last time. The renderer will replace this
            // the moment it loads, but until then — and on a boot where the user
            // never opens the window at all — this is the only thing standing
            // between them and a missed reminder.
            *app.state::<AppState>().reminders.lock().unwrap() = read_cache(&handle);

            build_tray(app)?;

            // A plain OS thread that sleeps, not an async task: there is no
            // other async work here, and this way the app carries no runtime.
            let ticker_handle = handle.clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(TICK);
                fire_due(&ticker_handle);
            });

            if std::env::args().any(|arg| arg == HIDDEN_FLAG) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Closing must not quit — the entire point of this wrapper is
                // that reminders outlive the window. Quit lives in the tray menu,
                // which is the only place it can be asked for unambiguously.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
