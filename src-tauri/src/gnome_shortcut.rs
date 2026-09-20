//! Quick-translate hotkey registration on GNOME.
//!
//! Under Wayland an application cannot grab a key for itself: global-hotkey
//! uses X11 `XGrabKey`, and Xwayland only receives key events while an X11
//! window has focus, so with any Wayland-native app focused the shortcut never
//! fires. GNOME 46 has no `org.freedesktop.portal.GlobalShortcuts` either.
//!
//! GNOME's own custom keybindings do work in both session types, so in a
//! Wayland session we register one that runs `<exe> --quick-translate`; the
//! single-instance plugin hands that to the running app.
//!
//! In an X11 session the app keeps its own grab, which is faster and needs no
//! desktop support — so the entry is removed again there. Leaving it would make
//! gnome-shell own the key and the app's `XGrabKey` fail with `BadAccess`.
//!
//! PARITY: mirrored by `electron/gnomeShortcut.js`.

use gio::prelude::{SettingsExt, SettingsExtManual};
use gio::{Settings, SettingsSchemaSource};

const MEDIA_KEYS_SCHEMA: &str = "org.gnome.settings-daemon.plugins.media-keys";
const CUSTOM_KEYBINDING_SCHEMA: &str =
    "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding";
const CUSTOM_KEYBINDINGS_KEY: &str = "custom-keybindings";

/// Our own dconf path — deliberately not `customN`, which GNOME Settings hands
/// out by index and would collide with entries the user creates. A debug build
/// uses its own path so running `tauri dev` cannot repoint the installed app's
/// shortcut at a binary in `target/debug`.
#[cfg(debug_assertions)]
pub const ENTRY_PATH: &str =
    "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/lighttranslator-dev/";
#[cfg(not(debug_assertions))]
pub const ENTRY_PATH: &str =
    "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/lighttranslator/";

#[cfg(debug_assertions)]
const ENTRY_NAME: &str = "LightTranslator (dev) — Quick Translate";
#[cfg(not(debug_assertions))]
const ENTRY_NAME: &str = "LightTranslator — Quick Translate";

/// `CommandOrControl+Shift+X` in GTK spelling; matches the app's default and
/// what `utils/shortcutUtils.ts` produces for it.
pub const DEFAULT_BINDING: &str = "<Shift><Control>x";

/// Argument that tells a second instance to trigger quick translate.
pub const TRIGGER_ARG: &str = "--quick-translate";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionKind {
    X11,
    Wayland,
}

/// How the hotkey reaches the app in this session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mechanism {
    /// The app grabs the key itself through the X server (X11 sessions).
    X11Grab,
    /// GNOME owns the key and runs our command (Wayland on GNOME).
    Gnome,
    /// Wayland without a way to register: the user has to bind the command.
    Manual,
}

impl Mechanism {
    pub fn as_str(self) -> &'static str {
        match self {
            Mechanism::X11Grab => "x11-grab",
            Mechanism::Gnome => "gnome",
            Mechanism::Manual => "manual",
        }
    }
}

pub fn session_kind() -> SessionKind {
    let session = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
    if session.eq_ignore_ascii_case("wayland")
        || (session.is_empty() && std::env::var_os("WAYLAND_DISPLAY").is_some())
    {
        SessionKind::Wayland
    } else {
        SessionKind::X11
    }
}

pub fn session_kind_str() -> &'static str {
    match session_kind() {
        SessionKind::Wayland => "wayland",
        SessionKind::X11 => "x11",
    }
}

/// GNOME, or a desktop built on gnome-settings-daemon (Ubuntu, Budgie…).
pub fn is_gnome() -> bool {
    std::env::var("XDG_CURRENT_DESKTOP")
        .unwrap_or_default()
        .split(':')
        .any(|desktop| desktop.eq_ignore_ascii_case("GNOME"))
}

/// `Settings::new` aborts the process when a schema is missing, so every
/// lookup goes through here first.
pub fn schema_installed(id: &str) -> bool {
    SettingsSchemaSource::default()
        .and_then(|source| source.lookup(id, true))
        .is_some()
}

