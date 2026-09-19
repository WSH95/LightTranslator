//! Installs and enables the little GNOME Shell extension that places the
//! quick-translate popup at the pointer (see `gnome-extension/`).
//!
//! The package already drops the extension into
//! `/usr/share/gnome-shell/extensions/`, so this mostly just enables it for the
//! current user, once. It also handles the cases where the packaged copy is
//! absent or stale — an AppImage, a dev run, or an upgrade — by writing a copy
//! into the user's own extension directory.
//!
//! Auto-enabling happens exactly once (a marker file records it). If the user
//! turns the extension off afterwards it stays off.
//!
//! PARITY: mirrored by `electron/gnomeExtension.js`.

use std::path::{Path, PathBuf};

use gio::prelude::SettingsExt;
use gio::{Settings, SettingsSchemaSource};
use tauri::{AppHandle, Manager};

use crate::gnome_shortcut::{is_gnome, session_kind, SessionKind};

pub const UUID: &str = "lighttranslator@lighttranslator.app";
const SHELL_SCHEMA: &str = "org.gnome.shell";
const ENABLED_KEY: &str = "enabled-extensions";
/// The extension is written for the GNOME 45+ ESM extension API.
const MIN_SHELL_MAJOR: u32 = 45;
const MARKER_FILE: &str = "gnome-extension-auto-enabled";
const FILES: [&str; 2] = ["metadata.json", "extension.js"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    /// Not a GNOME 45+ Wayland session — the app places the popup itself.
    NotApplicable,
    /// Enabled and known to the running shell.
    Active,
    /// Enabled in settings, but this shell process has not loaded it yet.
    PendingRestart,
    /// Installed and deliberately switched off.
    Disabled,
    /// Could not be installed.
    Missing,
}

impl Status {
    pub fn as_str(self) -> &'static str {
        match self {
            Status::NotApplicable => "not-applicable",
            Status::Active => "active",
            Status::PendingRestart => "pending-restart",
            Status::Disabled => "disabled",
            Status::Missing => "missing",
        }
    }
}

fn applicable() -> bool {
    session_kind() == SessionKind::Wayland && is_gnome() && shell_major() >= MIN_SHELL_MAJOR
}

fn shell_major() -> u32 {
    std::process::Command::new("gnome-shell")
        .arg("--version")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| {
            let text = String::from_utf8_lossy(&output.stdout).to_string();
            text.split_whitespace()
                .find_map(|word| word.split('.').next()?.parse::<u32>().ok())
        })
        .unwrap_or(0)
}

fn user_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(
        PathBuf::from(home)
            .join(".local/share/gnome-shell/extensions")
            .join(UUID),
    )
}

/// Every directory the shell also looks in, so a packaged copy counts.
fn system_dirs() -> Vec<PathBuf> {
    let dirs = std::env::var("XDG_DATA_DIRS")
        .unwrap_or_else(|_| "/usr/local/share:/usr/share".to_string());
    dirs.split(':')
        .filter(|dir| !dir.is_empty())
        .map(|dir| PathBuf::from(dir).join("gnome-shell/extensions").join(UUID))
        .collect()
}

/// `version` out of an installed metadata.json (0 when unreadable).
fn installed_version(dir: &Path) -> u32 {
    std::fs::read_to_string(dir.join("metadata.json"))
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .and_then(|json| json.get("version").and_then(|v| v.as_u64()))
        .unwrap_or(0) as u32
}

/// Where the copy we ship lives (app resources; the repo itself in a dev run).
fn shipped_dir(app: &AppHandle) -> Option<PathBuf> {
    let packaged = app
        .path()
        .resource_dir()
        .ok()
        .map(|dir| dir.join("gnome-extension").join(UUID))
        .filter(|dir| dir.join("metadata.json").is_file());
    if packaged.is_some() {
        return packaged;
    }

    #[cfg(debug_assertions)]
    {
        let in_repo = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../gnome-extension")
            .join(UUID);
        if in_repo.join("metadata.json").is_file() {
            return Some(in_repo);
        }
    }

    None
}

fn copy_into(source: &Path, target: &Path) -> Result<(), String> {
    std::fs::create_dir_all(target).map_err(|e| e.to_string())?;
    for file in FILES {
        std::fs::copy(source.join(file), target.join(file))
            .map_err(|e| format!("{}: {}", file, e))?;
    }
    Ok(())
}

