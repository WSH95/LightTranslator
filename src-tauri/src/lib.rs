use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

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
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_shortcut: Mutex::new("CommandOrControl+Shift+X".to_string()),
            proxy_settings: Mutex::new(None),
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
    let client = {
        let proxy_settings = state.proxy_settings.lock().unwrap();
        if let Some(ref settings) = *proxy_settings {
            if settings.enabled {
                let proxy_url = format!(
                    "{}://{}:{}",
                    settings.protocol, settings.host, settings.port
                );
                let proxy = reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?;
                reqwest::Client::builder()
                    .proxy(proxy)
                    .build()
                    .map_err(|e| e.to_string())?
            } else {
                reqwest::Client::new()
            }
        } else {
            reqwest::Client::new()
        }
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
            let body = response.text().await.unwrap_or_default();

            // Try to parse as JSON, otherwise return as string
            let data = if body.starts_with('{') || body.starts_with('[') {
                body
            } else {
                body
            };

            Ok(ProxyResponse {
                ok: status.is_success(),
                status_code: Some(status.as_u16()),
                data: Some(data),
                error: None,
            })
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
    // Unregister old shortcut
    {
        let old_shortcut = state.current_shortcut.lock().unwrap();
        if let Ok(old_sc) = old_shortcut.parse::<Shortcut>() {
            let _ = app.global_shortcut().unregister(old_sc);
        }
    }

    // Parse and register new shortcut
    let new_shortcut: Shortcut = shortcut.parse().map_err(|e| format!("{:?}", e))?;

    app.global_shortcut()
        .on_shortcut(new_shortcut.clone(), move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                trigger_quick_translate(app);
            }
        })
        .map_err(|e| e.to_string())?;

    // Update state
    {
        let mut current = state.current_shortcut.lock().unwrap();
        *current = shortcut;
    }

    Ok(true)
}

#[tauri::command]
async fn set_proxy(settings: ProxySettings, state: State<'_, AppState>) -> Result<(), String> {
    let mut proxy = state.proxy_settings.lock().unwrap();
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
async fn quick_window_ready(app: AppHandle) -> Result<(), String> {
    // Get clipboard text
    use tauri_plugin_clipboard_manager::ClipboardExt;

    if let Ok(text) = app.clipboard().read_text() {
        if !text.is_empty() {
            // Emit to quick window
            app.emit_to("quick", "quick-translate-text", text)
                .map_err(|e| e.to_string())?;
        }
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

fn trigger_quick_translate(app: &AppHandle) {
    use tauri_plugin_clipboard_manager::ClipboardExt;

    // Get clipboard content first using xdotool to simulate Ctrl+C
    let _ = Command::new("xdotool")
        .args(["key", "--clearmodifiers", "ctrl+c"])
        .output();

    // Small delay for clipboard to update
    std::thread::sleep(std::time::Duration::from_millis(150));

    // Read the clipboard text
    let clipboard_text = app.clipboard().read_text().unwrap_or_default();

    // Show quick window at cursor position
    if let Some(window) = app.get_webview_window("quick") {
        // Get cursor position using xdotool
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

            let _ = window.set_position(tauri::LogicalPosition::new(x, y));
        }

        let _ = window.show();
        let _ = window.set_focus();

        // On Linux, use xdotool to forcefully activate the window for proper focus
        // This ensures the blur event will fire when clicking outside
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(50));
            // Search for the window by name and activate it
            let _ = Command::new("xdotool")
                .args(["search", "--name", "Quick Translate", "windowactivate"])
                .output();
        });

        // Emit clipboard text to the quick window after a small delay for window to be ready
        if !clipboard_text.is_empty() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(100));
                let _ = app_clone.emit_to("quick", "quick-translate-text", clipboard_text);
            });
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
        let img = image::load_from_memory(icon_bytes)
            .expect("Failed to load tray icon")
            .into_rgba8();
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
                std::process::exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn setup_global_shortcut(app: &AppHandle, state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut_str = state.current_shortcut.lock().unwrap().clone();
    let shortcut: Shortcut = shortcut_str.parse()?;

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                trigger_quick_translate(app);
            }
        })?;

    Ok(())
}

// --- Main Entry Point ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState::default();

    tauri::Builder::default()
        .manage(state)
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_process::init())
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
