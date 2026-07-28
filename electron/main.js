/**
 * Electron main process — the backend for Ubuntu 18.04-20.04 and any host
 * without webkit2gtk-4.1.
 *
 * PARITY: this mirrors src-tauri/src/lib.rs section by section, on purpose.
 * Same commands, same names, same semantics. When you change one backend,
 * change the other in the same commit (see AGENTS.md) and re-run the parity
 * checklist in .project-steward/VERIFY.md.
 */
import {
  app, BrowserWindow, ipcMain, net, shell, globalShortcut, clipboard,
  screen, Tray, Menu, nativeImage, session, dialog,
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import {
  checkTesseract, checkScreenshotTool, installedTesseractLangs, OCR_DESIRED_LANGS,
} from './dependencyChecker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- State (mirrors Rust AppState) ---
let mainWindow = null;
let quickWindow = null;
let tray = null;
let isQuitting = false;
let currentShortcut = 'CommandOrControl+Shift+X';
let proxySettings = null;
/** True once the quick webview registered its quick-translate-text listener. */
let quickReady = false;
/** Text captured by the hotkey before the quick webview was ready. */
let pendingQuickText = null;
let waylandWarned = false;

const isDev = () => !app.isPackaged;

/**
 * Icons come from src-tauri/icons so both backends ship identical artwork —
 * icon.png is the same file the Tauri tray embeds.
 */
function getResourcePath(relativePath) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icons', relativePath)
    : path.join(__dirname, '../src-tauri/icons', relativePath);
}

function rendererUrl(query = '') {
  if (isDev()) return `http://localhost:5173${query}`;
  return `file://${path.join(__dirname, '../dist/index.html')}${query}`;
}

// --- Autostart (unchanged from the pre-Tauri implementation) ---

function getAutoLaunchExecPath() {
  if (process.platform === 'linux' && process.env.APPIMAGE) return process.env.APPIMAGE;
  return process.execPath;
}

function getAutoLaunchArgs() {
  const args = [];
  if (!app.isPackaged) args.push(app.getAppPath());
  args.push('--hidden');
  return args;
}

function formatDesktopExec(execPath, args) {
  const quoteIfNeeded = (value) => (/[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);
  return [execPath, ...args].map(quoteIfNeeded).join(' ');
}

function linuxAutostartPath() {
  return path.join(app.getPath('appData'), 'autostart', 'LightTranslator.desktop');
}

function setLinuxAutoLaunch(enabled) {
  const desktopFilePath = linuxAutostartPath();
  if (!enabled) {
    if (fs.existsSync(desktopFilePath)) fs.unlinkSync(desktopFilePath);
    return;
  }
  fs.mkdirSync(path.dirname(desktopFilePath), { recursive: true });
  const iconPath = getResourcePath('icon.png');
  const desktopEntry = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=LightTranslator',
    'Comment=LightTranslator startup entry',
    `Exec=${formatDesktopExec(getAutoLaunchExecPath(), getAutoLaunchArgs())}`,
    `Icon=${fs.existsSync(iconPath) ? iconPath : 'lighttranslator'}`,
    'Terminal=false',
    'Categories=Utility;',
    'X-GNOME-Autostart-enabled=true',
    'StartupWMClass=LightTranslator',
    '',
  ].join('\n');
  fs.writeFileSync(desktopFilePath, desktopEntry, { encoding: 'utf8' });
}

function setAutoLaunch(enabled) {
  if (process.platform === 'linux') return setLinuxAutoLaunch(enabled);
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    path: getAutoLaunchExecPath(),
    args: getAutoLaunchArgs(),
  });
}

function getAutoLaunch() {
  if (process.platform === 'linux') return fs.existsSync(linuxAutostartPath());
  try {
    return Boolean(app.getLoginItemSettings()?.openAtLogin);
  } catch {
    return false;
  }
}

function shouldStartHidden() {
  if (process.argv.includes('--hidden') || process.argv.includes('--autostart')) return true;
  try {
    return Boolean(app.getLoginItemSettings()?.wasOpenedAsHidden);
  } catch {
    return false;
  }
}

