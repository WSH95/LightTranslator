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
pub struct WindowDimensions {
    pub width: f64,
    pub height: f64,
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
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_shortcut: Mutex::new("CommandOrControl+Shift+X".to_string()),
            proxy_settings: Mutex::new(None),
            quick_ready: AtomicBool::new(false),
            pending_quick_text: Mutex::new(None),
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
async fn capture_screen() -> Result<Option<String>, String> {
    // Create a temp file for the screenshot
    let temp_file = tempfile::NamedTempFile::new().map_err(|e| e.to_string())?;
    let temp_path = temp_file.path().to_string_lossy().to_string() + ".png";

    // Run gnome-screenshot with area selection
    let output = Command::new("gnome-screenshot")
        .args(["-a", "-f", &temp_path])
        .output()
        .map_err(|e| format!("Failed to run gnome-screenshot: {}", e))?;

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

    // Run tesseract OCR
    let output = Command::new("tesseract")
        .args([&temp_path, "stdout", "-l", "chi_sim+chi_tra+eng+jpn+kor"])
        .output()
        .map_err(|e| format!("Failed to run tesseract: {}", e))?;

    // Clean up
    let _ = std::fs::remove_file(&temp_path);

    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout).to_string();
        // Clean up the text (remove extra whitespace, normalize line breaks)
        let cleaned_text = text
            .lines()
            .filter(|line| !line.trim().is_empty())
            .collect::<Vec<_>>()
            .join(" ");

        Ok(OcrResult {
            success: true,
            text: Some(cleaned_text),
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

#[tauri::command]
async fn check_ocr_dependencies() -> Result<OcrDependencyStatus, String> {
    // Check tesseract
    let tesseract_output = Command::new("tesseract").arg("--version").output();

    let (tesseract_installed, tesseract_version) = match tesseract_output {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout);
            let version = version_str.lines().next().unwrap_or("").to_string();
            (true, Some(version))
        }
        _ => (false, None),
    };

    // Check tesseract languages
    let languages = if tesseract_installed {
        let langs_output = Command::new("tesseract").arg("--list-langs").output();
        match langs_output {
            Ok(output) if output.status.success() => {
                String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .skip(1) // Skip header line
                    .map(|s| s.to_string())
                    .collect()
            }
            _ => vec![],
        }
    } else {
        vec![]
    };

    // Check gnome-screenshot
    let gnome_screenshot_installed = Command::new("which")
        .arg("gnome-screenshot")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    Ok(OcrDependencyStatus {
        tesseract_installed,
        tesseract_version,
        languages,
        gnome_screenshot_installed,
    })
}

#[tauri::command]
async fn install_ocr_dependencies() -> Result<bool, String> {
    // This would require sudo, so we just return instructions
    // In a real implementation, you might open a terminal or use pkexec
    Err("Please install OCR dependencies manually: sudo apt install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-chi-tra tesseract-ocr-eng tesseract-ocr-jpn tesseract-ocr-kor gnome-screenshot xdotool".to_string())
}

#[tauri::command]
async fn show_ocr_install_prompt(app: AppHandle, message: String) -> Result<bool, String> {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    let result = app
        .dialog()
        .message(format!("{}\n\nWould you like to install OCR dependencies?", message))
        .title("OCR Dependencies Missing")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancel)
        .blocking_show();

    Ok(result)
}

