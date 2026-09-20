use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

mod gnome_extension;
mod gnome_shortcut;

use gnome_shortcut::{Mechanism, SessionKind};

// --- Types ---

#[derive(Debug, Serialize, Deserialize)]
pub struct ProxyRequestOptions {
    pub method: Option<String>,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub body: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProxyResponse {
    pub ok: bool,
    #[serde(rename = "statusCode")]
    pub status_code: Option<u16>,
    pub data: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OcrResult {
    pub success: bool,
    pub text: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OcrDependencyStatus {
    #[serde(rename = "tesseractInstalled")]
    pub tesseract_installed: bool,
    #[serde(rename = "tesseractVersion")]
    pub tesseract_version: Option<String>,
    pub languages: Vec<String>,
    #[serde(rename = "gnomeScreenshotInstalled")]
    pub gnome_screenshot_installed: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OcrInstallGuidance {
    pub os: String,
    #[serde(rename = "packageManager")]
    pub package_manager: Option<String>,
    /// Human-readable descriptions of what is missing
    pub missing: Vec<String>,
    /// Copy-pastable install command(s); empty when nothing is missing
    pub commands: Vec<String>,
}

/// Languages the OCR feature wants; tesseract runs with the installed subset.
const OCR_DESIRED_LANGS: [&str; 5] = ["chi_sim", "chi_tra", "eng", "jpn", "kor"];

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowDimensions {
    pub width: f64,
    pub height: f64,
}

/// How the quick-translate hotkey is registered in this session, for the
/// settings UI.
#[derive(Debug, Serialize, Deserialize)]
pub struct ShortcutStatus {
    /// "x11-grab" | "gnome" | "manual"
    pub mechanism: String,
    #[serde(rename = "sessionType")]
    pub session_type: String,
    /// The command a user would bind by hand on an unsupported desktop.
    pub command: String,
    #[serde(rename = "gnomeBinding")]
    pub gnome_binding: Option<String>,
    /// Placement extension: "active" | "pending-restart" | "disabled" |
    /// "missing" | "not-applicable"
    pub extension: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProxySettings {
    pub enabled: bool,
    pub protocol: String,
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
}

// --- State ---

struct AppState {
    current_shortcut: Mutex<String>,
    proxy_settings: Mutex<Option<ProxySettings>>,
    /// True once the quick webview has registered its quick-translate-text listener.
    quick_ready: AtomicBool,
    /// Text captured by the hotkey before the quick webview was ready.
    pending_quick_text: Mutex<Option<String>>,
    /// Kept open so the selection backend is initialised once instead of on
    /// every hotkey press (arboard probes Wayland, then falls back to X11).
    selection_clipboard: Mutex<Option<arboard::Clipboard>>,
    /// True while a compositor move grab we started is in progress. The grab
    /// clears the pop-up's keyboard focus, which is indistinguishable from the
    /// user clicking another window, so the hide-on-blur below consults this.
    quick_drag_active: AtomicBool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_shortcut: Mutex::new("CommandOrControl+Shift+X".to_string()),
            proxy_settings: Mutex::new(None),
            quick_ready: AtomicBool::new(false),
            pending_quick_text: Mutex::new(None),
            selection_clipboard: Mutex::new(None),
            quick_drag_active: AtomicBool::new(false),
        }
    }
}

// --- Commands ---

#[tauri::command]
async fn proxy_request(
    url: String,
    options: Option<ProxyRequestOptions>,
    state: State<'_, AppState>,
) -> Result<ProxyResponse, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(format!("Unsupported URL scheme '{}'", parsed.scheme()));
    }

    let client = {
        let proxy_settings = state
            .proxy_settings
            .lock()
            .map_err(|_| "proxy settings lock poisoned".to_string())?;
        let mut builder = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .connect_timeout(Duration::from_secs(15));
        if let Some(ref settings) = *proxy_settings {
            if settings.enabled {
                let user = settings.username.as_deref().unwrap_or("");
                let pass = settings.password.as_deref().unwrap_or("");
                let proxy = if settings.protocol.starts_with("socks") && !user.is_empty() {
                    // SOCKS credentials go in the proxy URL, not Proxy-Authorization
                    reqwest::Proxy::all(format!(
                        "{}://{}:{}@{}:{}",
                        settings.protocol, user, pass, settings.host, settings.port
                    ))
                } else {
                    reqwest::Proxy::all(format!(
                        "{}://{}:{}",
                        settings.protocol, settings.host, settings.port
                    ))
                    .map(|p| {
                        if user.is_empty() {
                            p
                        } else {
                            p.basic_auth(user, pass)
                        }
                    })
                }
                .map_err(|e| e.to_string())?;
                builder = builder.proxy(proxy);
            }
        }
        builder.build().map_err(|e| e.to_string())?
    };

    let opts = options.unwrap_or(ProxyRequestOptions {
        method: None,
        headers: None,
        body: None,
    });

    let method = opts.method.unwrap_or_else(|| "GET".to_string());

    let mut request = match method.to_uppercase().as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => client.get(&url),
    };