/** Selection capture relies on X11 tools (xdotool); warn once per run on Wayland. */
function warnIfWayland() {
  if (waylandWarned) return;
  if ((process.env.XDG_SESSION_TYPE || '').toLowerCase() !== 'wayland') return;
  waylandWarned = true;
  console.warn('Wayland session detected: xdotool-based selection capture may not work');
  dialog.showMessageBox({
    type: 'warning',
    title: 'Wayland session detected',
    message:
      'Quick Translate captures the selected text with X11 tools (xdotool), which may not ' +
      'work in a Wayland session. The current clipboard content will be translated instead.\n\n' +
      'Tip: copy the text (Ctrl+C) before pressing the shortcut.',
  });
}

// --- Windows ---

function applyContentSecurityPolicy() {
  // Equivalent of tauri.conf.json's csp/devCsp. Provider traffic never leaves
  // the renderer directly — it goes through the proxy-request IPC channel.
  const csp = isDev()
    ? "default-src 'self' http://localhost:5173; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173; " +
      "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; " +
      'connect-src ws://localhost:5173 http://localhost:5173'
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; " +
      "base-uri 'none'; form-action 'none'; frame-src 'none'";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

const webPreferences = () => ({
  preload: path.join(__dirname, 'preload.cjs'),
  nodeIntegration: false,
  contextIsolation: true,
  webSecurity: true,
});

function createMainWindow({ startHidden = false } = {}) {
  const iconPath = getResourcePath('icon.png');
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 400,
    minHeight: 500,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    center: true,
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: webPreferences(),
  });
  mainWindow.label = 'main';

  mainWindow.loadURL(rendererUrl());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Hide to tray instead of closing (matches Tauri's CloseRequested handler)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createQuickWindow() {
  if (quickWindow) return;
  // Sizes mirror tauri.conf.json's "quick" window
  quickWindow = new BrowserWindow({
    width: 500,
    height: 350,
    minWidth: 300,
    minHeight: 80,
    maxWidth: 600,
    maxHeight: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    show: false,
    webPreferences: webPreferences(),
  });
  quickWindow.label = 'quick';

  quickWindow.loadURL(rendererUrl('?mode=quick'));

  quickWindow.on('blur', () => {
    if (quickWindow && !quickWindow.isDestroyed()) quickWindow.hide();
  });

  quickWindow.on('closed', () => {
    quickWindow = null;
    quickReady = false;
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

// --- Quick translate (mirrors trigger_quick_translate) ---

function cursorPosition() {
  return new Promise((resolve) => {
    exec('xdotool getmouselocation --shell', (error, stdout) => {
      if (error) return resolve(screen.getCursorScreenPoint());
      const vars = {};
      stdout.trim().split('\n').forEach((line) => {
        const [key, value] = line.split('=');
        vars[key] = parseInt(value, 10);
      });
      resolve({ x: vars.X || 0, y: vars.Y || 0 });
    });
  });
}

function copySelection() {
  return new Promise((resolve) => {
    // Save and clear first so an empty clipboard afterwards means "nothing was
    // selected" — then the previous content is reused rather than translating
    // whatever happened to be copied earlier.
    const previous = clipboard.readText();
    clipboard.clear();
    exec('xdotool key --clearmodifiers ctrl+c', () => {
      setTimeout(() => {
        const copied = clipboard.readText();
        if (copied && copied.trim()) return resolve(copied);
        if (previous) clipboard.writeText(previous);
        resolve(previous);
      }, 150);
    });
  });
}

async function triggerQuickTranslate() {
  warnIfWayland();

  const { x: cursorX, y: cursorY } = await cursorPosition();
  const text = await copySelection();

  if (!quickWindow || quickWindow.isDestroyed()) createQuickWindow();

  // Clamp so the popup stays on the display under the cursor
  const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY });
  const [winWidth, winHeight] = quickWindow.getSize();
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const x = Math.min(Math.max(cursorX, dx), Math.max(dx, dx + dw - winWidth));
  const y = Math.min(Math.max(cursorY, dy), Math.max(dy, dy + dh - winHeight));

  quickWindow.setPosition(Math.floor(x), Math.floor(y));
  quickWindow.show();
  quickWindow.setAlwaysOnTop(true, 'floating');
  quickWindow.focus();

  if (!text || !text.trim()) return;

  if (quickReady) {
    setTimeout(() => {
      if (quickWindow && !quickWindow.isDestroyed()) {
        quickWindow.webContents.send('quick-translate-text', text);
      }
    }, 100);
  } else {
    // Webview not mounted yet; quick-window-ready delivers this
    pendingQuickText = text;
  }
}

/**
 * Register a shortcut transactionally: validate and register the new one
 * BEFORE releasing the old, so a bad accelerator never leaves the app with no
 * hotkey at all (mirrors update_shortcut).
 */
function registerShortcut(accelerator) {
  if (accelerator === currentShortcut && globalShortcut.isRegistered(accelerator)) {
    return { success: true };
  }
  let registered = false;
  try {
    registered = globalShortcut.register(accelerator, triggerQuickTranslate);
  } catch (error) {
    return { success: false, message: `Invalid shortcut '${accelerator}': ${error.message}` };
  }
  if (!registered) {
    return { success: false, message: `Failed to register '${accelerator}' (already in use?)` };
  }
  if (currentShortcut && currentShortcut !== accelerator) {
    try { globalShortcut.unregister(currentShortcut); } catch { /* best effort */ }
  }
  currentShortcut = accelerator;
  return { success: true };
}

// --- Tray (labels and ids mirror setup_tray) ---

function createTray() {
  // Same source icon as the Tauri tray, scaled for the tray area
  const image = nativeImage
    .createFromPath(getResourcePath('icon.png'))
    .resize({ width: 22, height: 22 });

  tray = new Tray(image);
  tray.setToolTip('LightTranslator');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show LightTranslator', click: () => showMainWindow() },
    {
      label: 'Settings',
      click: () => {
        showMainWindow();
        mainWindow?.webContents.send('open-settings');
      },
    },
    { label: 'OCR Screenshot', click: () => trayOcr() },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => {
    if (mainWindow?.isVisible()) mainWindow.hide();
    else showMainWindow();
  });
}