#[tauri::command]
async fn update_shortcut(
    app: AppHandle,
    shortcut: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
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

#[tauri::command]
async fn close_quick_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// --- Helper Functions ---

fn should_start_hidden() -> bool {
    std::env::args().any(|arg| arg == "--hidden" || arg == "--autostart")
}

fn on_quick_shortcut(app: &AppHandle, _shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state == ShortcutState::Pressed {
        trigger_quick_translate(app);
    }
}

/// Selection capture relies on X11 tools (xdotool); warn once per run on Wayland.
fn warn_if_wayland(app: &AppHandle) {
    static WARNED: AtomicBool = AtomicBool::new(false);

    let is_wayland = std::env::var("XDG_SESSION_TYPE")
        .map(|v| v.eq_ignore_ascii_case("wayland"))
        .unwrap_or(false);
    if !is_wayland || WARNED.swap(true, Ordering::SeqCst) {
        return;
    }

    log::warn!("Wayland session detected: xdotool-based selection capture may not work");
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
    app.dialog()
        .message(
            "Quick Translate captures the selected text with X11 tools (xdotool), \
             which may not work in a Wayland session. The current clipboard content \
             will be translated instead.\n\n\
             Tip: copy the text (Ctrl+C) before pressing the shortcut.",
        )
        .title("Wayland session detected")
        .kind(MessageDialogKind::Warning)
        .show(|_| {});
}

fn trigger_quick_translate(app: &AppHandle) {
    use tauri_plugin_clipboard_manager::ClipboardExt;

    warn_if_wayland(app);

    // Get clipboard content first using xdotool to simulate Ctrl+C
    let _ = Command::new("xdotool")
        .args(["key", "--clearmodifiers", "ctrl+c"])
        .output();

    // Small delay for clipboard to update
    std::thread::sleep(Duration::from_millis(150));

    // Read the clipboard text
    let clipboard_text = app.clipboard().read_text().unwrap_or_default();

    // Show quick window at cursor position
    if let Some(window) = app.get_webview_window("quick") {
        // xdotool reports PHYSICAL pixels; wrapping them in LogicalPosition
        // lands the window at scale× the cursor position on HiDPI displays.
        if let Ok(output) = Command::new("xdotool").arg("getmouselocation").output() {
            let location = String::from_utf8_lossy(&output.stdout);
            // Parse "x:123 y:456 screen:0 window:123456"
            let mut x: i32 = 100;
            let mut y: i32 = 100;

            for part in location.split_whitespace() {
                if let Some(val) = part.strip_prefix("x:") {
                    x = val.parse().unwrap_or(100);
                } else if let Some(val) = part.strip_prefix("y:") {
                    y = val.parse().unwrap_or(100);
                }
            }

            // Clamp so the popup stays on the monitor under the cursor
            if let (Ok(win_size), Ok(Some(monitor))) =
                (window.outer_size(), app.monitor_from_point(x as f64, y as f64))
            {
                let mp = monitor.position();
                let ms = monitor.size();
                let max_x = mp.x + ms.width as i32 - win_size.width as i32;
                let max_y = mp.y + ms.height as i32 - win_size.height as i32;
                x = x.clamp(mp.x, max_x.max(mp.x));
                y = y.clamp(mp.y, max_y.max(mp.y));
            }

            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
        }

        let _ = window.show();
        let _ = window.set_focus();

        // On Linux, use xdotool to forcefully activate the window for proper focus
        // This ensures the blur event will fire when clicking outside
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50));
            // Search for the window by name and activate it
            let _ = Command::new("xdotool")
                .args(["search", "--name", "Quick Translate", "windowactivate"])
                .output();
        });

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
                    if let Ok(Some(image_data)) = tauri::async_runtime::block_on(capture_screen()) {
                        if let Ok(ocr_result) = tauri::async_runtime::block_on(ocr_image(image_data)) {
                            if ocr_result.success {
                                if let Some(text) = ocr_result.text {
                                    // Show main window and emit OCR result
                                    if let Some(window) = app_clone.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
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

fn setup_global_shortcut(app: &AppHandle, state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut_str = state
        .current_shortcut
        .lock()
        .map_err(|_| String::from("shortcut state lock poisoned"))?
        .clone();
    let shortcut: Shortcut = shortcut_str.parse()?;

    app.global_shortcut().on_shortcut(shortcut, on_quick_shortcut)?;

    Ok(())
}

// --- Main Entry Point ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState::default();

    tauri::Builder::default()
        .manage(state)
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .invoke_handler(tauri::generate_handler![
            proxy_request,
            capture_screen,
            ocr_image,
            check_ocr_dependencies,
            install_ocr_dependencies,
            show_ocr_install_prompt,
            update_shortcut,
            set_proxy,
            set_auto_launch,
            get_auto_launch,
            resize_quick_window,
            resize_main_window,
            quick_window_ready,
            close_quick_window,
        ])
        .setup(|app| {
            let start_hidden = should_start_hidden();

            // Setup tray
            if let Err(e) = setup_tray(app.handle()) {
                log::error!("Failed to setup tray: {}", e);
            }

            // Setup global shortcut
            let state = app.state::<AppState>();
            if let Err(e) = setup_global_shortcut(app.handle(), &state) {
                log::error!("Failed to setup global shortcut: {}", e);
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
            // Hide quick window on blur
            if window.label() == "quick" {
                if let tauri::WindowEvent::Focused(false) = event {
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