    if let Some(headers) = opts.headers {
        for (key, value) in headers {
            request = request.header(&key, &value);
        }
    }

    if let Some(body) = opts.body {
        request = request.body(body);
    }

    // reqwest has no persistent response cache, and this request directive
    // also tells intermediary caches not to retain provider URLs/responses.
    request = request.header(reqwest::header::CACHE_CONTROL, "no-store");

    match request.send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(body) => Ok(ProxyResponse {
                    ok: status.is_success(),
                    status_code: Some(status.as_u16()),
                    data: Some(body),
                    error: None,
                }),
                Err(e) => Ok(ProxyResponse {
                    ok: false,
                    status_code: Some(status.as_u16()),
                    data: None,
                    error: Some(format!("Failed to read response body: {}", e)),
                }),
            }
        }
        Err(e) => Ok(ProxyResponse {
            ok: false,
            status_code: None,
            data: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
async fn capture_screen(app: AppHandle) -> Result<Option<String>, String> {
    // Create a temp file for the screenshot
    let temp_file = tempfile::NamedTempFile::new().map_err(|e| e.to_string())?;
    let temp_path = temp_file.path().to_string_lossy().to_string() + ".png";

    // Get the app's own window out of the shot
    let was_visible = app
        .get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if was_visible {
        set_main_window_visible(&app, false);
        std::thread::sleep(Duration::from_millis(200));
    }
    let restore = || {
        if was_visible {
            set_main_window_visible(&app, true);
        }
    };

    // Run gnome-screenshot with area selection. The OCR_DEPS_MISSING marker
    // routes the frontend to the install-guidance popup.
    let output = Command::new("gnome-screenshot")
        .args(["-a", "-f", &temp_path])
        .output()
        .map_err(|e| {
            restore();
            format!("OCR_DEPS_MISSING: failed to run gnome-screenshot: {}", e)
        })?;
    restore();

    if !output.status.success() {
        // User might have cancelled
        return Ok(None);
    }

    // Check if file was created
    if !std::path::Path::new(&temp_path).exists() {
        return Ok(None);
    }

    // Read the file and convert to base64
    let image_data = std::fs::read(&temp_path).map_err(|e| e.to_string())?;
    let base64_data = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &image_data);

    // Clean up
    let _ = std::fs::remove_file(&temp_path);

    Ok(Some(format!("data:image/png;base64,{}", base64_data)))
}

#[tauri::command]
async fn ocr_image(base64_image: String) -> Result<OcrResult, String> {
    // Extract the base64 data (remove data URL prefix if present)
    let base64_data = if base64_image.contains(",") {
        base64_image.split(',').nth(1).unwrap_or(&base64_image)
    } else {
        &base64_image
    };

    // Decode base64 to bytes
    let image_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Save to temp file
    let temp_file = tempfile::NamedTempFile::new().map_err(|e| e.to_string())?;
    let temp_path = temp_file.path().to_string_lossy().to_string() + ".png";
    std::fs::write(&temp_path, &image_bytes).map_err(|e| e.to_string())?;

    // Build the language list from what is actually installed: tesseract
    // aborts outright if ANY requested traineddata file is absent
    let installed = installed_tesseract_langs();
    let desired: Vec<&str> = OCR_DESIRED_LANGS
        .iter()
        .copied()
        .filter(|lang| installed.iter().any(|inst| inst == lang))
        .collect();
    let lang_arg = if !desired.is_empty() {
        desired.join("+")
    } else if !installed.is_empty() {
        installed.join("+")
    } else {
        let _ = std::fs::remove_file(&temp_path);
        return Ok(OcrResult {
            success: false,
            text: None,
            error: Some("OCR_DEPS_MISSING: no tesseract language data installed".to_string()),
        });
    };

    // Run tesseract OCR
    let output = Command::new("tesseract")
        .args([&temp_path, "stdout", "-l", &lang_arg])
        .output()
        .map_err(|e| format!("OCR_DEPS_MISSING: failed to run tesseract: {}", e))?;

    // Clean up
    let _ = std::fs::remove_file(&temp_path);

    if output.status.success() {
        // Return the raw layout: the shared frontend cleaner
        // (utils/textUtils.cleanTextLineBreaks) reflows paragraphs, so both
        // backends produce identical OCR output. Joining lines here would
        // destroy the blank-line paragraph breaks it needs.
        let text = String::from_utf8_lossy(&output.stdout).trim().to_string();

        Ok(OcrResult {
            success: true,
            text: Some(text),
            error: None,
        })
    } else {
        let error = String::from_utf8_lossy(&output.stderr).to_string();
        Ok(OcrResult {
            success: false,
            text: None,
            error: Some(error),
        })
    }
}

fn installed_tesseract_langs() -> Vec<String> {
    match Command::new("tesseract").arg("--list-langs").output() {
        Ok(output) if output.status.success() => String::from_utf8_lossy(&output.stdout)
            .lines()
            .skip(1) // Skip header line
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        _ => vec![],
    }
}

fn ocr_dependency_status() -> OcrDependencyStatus {
    let tesseract_output = Command::new("tesseract").arg("--version").output();
    let (tesseract_installed, tesseract_version) = match tesseract_output {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout);
            let version = version_str.lines().next().unwrap_or("").to_string();
            (true, Some(version))
        }
        _ => (false, None),
    };

    let languages = if tesseract_installed {
        installed_tesseract_langs()
    } else {
        vec![]
    };

    let gnome_screenshot_installed = Command::new("which")
        .arg("gnome-screenshot")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    OcrDependencyStatus {
        tesseract_installed,
        tesseract_version,
        languages,
        gnome_screenshot_installed,
    }
}