async function trayOcr() {
  // Missing components open the guidance popup instead of failing silently
  const [tesseract, screenshotTool] = await Promise.all([checkTesseract(), checkScreenshotTool()]);
  if (!tesseract.installed || !screenshotTool) {
    showMainWindow();
    mainWindow?.webContents.send('ocr-deps-missing');
    return;
  }
  const capture = await captureScreen();
  if (!capture.success || !capture.data) return;
  const ocr = await ocrImage(capture.data);
  if (ocr.success && ocr.text) {
    showMainWindow();
    mainWindow?.webContents.send('ocr-result', ocr.text);
  }
}

// --- OCR helpers (mirror capture_screen / ocr_image) ---

function tempPath(suffix) {
  return path.join(os.tmpdir(), `lighttranslator-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
}

function captureScreen() {
  return new Promise((resolve) => {
    const file = tempPath('.png');
    const wasVisible = Boolean(mainWindow?.isVisible());
    if (wasVisible) mainWindow.hide();

    setTimeout(() => {
      exec(`gnome-screenshot -a -f "${file}"`, (error) => {
        if (wasVisible) mainWindow?.show();
        if (error) {
          // User cancelled, or the tool is missing
          if (!fs.existsSync(file)) {
            const missing = /not found|ENOENT/i.test(error.message);
            return resolve(missing
              ? { success: false, error: `OCR_DEPS_MISSING: ${error.message}` }
              : { success: false, cancelled: true });
          }
        }
        if (!fs.existsSync(file)) return resolve({ success: false, cancelled: true });
        try {
          const data = fs.readFileSync(file).toString('base64');
          fs.unlinkSync(file);
          resolve({ success: true, data: `data:image/png;base64,${data}` });
        } catch (readError) {
          resolve({ success: false, error: readError.message });
        }
      });
    }, 200);
  });
}

async function ocrImage(base64Image) {
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const file = tempPath('.png');

  // tesseract aborts if ANY requested language pack is absent, so ask only for
  // what is installed (mirrors the Rust language intersection).
  const installed = await installedTesseractLangs();
  const desired = OCR_DESIRED_LANGS.filter((lang) => installed.includes(lang));
  const langs = desired.length ? desired : installed;
  if (!langs.length) {
    return { success: false, error: 'OCR_DEPS_MISSING: no tesseract language data installed' };
  }

  try {
    fs.writeFileSync(file, Buffer.from(base64Data, 'base64'));
  } catch (error) {
    return { success: false, error: error.message };
  }

  return new Promise((resolve) => {
    exec(`tesseract "${file}" stdout -l ${langs.join('+')} 2>/dev/null`, (error, stdout) => {
      try { fs.unlinkSync(file); } catch { /* already gone */ }
      if (error) {
        const missing = /not found|ENOENT/i.test(error.message);
        return resolve({
          success: false,
          error: missing ? `OCR_DEPS_MISSING: ${error.message}` : error.message,
        });
      }
      // Raw layout: utils/textUtils.cleanTextLineBreaks reflows it in shared code
      resolve({ success: true, text: (stdout || '').trim() });
    });
  });
}

// --- OCR install guidance (mirrors get_ocr_install_guidance) ---

function detectLinuxPackageManager() {
  let content = '';
  try { content = fs.readFileSync('/etc/os-release', 'utf8'); } catch { return null; }
  let id = '';
  let idLike = '';
  content.split('\n').forEach((line) => {
    if (line.startsWith('ID=')) id = line.slice(3).replace(/"/g, '').toLowerCase();
    else if (line.startsWith('ID_LIKE=')) idLike = line.slice(8).replace(/"/g, '').toLowerCase();
  });
  const hay = `${id} ${idLike}`;
  if (hay.includes('debian') || hay.includes('ubuntu')) return 'apt';
  if (hay.includes('fedora') || hay.includes('rhel') || hay.includes('centos')) return 'dnf';
  if (hay.includes('arch')) return 'pacman';
  if (hay.includes('suse')) return 'zypper';
  return null;
}

function langPackage(manager, lang) {
  switch (manager) {
    case 'apt': return `tesseract-ocr-${lang.replace('_', '-')}`;
    case 'dnf': return `tesseract-langpack-${lang}`;
    case 'pacman': return `tesseract-data-${lang}`;
    case 'zypper': {
      const names = {
        chi_sim: 'chinese_simplified', chi_tra: 'chinese_traditional',
        eng: 'english', jpn: 'japanese', kor: 'korean',
      };
      return `tesseract-ocr-traineddata-${names[lang] || lang}`;
    }
    default: return lang;
  }
}

async function getOcrInstallGuidance() {
  const tesseract = await checkTesseract();
  const screenshotTool = await checkScreenshotTool();
  const missingLangs = tesseract.installed
    ? OCR_DESIRED_LANGS.filter((lang) => !tesseract.languages.includes(lang))
    : [...OCR_DESIRED_LANGS];

  const missing = [];
  if (!tesseract.installed) missing.push('Tesseract OCR engine');
  if (missingLangs.length) missing.push(`Language data: ${missingLangs.join(', ')}`);
  if (!screenshotTool && process.platform === 'linux') missing.push('gnome-screenshot (area capture)');

  const commands = [];
  let packageManager = null;
  let osName = 'linux';

  if (process.platform === 'darwin') {
    osName = 'macos';
    if (!tesseract.installed || missingLangs.length) {
      packageManager = 'brew';
      commands.push('brew install tesseract tesseract-lang');
    }
  } else if (process.platform === 'win32') {
    osName = 'windows';
    if (!tesseract.installed || missingLangs.length) {
      packageManager = 'winget';
      commands.push('winget install UB-Mannheim.TesseractOCR');
    }
  } else if (missing.length) {
    const manager = detectLinuxPackageManager();
    if (manager) {
      packageManager = manager;
      const packages = [];
      if (!tesseract.installed) {
        packages.push(manager === 'apt' || manager === 'zypper' ? 'tesseract-ocr' : 'tesseract');
      }
      missingLangs.forEach((lang) => packages.push(langPackage(manager, lang)));
      if (!screenshotTool) packages.push('gnome-screenshot');
      const verb = {
        apt: 'sudo apt install', dnf: 'sudo dnf install',
        pacman: 'sudo pacman -S', zypper: 'sudo zypper install',
      }[manager];
      commands.push(`${verb} ${packages.join(' ')}`);
    } else {
      commands.push(
        "Install 'tesseract-ocr' (with the language data you need) and 'gnome-screenshot' " +
        "using your distribution's package manager"
      );
    }
  }

  return { os: osName, packageManager, missing, commands };
}

// --- Proxy ---

function proxyUrl(settings) {
  return `${settings.protocol}://${settings.host}:${settings.port}`;
}

async function applyProxy(settings) {
  if (!settings || !settings.enabled || !settings.host) {
    await session.defaultSession.setProxy({ mode: 'direct' });
    return;
  }
  await session.defaultSession.setProxy({
    proxyRules: proxyUrl(settings),
    proxyBypassRules: 'localhost,127.0.0.1',
  });
}

// Proxy credentials (Electron asks for them via this event)
app.on('login', (event, _webContents, _details, authInfo, callback) => {
  if (authInfo.isProxy && proxySettings?.username) {
    event.preventDefault();
    callback(proxySettings.username, proxySettings.password || '');
  }
});

// --- IPC: same command names as the Tauri backend ---

ipcMain.handle('proxy-request', async (_event, url, options = {}) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    return { ok: false, error: `Invalid URL: ${error.message}` };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: `Unsupported URL scheme '${parsed.protocol.replace(':', '')}'` };
  }

  return new Promise((resolve) => {
    const request = net.request({ method: (options.method || 'GET').toUpperCase(), url });
    Object.entries(options.headers || {}).forEach(([key, value]) => request.setHeader(key, value));

    // Match the Rust client's 60s overall timeout
    const timer = setTimeout(() => {
      request.abort();
      resolve({ ok: false, error: 'Request timed out after 60s' });
    }, 60000);

    request.on('response', (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk.toString(); });
      response.on('end', () => {
        clearTimeout(timer);
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          statusCode: response.statusCode,
          data: body,
        });
      });
      response.on('error', (error) => {
        clearTimeout(timer);
        resolve({ ok: false, statusCode: response.statusCode, error: `Failed to read response body: ${error.message}` });
      });
    });

    request.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });

    if (options.body) request.write(options.body);
    request.end();
  });
});

