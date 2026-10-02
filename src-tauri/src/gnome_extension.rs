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

use gio::prelude::SettingsExtManual;
use gio::{Settings, SettingsSchemaSource};
use tauri::{AppHandle, Manager};

use crate::gnome_shortcut::{is_gnome, session_kind, SessionKind};

pub const UUID: &str = "lighttranslator@lighttranslator.app";
const SHELL_SCHEMA: &str = "org.gnome.shell";
const ENABLED_KEY: &str = "enabled-extensions";
/// The extension is written for the GNOME 45+ ESM extension API.
const MIN_SHELL_MAJOR: u32 = 45;
const MARKER_FILE: &str = "gnome-extension-auto-enabled";
// Commit the version last so a failed code copy can be retried next startup.
const FILES: [&str; 2] = ["extension.js", "metadata.json"];

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

/// Existing user copies shadow a current system package after login.
fn ensure_user_copy(source: &Path, target: &Path, system_version: u32) -> Result<(), String> {
    let shipped_version = installed_version(source);
    if installed_version(target) < shipped_version
        && (system_version < shipped_version || target.exists())
    {
        copy_into(source, target)?;
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
    let settings =
        shell_settings().ok_or_else(|| "GNOME Shell settings not available".to_string())?;
    let mut enabled: Vec<String> = settings
        .strv(ENABLED_KEY)
        .iter()
        .map(|uuid| uuid.to_string())
        .collect();
    if !enabled.iter().any(|uuid| uuid == UUID) {
        enabled.push(UUID.to_string());
        let refs: Vec<&str> = enabled.iter().map(|uuid| uuid.as_str()).collect();
        settings
            .set_strv(ENABLED_KEY, refs.as_slice())
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
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(MARKER_FILE))
}

/// Install (if needed) and enable once. Safe to call on every start.
pub fn ensure(app: &AppHandle) -> Status {
    if !applicable() {
        return Status::NotApplicable;
    }

    let shipped = shipped_dir(app);
    let system_version = system_dirs()
        .iter()
        .map(|dir| installed_version(dir))
        .max()
        .unwrap_or(0);
    let user = user_dir();
    if let (Some(source), Some(target)) = (shipped.as_deref(), user.as_deref()) {
        if let Err(e) = ensure_user_copy(source, target, system_version) {
            log::error!("Failed to install the GNOME placement extension: {}", e);
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
        return if installed {
            Status::Disabled
        } else {
            Status::Missing
        };
    }
    if shell_knows_extension() {
        Status::Active
    } else {
        Status::PendingRestart
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_helper(dir: &Path, version: u32, script: &str) {
        std::fs::create_dir_all(dir).unwrap();
        std::fs::write(
            dir.join("metadata.json"),
            format!("{{\"version\":{version}}}"),
        )
        .unwrap();
        std::fs::write(dir.join("extension.js"), script).unwrap();
    }

    #[test]
    fn current_system_copy_does_not_leave_a_stale_user_override() {
        let root = tempfile::tempdir().unwrap();
        let source = root.path().join("source");
        let target = root.path().join("user");
        write_helper(&source, 3, "above helper");
        write_helper(&target, 2, "old helper");
        ensure_user_copy(&source, &target, 3).unwrap();
        assert_eq!(installed_version(&target), 3);
        assert_eq!(
            std::fs::read_to_string(target.join("extension.js")).unwrap(),
            "above helper"
        );
    }

    #[test]
    fn fresh_system_install_does_not_create_a_user_override() {
        let root = tempfile::tempdir().unwrap();
        let source = root.path().join("source");
        let target = root.path().join("user");
        write_helper(&source, 3, "above helper");
        ensure_user_copy(&source, &target, 3).unwrap();
        assert!(!target.exists());
        ensure_user_copy(&source, &target, 2).unwrap();
        assert_eq!(installed_version(&target), 3);
    }

    #[test]
    fn current_and_newer_user_copies_are_preserved() {
        let root = tempfile::tempdir().unwrap();
        let source = root.path().join("source");
        write_helper(&source, 3, "above helper");
        for version in [3, 4] {
            let target = root.path().join(format!("user-{version}"));
            write_helper(&target, version, "existing helper");
            ensure_user_copy(&source, &target, 2).unwrap();
            assert_eq!(installed_version(&target), version);
            assert_eq!(
                std::fs::read_to_string(target.join("extension.js")).unwrap(),
                "existing helper"
            );
        }
    }

    #[test]
    fn failed_code_copy_does_not_advance_installed_version() {
        let root = tempfile::tempdir().unwrap();
        let source = root.path().join("source");
        let target = root.path().join("user");
        write_helper(&source, 3, "above helper");
        write_helper(&target, 2, "old helper");
        std::fs::remove_file(source.join("extension.js")).unwrap();
        assert!(ensure_user_copy(&source, &target, 2).is_err());
        assert_eq!(installed_version(&target), 2);
        assert_eq!(
            std::fs::read_to_string(target.join("extension.js")).unwrap(),
            "old helper"
        );
    }
}