#[tauri::command]
async fn check_ocr_dependencies() -> Result<OcrDependencyStatus, String> {
    Ok(ocr_dependency_status())
}

fn detect_linux_package_manager() -> Option<&'static str> {
    let content = std::fs::read_to_string("/etc/os-release").unwrap_or_default();
    let mut id = String::new();
    let mut id_like = String::new();
    for line in content.lines() {
        if let Some(v) = line.strip_prefix("ID=") {
            id = v.trim_matches('"').to_lowercase();
        } else if let Some(v) = line.strip_prefix("ID_LIKE=") {
            id_like = v.trim_matches('"').to_lowercase();
        }
    }
    let hay = format!("{} {}", id, id_like);
    if hay.contains("debian") || hay.contains("ubuntu") {
        Some("apt")
    } else if hay.contains("fedora") || hay.contains("rhel") || hay.contains("centos") {
        Some("dnf")
    } else if hay.contains("arch") {
        Some("pacman")
    } else if hay.contains("suse") {
        Some("zypper")
    } else {
        None
    }
}

/// Per-package-manager package name for a tesseract language code.
fn lang_package(manager: &str, lang: &str) -> String {
    match manager {
        "apt" => format!("tesseract-ocr-{}", lang.replace('_', "-")),
        "dnf" => format!("tesseract-langpack-{}", lang),
        "pacman" => format!("tesseract-data-{}", lang),
        "zypper" => {
            let name = match lang {
                "chi_sim" => "chinese_simplified",
                "chi_tra" => "chinese_traditional",
                "eng" => "english",
                "jpn" => "japanese",
                "kor" => "korean",
                other => other,
            };
            format!("tesseract-ocr-traineddata-{}", name)
        }
        _ => lang.to_string(),
    }
}

/// OCR components are deliberately NOT package dependencies: this command
/// tells the user exactly what to install for their system when they first
/// use OCR (see DECISIONS.md 0003).
#[tauri::command]
async fn get_ocr_install_guidance() -> Result<OcrInstallGuidance, String> {
    let status = ocr_dependency_status();

    let missing_core = !status.tesseract_installed;
    let missing_screenshot = !status.gnome_screenshot_installed;
    let missing_langs: Vec<&str> = if status.tesseract_installed {
        OCR_DESIRED_LANGS
            .iter()
            .copied()
            .filter(|lang| !status.languages.iter().any(|inst| inst == lang))
            .collect()
    } else {
        OCR_DESIRED_LANGS.to_vec()
    };

    let mut missing = Vec::new();
    if missing_core {
        missing.push("Tesseract OCR engine".to_string());
    }
    if !missing_langs.is_empty() {
        missing.push(format!("Language data: {}", missing_langs.join(", ")));
    }
    // Area capture currently uses gnome-screenshot, a Linux-only path
    if missing_screenshot && cfg!(target_os = "linux") {
        missing.push("gnome-screenshot (area capture)".to_string());
    }

    let mut commands = Vec::new();
    let mut package_manager = None;
    let os;

    if cfg!(target_os = "linux") {
        os = "linux".to_string();
        if !missing.is_empty() {
            if let Some(manager) = detect_linux_package_manager() {
                package_manager = Some(manager.to_string());
                let mut packages: Vec<String> = Vec::new();
                if missing_core {
                    packages.push(
                        match manager {
                            "apt" | "zypper" => "tesseract-ocr",
                            _ => "tesseract",
                        }
                        .to_string(),
                    );
                }
                for lang in &missing_langs {
                    packages.push(lang_package(manager, lang));
                }
                if missing_screenshot {
                    packages.push("gnome-screenshot".to_string());
                }
                let install = match manager {
                    "apt" => format!("sudo apt install {}", packages.join(" ")),
                    "dnf" => format!("sudo dnf install {}", packages.join(" ")),
                    "pacman" => format!("sudo pacman -S {}", packages.join(" ")),
                    "zypper" => format!("sudo zypper install {}", packages.join(" ")),
                    _ => unreachable!(),
                };
                commands.push(install);
            } else {
                commands.push(
                    "Install 'tesseract-ocr' (with the language data you need) and 'gnome-screenshot' using your distribution's package manager".to_string(),
                );
            }
        }
    } else if cfg!(target_os = "macos") {
        os = "macos".to_string();
        if missing_core || !missing_langs.is_empty() {
            package_manager = Some("brew".to_string());
            commands.push("brew install tesseract tesseract-lang".to_string());
        }
    } else {
        os = "windows".to_string();
        if missing_core || !missing_langs.is_empty() {
            package_manager = Some("winget".to_string());
            commands.push("winget install UB-Mannheim.TesseractOCR".to_string());
        }
    }

    Ok(OcrInstallGuidance {
        os,
        package_manager,
        missing,
        commands,
    })
}