ipcMain.handle('capture-screen', () => captureScreen());
ipcMain.handle('ocr-image', (_event, base64Image) => ocrImage(base64Image));

ipcMain.handle('check-ocr-dependencies', async () => {
  const tesseract = await checkTesseract();
  const screenshotTool = await checkScreenshotTool();
  return {
    tesseractInstalled: tesseract.installed,
    tesseractVersion: tesseract.version,
    languages: tesseract.languages,
    gnomeScreenshotInstalled: screenshotTool,
  };
});

ipcMain.handle('get-ocr-install-guidance', () => getOcrInstallGuidance());

ipcMain.handle('update-shortcut', (_event, shortcut) => registerShortcut(shortcut));

ipcMain.handle('set-proxy', async (_event, settings) => {
  proxySettings = settings;
  try {
    await applyProxy(settings);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('set-auto-launch', (_event, enabled) => {
  try {
    setAutoLaunch(enabled);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-auto-launch', () => ({ success: true, enabled: getAutoLaunch() }));

ipcMain.handle('resize-quick-window', (_event, { width, height }) => {
  if (quickWindow && !quickWindow.isDestroyed()) {
    quickWindow.setSize(Math.round(width), Math.round(height));
  }
  return { success: true };
});

ipcMain.handle('resize-main-window', (_event, { width, height }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSize(Math.round(width), Math.round(height));
  }
  return { success: true };
});

ipcMain.on('quick-window-ready', (event) => {
  // The webview now has a live listener; deliver any text the hotkey captured
  // before it was ready. Deliberately does NOT read the clipboard — doing so
  // fired an unsolicited translation at every launch.
  quickReady = true;
  if (pendingQuickText) {
    event.sender.send('quick-translate-text', pendingQuickText);
    pendingQuickText = null;
  }
});

ipcMain.on('close-quick-window', () => {
  if (quickWindow && !quickWindow.isDestroyed()) quickWindow.hide();
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow?.hide());

// Cross-window settings sync: forward to the OTHER window only, so a sender
// never reacts to its own change (Tauri gets this from emitTo).
ipcMain.on('settings-changed', (event) => {
  const sender = BrowserWindow.fromWebContents(event.sender);
  const senderLabel = sender?.label || 'unknown';
  [mainWindow, quickWindow].forEach((win) => {
    if (win && !win.isDestroyed() && win !== sender) {
      win.webContents.send('settings-changed', senderLabel);
    }
  });
});

// --- Lifecycle ---

app.whenReady().then(() => {
  applyContentSecurityPolicy();
  createMainWindow({ startHidden: shouldStartHidden() });
  createQuickWindow();
  createTray();

  if (!globalShortcut.register(currentShortcut, triggerQuickTranslate)) {
    console.error(`Failed to register global shortcut ${currentShortcut}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => { isQuitting = true; });

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// The app lives in the tray; closing windows must not quit it.
app.on('window-all-closed', () => {});
