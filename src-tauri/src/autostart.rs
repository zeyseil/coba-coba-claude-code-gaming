// Windows logon autostart, written by hand rather than through
// tauri-plugin-autostart.
//
// The plugin (and the auto-launch crate under it) builds the registry value as
// `format!("{} {}", app_path, args)` with no quoting at all. Windows parses an
// unquoted Run value by splitting at the first space, so on this machine
//
//     C:\Users\M Sulthon R\AppData\Local\To-Do List Modern\app.exe --hidden
//
// was read as "run C:\Users\M with the arguments Sulthon R\AppData\...". The
// entry looked fine in the tray (the value was there, so is_enabled reported
// true) but at logon Windows tried to launch a path that is not this app, and
// the reminder process silently never came up. Both the user's name and the
// install directory contain spaces, so there was no way to dodge it.
//
// Passing an already-quoted path into the crate would also work, but only by
// relying on it never learning to quote — a fix upstream would then produce
// doubled quotes. Writing the three registry operations here is both shorter to
// reason about and honest about what it does.
//
// This module is Windows-only, which is the only platform this wrapper targets.

use std::path::Path;

use winreg::enums::RegType::REG_BINARY;
use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE};
use winreg::{RegKey, RegValue};

const RUN_KEY: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";

// Task Manager's "Startup apps" tab keeps its own enabled/disabled flag beside
// the Run key, and a disabled flag wins over the Run value being present. So
// enabling has to clear it, or the app would claim autostart is on while Task
// Manager quietly overrides it.
const STARTUP_APPROVED_KEY: &str =
    r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

// Byte 0 is the state (2 = enabled, 3 = disabled); the last 8 bytes are the
// timestamp of when it was disabled, and are zero while it is enabled.
const APPROVED_ENABLED: [u8; 12] = [0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// The Run value name, which is also what Task Manager lists it under. Kept the
// same string the previous plugin used so that a stale, broken entry from before
// this fix is overwritten rather than left behind next to a new one.
const VALUE_NAME: &str = "To-Do List Modern";

/// The exact command Windows should run at logon.
///
/// The quotes are the entire point of this function: without them Windows stops
/// reading the executable path at the first space.
pub fn run_command(exe: &Path, arg: &str) -> String {
    format!("\"{}\" {}", exe.display(), arg)
}

pub fn enable(exe: &Path, arg: &str) -> std::io::Result<()> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let (run, _) = hkcu.create_subkey_with_flags(RUN_KEY, KEY_SET_VALUE)?;
    run.set_value(VALUE_NAME, &run_command(exe, arg))?;

    let (approved, _) = hkcu.create_subkey_with_flags(STARTUP_APPROVED_KEY, KEY_SET_VALUE)?;
    approved.set_raw_value(
        VALUE_NAME,
        &RegValue {
            vtype: REG_BINARY,
            bytes: APPROVED_ENABLED.to_vec(),
        },
    )?;

    Ok(())
}

pub fn disable() -> std::io::Result<()> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (run, _) = hkcu.create_subkey_with_flags(RUN_KEY, KEY_SET_VALUE)?;

    // Already gone is the state we wanted, not a failure.
    match run.delete_value(VALUE_NAME) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
}

/// Whether Windows will actually start this app at logon.
///
/// Both halves must agree: the Run value has to exist AND Task Manager must not
/// have overridden it. Reporting only on the Run value would let the tray show a
/// tick for something Task Manager has switched off.
pub fn is_enabled() -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let has_run_value = hkcu
        .open_subkey_with_flags(RUN_KEY, KEY_READ)
        .and_then(|k| k.get_value::<String, _>(VALUE_NAME))
        .is_ok();
    if !has_run_value {
        return false;
    }

    match hkcu
        .open_subkey_with_flags(STARTUP_APPROVED_KEY, KEY_READ)
        .and_then(|k| k.get_raw_value(VALUE_NAME))
    {
        // No override recorded means Task Manager has never touched it.
        Err(_) => true,
        Ok(value) => approved_bytes_mean_enabled(&value.bytes),
    }
}

fn approved_bytes_mean_enabled(bytes: &[u8]) -> bool {
    if bytes.len() < 12 {
        return true; // Unrecognised shape; trust the Run value rather than guess.
    }
    bytes.iter().rev().take(8).all(|b| *b == 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    // The regression this module exists for. Both the user directory and the
    // install directory contain spaces, and the old code produced
    // `C:\Users\M Sulthon R\...\app.exe --hidden`, which Windows read as
    // `C:\Users\M`.
    #[test]
    fn wraps_a_path_containing_spaces_in_quotes() {
        let exe = Path::new(r"C:\Users\M Sulthon R\AppData\Local\To-Do List Modern\app.exe");
        assert_eq!(
            run_command(exe, "--hidden"),
            r#""C:\Users\M Sulthon R\AppData\Local\To-Do List Modern\app.exe" --hidden"#
        );
    }

    // What Windows actually does with the value: read the executable up to the
    // closing quote. Spelling it out here so the reason for the quotes cannot be
    // "tidied away" by someone who does not know this history.
    #[test]
    fn windows_reads_the_whole_path_as_the_executable() {
        let exe = Path::new(r"C:\Users\M Sulthon R\app.exe");
        let command = run_command(exe, "--hidden");

        let executable = command
            .strip_prefix('"')
            .and_then(|rest| rest.split('"').next())
            .unwrap();

        assert_eq!(executable, r"C:\Users\M Sulthon R\app.exe");
        assert_ne!(executable, r"C:\Users\M");
    }

    #[test]
    fn a_path_without_spaces_is_quoted_too() {
        // No special case: quoting always, so there is one code path to trust.
        assert_eq!(
            run_command(Path::new(r"C:\app.exe"), "--hidden"),
            r#""C:\app.exe" --hidden"#
        );
    }

    #[test]
    fn all_zero_tail_means_task_manager_left_it_enabled() {
        assert!(approved_bytes_mean_enabled(&[
            0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        ]));
    }

    #[test]
    fn a_timestamp_in_the_tail_means_task_manager_disabled_it() {
        assert!(!approved_bytes_mean_enabled(&[
            0x03, 0, 0, 0, 0x9a, 0x1c, 0x2d, 0x3e, 0x4f, 0x5a, 0x6b, 0x7c
        ]));
    }
}