/// `gnome_binding` is the same accelerator in GTK spelling, computed by the
/// shared `utils/shortcutUtils.ts`; it is only used where GNOME owns the key.
#[tauri::command]
async fn update_shortcut(
    app: AppHandle,
    shortcut: String,
    gnome_binding: Option<String>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    if gnome_shortcut::mechanism() == Mechanism::Gnome {
        let binding = gnome_binding
            .as_deref()
            .map(str::trim)
            .filter(|binding| !binding.is_empty())
            .ok_or_else(|| format!("'{}' cannot be used as a GNOME shortcut", shortcut))?;

        gnome_shortcut::ensure_entry(Some(binding))?;

        let mut current = state
            .current_shortcut
            .lock()
            .map_err(|_| "shortcut state lock poisoned".to_string())?;
        *current = shortcut;
        return Ok(true);
    }

    // Validate before touching the currently registered shortcut
    let new_shortcut: Shortcut = shortcut
        .parse()
        .map_err(|e| format!("Invalid shortcut '{}': {:?}", shortcut, e))?;

    // Single lock scope for the whole swap so concurrent calls can't interleave
    let mut current = state
        .current_shortcut
        .lock()
        .map_err(|_| "shortcut state lock poisoned".to_string())?;
    let old_shortcut = current.parse::<Shortcut>().ok();

    // Same accelerator (possibly spelled differently): registering again would fail
    if old_shortcut.as_ref() == Some(&new_shortcut) {
        *current = shortcut;
        return Ok(true);
    }

    // Register the new shortcut first so a failure leaves the old one working
    app.global_shortcut()
        .on_shortcut(new_shortcut, on_quick_shortcut)
        .map_err(|e| format!("Failed to register '{}': {}", shortcut, e))?;

    if let Some(old_sc) = old_shortcut {
        let _ = app.global_shortcut().unregister(old_sc);
    }
    *current = shortcut;

    Ok(true)
}

/// Raw GNOME appearance settings. Deliberately raw strings: the mapping from
/// a theme name to an accent hex is UI policy, and keeping it in the frontend
/// means both backends stay identical and trivial.
///
/// PARITY: mirrored by `electron/main.js`.
#[derive(Debug, Serialize, Deserialize)]
pub struct SystemAppearance {
    #[serde(rename = "colorScheme")]
    pub color_scheme: Option<String>,
    #[serde(rename = "accentColor")]
    pub accent_color: Option<String>,
    #[serde(rename = "gtkTheme")]
    pub gtk_theme: Option<String>,
}

/// Reads `org.gnome.desktop.interface`.
///
/// `accent-color` only exists from GNOME 47; on Ubuntu 24.04 (GNOME 46) the
/// accent is carried by `gtk-theme` as `Yaru-<name>`, which maps one-to-one
/// onto the ten accents the Appearance tab offers. Both are returned so the
/// frontend can prefer the explicit key where it exists.
#[tauri::command]
async fn get_system_appearance() -> Result<SystemAppearance, String> {
    use gio::prelude::SettingsExt;

    const SCHEMA: &str = "org.gnome.desktop.interface";

    // Settings::new aborts the process on a missing schema, and reading a key
    // the schema does not declare aborts too — hence both guards.
    if !gnome_shortcut::schema_installed(SCHEMA) {
        return Ok(SystemAppearance {
            color_scheme: None,
            accent_color: None,
            gtk_theme: None,
        });
    }

    let settings = gio::Settings::new(SCHEMA);
    let read = |key: &str| -> Option<String> {
        let schema = settings.settings_schema()?;
        schema
            .has_key(key)
            .then(|| settings.string(key).to_string())
            .filter(|value| !value.is_empty())
    };

    Ok(SystemAppearance {
        color_scheme: read("color-scheme"),
        accent_color: read("accent-color"),
        gtk_theme: read("gtk-theme"),
    })
}

/// What the settings UI needs to explain where the shortcut lives.
#[tauri::command]
async fn get_shortcut_status() -> Result<ShortcutStatus, String> {
    Ok(ShortcutStatus {
        mechanism: gnome_shortcut::mechanism().as_str().to_string(),
        session_type: gnome_shortcut::session_kind_str().to_string(),
        command: gnome_shortcut::trigger_command(),
        gnome_binding: gnome_shortcut::current_binding(),
        extension: gnome_extension::status().as_str().to_string(),
    })
}

