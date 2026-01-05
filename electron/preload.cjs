const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded (CommonJS)');

contextBridge.exposeInMainWorld('electron', {
  // Expose a method to make requests via Main Process (Node.js)
  // This is critical for Google Translate GTX which has CORS issues in Renderer
  request: (url, options) => ipcRenderer.invoke('proxy-request', url, options),
  
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Quick Translate
  onQuickTranslate: (callback) => ipcRenderer.on('quick-translate-text', (event, text) => callback(text)),
  sendQuickReady: () => ipcRenderer.send('quick-window-ready'),
  closeQuickWindow: () => ipcRenderer.send('close-quick-window'),

  // Settings from tray
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', () => callback()),

  // Screenshot for OCR
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // OCR with Tesseract (local)
  ocrImage: (base64Image) => ipcRenderer.invoke('ocr-image', base64Image),

  // OCR result from tray menu
  onOcrResult: (callback) => ipcRenderer.on('ocr-result', (event, text) => callback(text)),

  // Proxy settings
  setProxy: (settings) => ipcRenderer.invoke('set-proxy', settings),

  // Shortcut settings
  updateShortcut: (shortcut) => ipcRenderer.invoke('update-shortcut', shortcut),

  // Auto-launch settings
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),

  // Quick window resize (for dynamic sizing)
  resizeQuickWindow: (dimensions) => ipcRenderer.invoke('resize-quick-window', dimensions),

  // OCR dependency management
  checkOcrDependencies: () => ipcRenderer.invoke('check-ocr-dependencies'),
  installOcrDependencies: () => ipcRenderer.invoke('install-ocr-dependencies'),
  showOcrInstallPrompt: (message) => ipcRenderer.invoke('show-ocr-install-prompt', message),
  onOcrInstallProgress: (callback) => ipcRenderer.on('ocr-install-progress', (event, progress) => callback(progress))
});