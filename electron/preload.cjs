const { contextBridge, ipcRenderer } = require('electron');

// Every on* returns an unsubscribe function. React StrictMode mounts effects
// twice in development, so a listener without a disposer is orphaned and the
// app ends up handling each event more than once.
function subscribe(channel, handler) {
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('electron', {
  // HTTP through the main process (bypasses renderer CORS, applies proxy settings)
  request: (url, options) => ipcRenderer.invoke('proxy-request', url, options),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  onMaximizedChanged: (callback) =>
    subscribe('window-maximized-changed', (_event, maximized) => callback(maximized)),

  // Quick Translate
  onQuickTranslate: (callback) =>
    subscribe('quick-translate-text', (_event, text) => callback(text)),
  sendQuickReady: () => ipcRenderer.send('quick-window-ready'),
  closeQuickWindow: () => ipcRenderer.send('close-quick-window'),
  openInMainWindow: (text) => ipcRenderer.invoke('open-in-main-window', text),

  // Manual window resize (Electron has no compositor-side equivalent)
  beginWindowResize: () => ipcRenderer.send('begin-window-resize'),
  updateWindowResize: (direction, dx, dy) =>
    ipcRenderer.send('update-window-resize', direction, dx, dy),
  onQuickToMain: (callback) =>
    subscribe('quick-to-main', (_event, text) => callback(text)),

  // Settings from tray
  onOpenSettings: (callback) => subscribe('open-settings', () => callback()),

  // Cross-window settings sync (main <-> quick)
  emitSettingsChanged: () => ipcRenderer.send('settings-changed'),
  onSettingsChanged: (callback) =>
    subscribe('settings-changed', (_event, sender) => callback(sender)),

  // Screenshot + OCR
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  ocrImage: (base64Image) => ipcRenderer.invoke('ocr-image', base64Image),
  onOcrResult: (callback) => subscribe('ocr-result', (_event, text) => callback(text)),
  onOcrDepsMissing: (callback) => subscribe('ocr-deps-missing', () => callback()),

  // Settings
  setProxy: (settings) => ipcRenderer.invoke('set-proxy', settings),
  // gnomeBinding is the same accelerator in GTK spelling, used where GNOME
  // owns the key (Wayland); see utils/shortcutUtils.ts
  updateShortcut: (shortcut, gnomeBinding) =>
    ipcRenderer.invoke('update-shortcut', shortcut, gnomeBinding),
  getShortcutStatus: () => ipcRenderer.invoke('get-shortcut-status'),
  getSystemAppearance: () => ipcRenderer.invoke('get-system-appearance'),
  reregisterShortcut: () => ipcRenderer.invoke('reregister-shortcut'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),

  // Window sizing
  resizeQuickWindow: (dimensions) => ipcRenderer.invoke('resize-quick-window', dimensions),
  resizeMainWindow: (dimensions) => ipcRenderer.invoke('resize-main-window', dimensions),

  // OCR dependencies are installed on demand: the app reports what is missing
  // and how to install it, and never runs an elevated installer itself.
  checkOcrDependencies: () => ipcRenderer.invoke('check-ocr-dependencies'),
  getOcrInstallGuidance: () => ipcRenderer.invoke('get-ocr-install-guidance'),
});