/// Re-apply the registration for this session. The app does this at every
/// start; the button exists for when a session switch or a hand-edit in GNOME
/// Settings has left things inconsistent.
#[tauri::command]
async fn reregister_shortcut(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let shortcut = state
        .current_shortcut
        .lock()
        .map_err(|_| "shortcut state lock poisoned".to_string())?
        .clone();
    setup_hotkey(&app, &shortcut);
    Ok(gnome_shortcut::mechanism().as_str().to_string())
}

#[tauri::command]
async fn set_proxy(settings: ProxySettings, state: State<'_, AppState>) -> Result<(), String> {
    let mut proxy = state
        .proxy_settings
        .lock()
        .map_err(|_| "proxy settings lock poisoned".to_string())?;
    *proxy = Some(settings);
    Ok(())
}

#[tauri::command]
async fn set_auto_launch(app: AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().map_err(|e| e.to_string())?;
    } else {
        autostart.disable().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn get_auto_launch(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart = app.autolaunch();
    autostart.is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
async fn resize_quick_window(app: AppHandle, dimensions: WindowDimensions) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick") {
        let size = tauri::LogicalSize::new(dimensions.width, dimensions.height);
        window.set_size(size).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn resize_main_window(app: AppHandle, dimensions: WindowDimensions) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let size = tauri::LogicalSize::new(dimensions.width, dimensions.height);
        window.set_size(size).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn quick_window_ready(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    // The webview now has a live listener; deliver any text the hotkey
    // captured before it was ready. No clipboard access here — reading the
    // clipboard on startup caused an unsolicited translation at every launch.
    state.quick_ready.store(true, Ordering::SeqCst);

    let pending = state
        .pending_quick_text
        .lock()
        .map_err(|_| "pending text lock poisoned".to_string())?
        .take();
    if let Some(text) = pending {
        app.emit_to("quick", "quick-translate-text", text)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// The pop-up's "open in main window" button: hand the text over, bring the
/// main window forward, and dismiss the pop-up.
///
/// PARITY: mirrored by `electron/main.js`.
#[tauri::command]
async fn open_in_main_window(app: AppHandle, text: String) -> Result<(), String> {
    show_main_window(&app);
    app.emit_to("main", "quick-to-main", text)
        .map_err(|e| e.to_string())?;
    if let Some(window) = app.get_webview_window("quick") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Start a compositor-driven move of the quick pop-up.
///
/// Wayland forbids a client from moving its own window, so this has to be an
/// `xdg_toplevel.move` grab — and mutter clears the client's keyboard focus
/// for the grab's duration, which arrives as a plain `Focused(false)`. Setting
/// the flag and starting the drag in ONE command is what removes the race:
/// there is no window in which the blur can reach the handler unguarded.
///
/// PARITY: `electron/main.js` brackets the same state with will-move/moved,
/// because its drag is CSS-driven and has no JS entry point.
#[tauri::command]
async fn start_quick_drag(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let Some(window) = app.get_webview_window("quick") else {
        return Ok(());
    };
    state.quick_drag_active.store(true, Ordering::SeqCst);
    window.start_dragging().map_err(|e| e.to_string())?;
    arm_quick_drag_watchdog(app);
    Ok(())
}

/// Suppress the pop-up's hide-on-blur around a grab this process cannot start
/// itself.
///
/// A resize grab clears focus exactly like a move grab, but
/// `start_resize_dragging` lives on `Window`, which is behind Tauri's
/// `unstable` feature — not a flag worth enabling for one call. The frontend
/// awaits this, then starts the grab through the JS window API, which gives
/// the same ordering guarantee without it.
#[tauri::command]
async fn set_quick_drag_active(
    app: AppHandle,
    state: State<'_, AppState>,
    active: bool,
) -> Result<(), String> {
    state.quick_drag_active.store(active, Ordering::SeqCst);
    if active {
        arm_quick_drag_watchdog(app);
    }
    Ok(())
}

/// Clear the suppression shortly after it is armed.
///
/// The flag only has to bridge the instant between asking for a grab and the
/// grab-induced blur arriving — a few milliseconds. Once that blur has been
/// swallowed the window stays unfocused for the rest of the drag, so no
/// further blur can fire and the flag has nothing left to protect.
///
/// Keeping it short bounds the damage when a grab never actually starts (a
/// stale serial, or a compositor that ignored the request): the pop-up goes
/// back to dismissing normally a second later instead of ignoring click-away
/// until the timeout. It is a bound on a known risk, not a fix for an
/// observed failure.
fn arm_quick_drag_watchdog(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(1000));
        app.state::<AppState>()
            .quick_drag_active
            .store(false, Ordering::SeqCst);
    });
}

#[tauri::command]
async fn close_quick_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// --- Helper Functions ---

fn should_start_hidden() -> bool {
    std::env::args().any(|arg| {
        arg == "--hidden" || arg == "--autostart" || arg == gnome_shortcut::TRIGGER_ARG
    })
}

/// True when this process was started only to trigger a quick translate
/// (GNOME runs the command when no instance is up yet).
fn started_for_quick_translate() -> bool {
    std::env::args().any(|arg| arg == gnome_shortcut::TRIGGER_ARG)
}

fn on_quick_shortcut(app: &AppHandle, _shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state == ShortcutState::Pressed {
        trigger_quick_translate(app);
    }
}

/// The text the user has selected, read from the PRIMARY selection without
/// touching their clipboard.
///
/// This is what makes Wayland work: synthetic Ctrl+C (XTEST) never reaches a
/// Wayland-native application, but mutter bridges the Wayland primary selection
/// to X11 regardless of who has focus (`src/x11/meta-x11-selection.c`), so
/// arboard can read it from the background.
fn read_primary_selection(state: &AppState) -> Option<String> {
    use arboard::{GetExtLinux, LinuxClipboardKind};

    let mut guard = state.selection_clipboard.lock().ok()?;
    if guard.is_none() {
        match arboard::Clipboard::new() {
            Ok(clipboard) => *guard = Some(clipboard),
            Err(e) => {
                log::warn!("Selection clipboard unavailable: {}", e);
                return None;
            }
        }
    }

    match guard
        .as_mut()?
        .get()
        .clipboard(LinuxClipboardKind::Primary)
        .text()
    {
        Ok(text) => Some(text),
        Err(e) => {
            log::debug!("No primary selection to read: {}", e);
            None
        }
    }
}

/// X11 only: copy the selection with a synthetic Ctrl+C, restoring whatever
/// was on the clipboard when nothing was selected.
fn copy_selection_via_xdotool(app: &AppHandle) -> String {
    use tauri_plugin_clipboard_manager::ClipboardExt;

    // Save and clear the clipboard first, so an empty clipboard afterwards
    // means "nothing was selected" — then the user's previous content is
    // restored and reused instead of translating whatever was copied earlier.
    let previous = app.clipboard().read_text().unwrap_or_default();
    let _ = app.clipboard().write_text(String::new());

    let _ = Command::new("xdotool")
        .args(["key", "--clearmodifiers", "ctrl+c"])
        .output();

    // Small delay for clipboard to update
    std::thread::sleep(Duration::from_millis(150));

    let copied = app.clipboard().read_text().unwrap_or_default();
    if copied.trim().is_empty() {
        if !previous.is_empty() {
            let _ = app.clipboard().write_text(previous.clone());
        }
        previous
    } else {
        copied
    }
}

/// Cursor position in PHYSICAL pixels (xdotool's unit; wrapping these in a
/// LogicalPosition lands the window at scale× the cursor on HiDPI displays).
fn cursor_position() -> (i32, i32) {
    let mut cursor = (100_i32, 100_i32);
    if let Ok(output) = Command::new("xdotool").arg("getmouselocation").output() {
        let location = String::from_utf8_lossy(&output.stdout);
        // Parse "x:123 y:456 screen:0 window:123456"
        for part in location.split_whitespace() {
            if let Some(val) = part.strip_prefix("x:") {
                cursor.0 = val.parse().unwrap_or(100);
            } else if let Some(val) = part.strip_prefix("y:") {
                cursor.1 = val.parse().unwrap_or(100);
            }
        }
    }
    cursor
}

fn trigger_quick_translate(app: &AppHandle) {
    use tauri_plugin_clipboard_manager::ClipboardExt;

    let wayland = gnome_shortcut::session_kind() == SessionKind::Wayland;

    let clipboard_text = if wayland {
        let state = app.state::<AppState>();
        read_primary_selection(&state)
            .map(|text| text.trim().to_string())
            .filter(|text| !text.is_empty())
            // Nothing selected: fall back to the clipboard, same as X11 does.
            .unwrap_or_else(|| app.clipboard().read_text().unwrap_or_default())
    } else {
        copy_selection_via_xdotool(app)
    };

    // Under Wayland the pointer position is not ours to know (Xwayland reports
    // a stale one) and a client cannot place its own window, so the bundled
    // GNOME extension moves the popup to the pointer instead.
    let cursor = if wayland { None } else { Some(cursor_position()) };

    // Window/monitor calls touch GTK, which is main-thread-only: this runs on
    // the global-shortcut callback thread, so hop to the main thread or the
    // process dies nondeterministically (observed: app exits mid-hotkey).
    let app_for_window = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(window) = app_for_window.get_webview_window("quick") else {
            return;
        };

        if let Some((mut x, mut y)) = cursor {
            // Clamp so the popup stays on the monitor under the cursor
            if let (Ok(win_size), Ok(Some(monitor))) = (
                window.outer_size(),
                app_for_window.monitor_from_point(x as f64, y as f64),
            ) {
                let mp = monitor.position();
                let ms = monitor.size();
                let max_x = mp.x + ms.width as i32 - win_size.width as i32;
                let max_y = mp.y + ms.height as i32 - win_size.height as i32;
                x = x.clamp(mp.x, max_x.max(mp.x));
                y = y.clamp(mp.y, max_y.max(mp.y));
            }
            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
        } else {
            // Presenting an already-visible window goes through xdg-activation,
            // and a background app has no activation token, so it would never
            // take focus. Unmapping first makes the next show a fresh map,
            // which mutter does focus — and which the placement extension sees.
            let _ = window.hide();
        }

        let _ = window.show();
        let _ = window.set_focus();
    });

    if !wayland {
        // On X11, forcefully activate the window for proper focus so the blur
        // event fires when clicking outside. xdotool cannot see Wayland windows.
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50));
            let _ = Command::new("xdotool")
                .args(["search", "--name", "Quick Translate", "windowactivate"])
                .output();
        });
    }

    if !clipboard_text.is_empty() {
        let state = app.state::<AppState>();
        if state.quick_ready.load(Ordering::SeqCst) {
            // Emit after a small delay for the window to be ready
            let app_clone = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(100));
                let _ = app_clone.emit_to("quick", "quick-translate-text", clipboard_text);
            });
        } else if let Ok(mut pending) = state.pending_quick_text.lock() {
            // Webview not mounted yet; quick_window_ready delivers this
            *pending = Some(clipboard_text);
        }
    }
}