pub fn keybindings_available() -> bool {
    is_gnome() && schema_installed(MEDIA_KEYS_SCHEMA) && schema_installed(CUSTOM_KEYBINDING_SCHEMA)
}

pub fn mechanism() -> Mechanism {
    match session_kind() {
        SessionKind::X11 => Mechanism::X11Grab,
        SessionKind::Wayland if keybindings_available() => Mechanism::Gnome,
        SessionKind::Wayland => Mechanism::Manual,
    }
}

/// Single-quote for `g_shell_parse_argv`, which is what gnome-settings-daemon
/// eventually runs the command through.
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

/// The command GNOME (or the user, on another desktop) should run.
pub fn trigger_command() -> String {
    // An AppImage's `current_exe` points inside the temporary mount, which is
    // gone by the next launch; $APPIMAGE is the file the user keeps.
    let exe = std::env::var("APPIMAGE")
        .ok()
        .filter(|path| !path.is_empty())
        .or_else(|| {
            std::env::current_exe()
                .ok()
                .map(|path| path.to_string_lossy().into_owned())
        })
        .unwrap_or_else(|| "lighttranslator".to_string());

    format!("{} {}", shell_quote(&exe), TRIGGER_ARG)
}

fn media_keys_settings() -> Result<Settings, String> {
    if !schema_installed(MEDIA_KEYS_SCHEMA) {
        return Err("GNOME media-keys settings are not installed".to_string());
    }
    Ok(Settings::new(MEDIA_KEYS_SCHEMA))
}

fn entry_settings() -> Result<Settings, String> {
    if !schema_installed(CUSTOM_KEYBINDING_SCHEMA) {
        return Err("GNOME custom-keybinding schema is not installed".to_string());
    }
    Ok(Settings::with_path(CUSTOM_KEYBINDING_SCHEMA, ENTRY_PATH))
}

fn paths(settings: &Settings) -> Vec<String> {
    settings
        .strv(CUSTOM_KEYBINDINGS_KEY)
        .iter()
        .map(|path| path.to_string())
        .collect()
}

/// Returns the new list, or None when `path` is already there.
fn list_with(list: &[String], path: &str) -> Option<Vec<String>> {
    if list.iter().any(|entry| entry == path) {
        return None;
    }
    let mut next = list.to_vec();
    next.push(path.to_string());
    Some(next)
}

/// Returns the new list, or None when `path` is not there.
fn list_without(list: &[String], path: &str) -> Option<Vec<String>> {
    if !list.iter().any(|entry| entry == path) {
        return None;
    }
    Some(
        list.iter()
            .filter(|entry| entry.as_str() != path)
            .cloned()
            .collect(),
    )
}

fn write_paths(settings: &Settings, list: &[String]) -> Result<(), String> {
    let refs: Vec<&str> = list.iter().map(|path| path.as_str()).collect();
    settings
        .set_strv(CUSTOM_KEYBINDINGS_KEY, refs.as_slice())
        .map_err(|e| format!("Failed to update GNOME custom shortcuts: {}", e))
}

/// Create or refresh our entry. `binding` in GTK spelling
/// (`<Shift><Control>x`); None keeps whatever the entry already has, which is
/// how startup refreshes the command path without overwriting the accelerator.
pub fn ensure_entry(binding: Option<&str>) -> Result<(), String> {
    let entry = entry_settings()?;

    entry
        .set_string("name", ENTRY_NAME)
        .map_err(|e| format!("Failed to name the GNOME shortcut: {}", e))?;
    entry
        .set_string("command", &trigger_command())
        .map_err(|e| format!("Failed to set the GNOME shortcut command: {}", e))?;

    match binding {
        Some(binding) => entry
            .set_string("binding", binding)
            .map_err(|e| format!("Failed to set the GNOME shortcut keys: {}", e))?,
        // A brand new entry still needs an accelerator to be of any use.
        None if entry.string("binding").is_empty() => entry
            .set_string("binding", DEFAULT_BINDING)
            .map_err(|e| format!("Failed to set the GNOME shortcut keys: {}", e))?,
        None => {}
    }

    // Add our path only after the entry itself is complete, so
    // gnome-settings-daemon never sees a half-written shortcut.
    let media_keys = media_keys_settings()?;
    if let Some(next) = list_with(&paths(&media_keys), ENTRY_PATH) {
        write_paths(&media_keys, &next)?;
    }

    Settings::sync();
    Ok(())
}