fn shell_settings() -> Option<Settings> {
    SettingsSchemaSource::default()
        .and_then(|source| source.lookup(SHELL_SCHEMA, true))
        .map(|_| Settings::new(SHELL_SCHEMA))
}

fn enabled_in_settings() -> bool {
    shell_settings()
        .map(|settings| {
            settings
                .strv(ENABLED_KEY)
                .iter()
                .any(|uuid| uuid.as_str() == UUID)
        })
        .unwrap_or(false)
}

fn enable_in_settings() -> Result<(), String> {
    let settings = shell_settings().ok_or_else(|| "GNOME Shell settings not available".to_string())?;
    let mut enabled: Vec<String> = settings
        .strv(ENABLED_KEY)
        .iter()
        .map(|uuid| uuid.to_string())
        .collect();
    if !enabled.iter().any(|uuid| uuid == UUID) {
        enabled.push(UUID.to_string());
        let refs: Vec<&str> = enabled.iter().map(|uuid| uuid.as_str()).collect();
        settings
            .set_strv(ENABLED_KEY, &refs)
            .map_err(|e| format!("Failed to enable the GNOME extension: {}", e))?;
        Settings::sync();
    }
    Ok(())
}

/// The running shell only knows about extensions it found at startup, so this
/// is what separates "working now" from "after the next login".
fn shell_knows_extension() -> bool {
    std::process::Command::new("gnome-extensions")
        .args(["list", "--enabled"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| {
            String::from_utf8_lossy(&output.stdout)
                .lines()
                .any(|line| line.trim() == UUID)
        })
        .unwrap_or(false)
}

fn marker_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join(MARKER_FILE))
}

/// Install (if needed) and enable once. Safe to call on every start.
pub fn ensure(app: &AppHandle) -> Status {
    if !applicable() {
        return Status::NotApplicable;
    }

    let shipped = shipped_dir(app);
    let shipped_version = shipped.as_deref().map(installed_version).unwrap_or(0);

    let system_version = system_dirs()
        .iter()
        .map(|dir| installed_version(dir))
        .max()
        .unwrap_or(0);
    let user = user_dir();
    let user_version = user.as_deref().map(installed_version).unwrap_or(0);

    // A packaged copy is enough; only write into the user's directory when
    // there is nothing current to load (AppImage, dev run, or an upgrade that
    // the package did not carry).
    if system_version < shipped_version && user_version < shipped_version {
        match (shipped.as_deref(), user.as_deref()) {
            (Some(source), Some(target)) => {
                if let Err(e) = copy_into(source, target) {
                    log::error!("Failed to install the GNOME placement extension: {}", e);
                }
            }
            _ => log::warn!("GNOME placement extension is not bundled with this build"),
        }
    }

    // Re-read the user directory: it may have just been written.
    let available = system_version > 0 || user.as_deref().map(installed_version).unwrap_or(0) > 0;
    if !available {
        return Status::Missing;
    }

    if !enabled_in_settings() {
        let marker = marker_path(app);
        let already_offered = marker.as_deref().map(Path::exists).unwrap_or(false);
        if already_offered {
            // Enabled once before and switched off since: leave it alone.
            return Status::Disabled;
        }
        match enable_in_settings() {
            Ok(()) => {
                if let Some(marker) = marker {
                    if let Some(parent) = marker.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    let _ = std::fs::write(&marker, format!("{UUID}\n"));
                }
            }
            Err(e) => {
                log::error!("{}", e);
                return Status::Disabled;
            }
        }
    }

    if shell_knows_extension() {
        Status::Active
    } else {
        Status::PendingRestart
    }
}

/// Read-only view for the settings UI.
pub fn status() -> Status {
    if !applicable() {
        return Status::NotApplicable;
    }
    if !enabled_in_settings() {
        let installed = system_dirs()
            .iter()
            .chain(user_dir().iter())
            .any(|dir| installed_version(dir) > 0);
        return if installed { Status::Disabled } else { Status::Missing };
    }
    if shell_knows_extension() {
        Status::Active
    } else {
        Status::PendingRestart
    }
}