/// Show/hide the main window from any thread (window ops touch GTK, which is
/// main-thread-only).
fn set_main_window_visible(app: &AppHandle, visible: bool) {
    let app = app.clone();
    let _ = app.clone().run_on_main_thread(move || {
        if let Some(window) = app.get_webview_window("main") {
            if visible {
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                let _ = window.hide();
            }
        }
    });
}

/// Show + focus the main window from any thread.
fn show_main_window(app: &AppHandle) {
    set_main_window_visible(app, true);
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Show LightTranslator", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let ocr_item = MenuItem::with_id(app, "ocr", "OCR Screenshot", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &settings_item, &ocr_item, &quit_item])?;

    // Use the same icon as dock (512x512) - let system handle scaling
    let tray_icon = {
        let icon_bytes = include_bytes!("../icons/icon.png");
        let img = image::load_from_memory(icon_bytes)?.into_rgba8();
        let (width, height) = img.dimensions();
        tauri::image::Image::new_owned(img.into_raw(), width, height)
    };

    let _tray = TrayIconBuilder::new()
        .icon(tray_icon)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = app.emit_to("main", "open-settings", ());
                }
            }
            "ocr" => {
                // Trigger OCR capture
                let app_clone = app.clone();
                std::thread::spawn(move || {
                    // Missing components: open the main window with the
                    // install-guidance popup instead of failing silently
                    let deps = ocr_dependency_status();
                    if !(deps.tesseract_installed && deps.gnome_screenshot_installed) {
                        show_main_window(&app_clone);
                        let _ = app_clone.emit_to("main", "ocr-deps-missing", ());
                        return;
                    }
                    if let Ok(Some(image_data)) =
                        tauri::async_runtime::block_on(capture_screen(app_clone.clone()))
                    {
                        if let Ok(ocr_result) = tauri::async_runtime::block_on(ocr_image(image_data)) {
                            if ocr_result.success {
                                if let Some(text) = ocr_result.text {
                                    show_main_window(&app_clone);
                                    let _ = app_clone.emit_to("main", "ocr-result", text);
                                }
                            }
                        }
                    }
                });
            }
            "quit" => {
                // Go through Tauri's exit lifecycle (shortcut unregistration,
                // webview teardown, log flush) instead of std::process::exit
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

/// Register the hotkey the way this session allows.
///
/// X11: the app grabs the key itself, as it always has. Wayland on GNOME: the
/// key belongs to GNOME, which runs `<exe> --quick-translate` and lets the
/// single-instance plugin hand it to the running app.
fn setup_hotkey(app: &AppHandle, shortcut_str: &str) {
    match gnome_shortcut::mechanism() {
        Mechanism::Gnome => {
            // Keeps the command path current (a reinstall or a moved AppImage
            // changes it) without overwriting the accelerator; the frontend
            // pushes the user's own accelerator right after startup.
            match gnome_shortcut::ensure_entry(None) {
                Ok(()) => log::info!(
                    "Quick translate is registered as a GNOME custom shortcut ({})",
                    gnome_shortcut::current_binding().unwrap_or_else(|| "unset".into())
                ),
                Err(e) => log::error!("Failed to register the GNOME shortcut: {}", e),
            }
        }
        Mechanism::X11Grab | Mechanism::Manual => {
            // An entry left behind by a Wayland session would make gnome-shell
            // own the key, and our own grab would fail with BadAccess.
            match gnome_shortcut::remove_entry() {
                Ok(true) => log::info!(
                    "Removed the GNOME shortcut entry; this session grabs the key directly"
                ),
                Ok(false) => {}
                Err(e) => log::warn!("Could not check the GNOME shortcut entry: {}", e),
            }
            register_global_shortcut(app, shortcut_str.to_string());
        }
    }
}

/// gnome-shell releases its own grab asynchronously after the settings write,
/// so the first attempt right after removing the entry can still lose the race.
fn register_global_shortcut(app: &AppHandle, shortcut_str: String) {
    let app = app.clone();
    std::thread::spawn(move || {
        let shortcut: Shortcut = match shortcut_str.parse() {
            Ok(shortcut) => shortcut,
            Err(e) => {
                log::error!("Invalid shortcut '{}': {:?}", shortcut_str, e);
                return;
            }
        };

        if app.global_shortcut().is_registered(shortcut) {
            return;
        }

        for (attempt, delay) in [0_u64, 300, 900, 2000].iter().enumerate() {
            if *delay > 0 {
                std::thread::sleep(Duration::from_millis(*delay));
            }
            match app.global_shortcut().on_shortcut(shortcut, on_quick_shortcut) {
                Ok(()) => {
                    log::info!("Global shortcut '{}' registered", shortcut_str);
                    return;
                }
                Err(e) => log::warn!(
                    "Could not register '{}' (attempt {}): {}",
                    shortcut_str,
                    attempt + 1,
                    e
                ),
            }
        }
        log::error!(
            "Giving up on the global shortcut '{}'; another application may hold it",
            shortcut_str
        );
    });
}

// --- Main Entry Point ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState::default();

    tauri::Builder::default()
        .manage(state)
        // Must come first: a second process exits inside this plugin's setup,
        // before any window or tray icon is created. It is also how the GNOME
        // shortcut reaches the running app under Wayland.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let handle = app.clone();
            let trigger = argv.iter().any(|arg| arg == gnome_shortcut::TRIGGER_ARG);
            // This runs on the plugin's D-Bus thread; the capture below blocks.
            std::thread::spawn(move || {
                if trigger {
                    trigger_quick_translate(&handle);
                } else {
                    show_main_window(&handle);
                }
            });
        }))
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .invoke_handler(tauri::generate_handler![
            proxy_request,
            capture_screen,
            ocr_image,
            check_ocr_dependencies,
            get_ocr_install_guidance,
            update_shortcut,
            get_shortcut_status,
            get_system_appearance,
            reregister_shortcut,
            set_proxy,
            set_auto_launch,
            get_auto_launch,
            resize_quick_window,
            resize_main_window,
            quick_window_ready,
            close_quick_window,
            open_in_main_window,
            start_quick_drag,
            set_quick_drag_active,
        ])
        .setup(|app| {
            let start_hidden = should_start_hidden();

            // Setup tray
            if let Err(e) = setup_tray(app.handle()) {
                log::error!("Failed to setup tray: {}", e);
            }

            // Register the hotkey the way this session allows (X11 grab, or a
            // GNOME custom shortcut under Wayland)
            let shortcut = app
                .state::<AppState>()
                .current_shortcut
                .lock()
                .map(|shortcut| shortcut.clone())
                .unwrap_or_else(|_| "CommandOrControl+Shift+X".to_string());
            setup_hotkey(app.handle(), &shortcut);

            // Install and enable the placement extension (Wayland on GNOME
            // only). Runs off the main thread: it reads files and asks
            // gnome-shell for its version.
            let handle_for_extension = app.handle().clone();
            std::thread::spawn(move || {
                let status = gnome_extension::ensure(&handle_for_extension);
                log::info!("GNOME placement extension: {}", status.as_str());
            });

            // Started by the GNOME shortcut while the app was not running:
            // do the capture once the app is up.
            if started_for_quick_translate() {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(100));
                    trigger_quick_translate(&handle);
                });
            }

            // Hide quick window on startup (it starts hidden anyway)
            if let Some(quick) = app.get_webview_window("quick") {
                let _ = quick.hide();
            }

            if let Some(main) = app.get_webview_window("main") {
                if start_hidden {
                    let _ = main.hide();
                } else {
                    let _ = main.show();
                    let _ = main.set_focus();
                }
            }

            // Open devtools in dev mode for debugging
            #[cfg(debug_assertions)]
            if !start_hidden {
                if let Some(main) = app.get_webview_window("main") {
                    main.open_devtools();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide to tray instead of closing main window
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            // Hide the quick window on blur. This is the SOLE owner of that
            // decision — the renderer used to hide it too, and two independent
            // hiders made the drag suppression below impossible to honour.
            if window.label() == "quick" {
                match event {
                    tauri::WindowEvent::Focused(false) => {
                        let dragging = window
                            .app_handle()
                            .state::<AppState>()
                            .quick_drag_active
                            .load(Ordering::SeqCst);
                        if !dragging {
                            let _ = window.hide();
                        }
                    }
                    // Mutter restores input focus when the grab op ends, so
                    // this is the natural end-of-drag signal.
                    tauri::WindowEvent::Focused(true) => {
                        window
                            .app_handle()
                            .state::<AppState>()
                            .quick_drag_active
                            .store(false, Ordering::SeqCst);
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