/// Take our entry out again (X11 sessions, where the app grabs the key itself).
/// Returns true when something was actually removed.
pub fn remove_entry() -> Result<bool, String> {
    if !keybindings_available() {
        return Ok(false);
    }

    let media_keys = media_keys_settings()?;
    let removed = match list_without(&paths(&media_keys), ENTRY_PATH) {
        Some(next) => {
            write_paths(&media_keys, &next)?;
            true
        }
        None => false,
    };

    if removed {
        if let Ok(entry) = entry_settings() {
            entry.reset("binding");
            entry.reset("command");
            entry.reset("name");
        }
    }

    Settings::sync();
    Ok(removed)
}

/// The accelerator GNOME currently has for us, if any.
pub fn current_binding() -> Option<String> {
    if !keybindings_available() {
        return None;
    }
    let media_keys = media_keys_settings().ok()?;
    if !paths(&media_keys).iter().any(|path| path == ENTRY_PATH) {
        return None;
    }
    let binding = entry_settings().ok()?.string("binding").to_string();
    (!binding.is_empty()).then_some(binding)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Reading a key a schema does not declare aborts the process rather than
    /// returning an error, and `accent-color` is exactly that on GNOME 46. If
    /// the guard in `get_system_appearance` ever regresses, this test does not
    /// fail — it takes the whole runner down, which is the signal.
    #[test]
    fn interface_schema_reads_are_guarded() {
        const SCHEMA: &str = "org.gnome.desktop.interface";
        if !schema_installed(SCHEMA) {
            return; // headless builder, nothing to assert
        }
        let settings = Settings::new(SCHEMA);
        let schema = settings.settings_schema().expect("schema present");
        // color-scheme has existed since GNOME 42; accent-color only from 47.
        assert!(schema.has_key("color-scheme"));
        for key in ["color-scheme", "accent-color", "gtk-theme"] {
            if schema.has_key(key) {
                let _ = settings.string(key);
            }
        }
    }

    #[test]
    fn quotes_paths_for_the_shell() {
        assert_eq!(shell_quote("/usr/bin/lighttranslator"), "'/usr/bin/lighttranslator'");
        assert_eq!(shell_quote("/opt/My App/lt"), "'/opt/My App/lt'");
        assert_eq!(shell_quote("/tmp/it's"), "'/tmp/it'\\''s'");
    }

    #[test]
    fn adds_our_path_once() {
        let existing = vec!["/org/gnome/.../custom0/".to_string()];
        let next = list_with(&existing, ENTRY_PATH).expect("should add");
        assert_eq!(next.len(), 2);
        assert_eq!(next[0], existing[0], "other entries keep their order");
        assert_eq!(next[1], ENTRY_PATH);
        assert!(list_with(&next, ENTRY_PATH).is_none(), "already present");
    }

    #[test]
    fn removes_only_our_path() {
        let existing = vec![
            "/org/gnome/.../custom0/".to_string(),
            ENTRY_PATH.to_string(),
            "/org/gnome/.../custom1/".to_string(),
        ];
        let next = list_without(&existing, ENTRY_PATH).expect("should remove");
        assert_eq!(next, vec![existing[0].clone(), existing[2].clone()]);
        assert!(list_without(&next, ENTRY_PATH).is_none(), "already absent");
    }

    #[test]
    fn trigger_command_carries_the_flag() {
        let command = trigger_command();
        assert!(command.ends_with(TRIGGER_ARG), "got {command}");
        assert!(command.starts_with('\''), "path must be quoted: {command}");
    }
}
