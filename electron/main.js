import { app, BrowserWindow, ipcMain, net, shell, globalShortcut, clipboard, screen, Tray, Menu, nativeImage, session, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import { checkAllDependencies, installDependencies, getMissingComponentsMessage } from './dependencyChecker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let quickWindow;
let tray = null;
let lastQuickText = '';
let isQuitting = false;

// Helper function to get resource path (works for both dev and packaged app)
function getResourcePath(relativePath) {
  if (app.isPackaged) {
    // In packaged app, resources are in the 'resources' folder
    return path.join(process.resourcesPath, 'assets', relativePath);
  } else {
    // In development, use the local assets folder
    return path.join(__dirname, '../assets', relativePath);
  }
}

function getAutoLaunchExecPath() {
  if (process.platform === 'linux' && process.env.APPIMAGE) {
    return process.env.APPIMAGE;
  }
  return process.execPath;
}

function getAutoLaunchArgs() {
  const args = [];
  if (!app.isPackaged) {
    args.push(app.getAppPath());
  }
  args.push('--hidden');
  return args;
}

function formatDesktopExec(execPath, args) {
  const quoteIfNeeded = (value) => {
    if (/[\s"]/u.test(value)) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  };

  return [execPath, ...args].map(quoteIfNeeded).join(' ');
}

function getLinuxAutoLaunchEnabled() {
  const autostartDir = path.join(app.getPath('appData'), 'autostart');
  const desktopFilePath = path.join(autostartDir, 'LightTranslator.desktop');
  return fs.existsSync(desktopFilePath);
}

function setLinuxAutoLaunch(enabled) {
  const autostartDir = path.join(app.getPath('appData'), 'autostart');
  const desktopFilePath = path.join(autostartDir, 'LightTranslator.desktop');

  if (!enabled) {
    if (fs.existsSync(desktopFilePath)) {
      fs.unlinkSync(desktopFilePath);
    }
    return;
  }

  fs.mkdirSync(autostartDir, { recursive: true });

  const execPath = getAutoLaunchExecPath();
  const args = getAutoLaunchArgs();
  const execLine = formatDesktopExec(execPath, args);
  const iconPath = getResourcePath('logo.png');
  const iconValue = fs.existsSync(iconPath) ? iconPath : 'lighttranslator';

  const desktopEntry = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=LightTranslator',
    'Comment=LightTranslator startup entry',
    `Exec=${execLine}`,
    `Icon=${iconValue}`,
    'Terminal=false',
    'Categories=Utility;',
    'X-GNOME-Autostart-enabled=true',
    'StartupWMClass=LightTranslator',
    ''
  ].join('\n');

  fs.writeFileSync(desktopFilePath, desktopEntry, { encoding: 'utf8' });
}

function setNativeAutoLaunch(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    path: getAutoLaunchExecPath(),
    args: getAutoLaunchArgs()
  });
}

function setAutoLaunch(enabled) {
  if (process.platform === 'linux') {
    setLinuxAutoLaunch(enabled);
    return;
  }

  setNativeAutoLaunch(enabled);
}

function getAutoLaunch() {
  if (process.platform === 'linux') {
    return getLinuxAutoLaunchEnabled();
  }

  try {
    const loginSettings = app.getLoginItemSettings();
    return Boolean(loginSettings?.openAtLogin);
  } catch (error) {
    console.error('Failed to get login item settings:', error);
    return false;
  }
}

function shouldStartHiddenOnLaunch() {
  if (process.argv.includes('--hidden')) {
    return true;
  }

  try {
    const loginSettings = app.getLoginItemSettings();
    return Boolean(loginSettings?.wasOpenedAsHidden);
  } catch (error) {
    return false;
  }
}

function createQuickWindow() {
  if (quickWindow) return;

  quickWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    minWidth: 200,
    minHeight: 100,
    maxWidth: 600,
    maxHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Fix: Use localhost in dev mode to ensure React loads correctly
  const isDev = !app.isPackaged;
  if (isDev) {
    quickWindow.loadURL('http://localhost:5173?mode=quick');
  } else {
    quickWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { mode: 'quick' }
    });
  }
    
  console.log('Loading Quick Window, isDev:', isDev);

  // Wait for the window to be ready before showing (optional, but good practice)
  quickWindow.once('ready-to-show', () => {
    // Don't show yet, wait for trigger
  });

  quickWindow.on('blur', () => {
    quickWindow.hide();
  });

  quickWindow.on('closed', () => {
    quickWindow = null;
  });
  
  // DEBUG: Open DevTools to diagnose blank screen
  // quickWindow.webContents.openDevTools({ mode: 'detach' });
}

function createWindow({ startHidden = false } = {}) {
  const iconPath = getResourcePath('logo.png');
  
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 400,
    minHeight: 500,
    icon: iconPath, // Set window icon
    titleBarStyle: 'hidden', // Makes it look like the BetterDisplay design (frameless)
    show: !startHidden,
    // titleBarOverlay: {
    //   color: 'rgba(0,0,0,0)', // Transparent
    //   symbolColor: '#4c4c4c',
    //   height: 40 // Height of the draggable area
    // },
    // trafficLightPosition: { x: 16, y: 16 }, // Custom traffic light position for macOS
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Optional: helpful for some image loading, use with care
    }
  });

  // Load the React app
  // In dev: 'http://localhost:5173'
  // In prod: load from dist folder
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  if (startHidden) {
    mainWindow.once('ready-to-show', () => {
      if (mainWindow) mainWindow.hide();
    });
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// Create System Tray
function createTray() {
  // Load tray icon from the new logo
  const iconPath = getResourcePath('tray-icon.png');
  let trayIcon = nativeImage.createFromPath(iconPath);
  
  // Resize for Linux (recommended 22x22)
  if (!trayIcon.isEmpty()) {
    trayIcon = trayIcon.resize({ width: 22, height: 22 });
  }

  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开面板',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: '划词翻译',
      sublabel: 'Ctrl+Shift+X',
      enabled: false
    },
    {
      label: '截图OCR',
      click: () => {
        // Trigger screenshot OCR directly
        triggerScreenshotOCR();
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          // Send event to open settings
          mainWindow.webContents.send('open-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('LightTranslator');
  tray.setContextMenu(contextMenu);

  // Click on tray icon to show/hide main window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// IPC Handler for Proxy Requests (Bypass CORS)
ipcMain.handle('proxy-request', async (event, url, options = {}) => {
  return new Promise((resolve, reject) => {
    const { method = 'GET', headers = {}, body = null } = options;
    
    const request = net.request({
      url,
      method,
      headers
    });

    request.on('response', (response) => {
      let responseBody = '';
      response.on('data', (chunk) => {
        responseBody += chunk.toString();
      });
      response.on('end', () => {
        try {
            resolve({ 
              ok: response.statusCode >= 200 && response.statusCode < 300, 
              statusCode: response.statusCode,
              data: JSON.parse(responseBody) 
            });
        } catch (e) {
            resolve({ 
              ok: response.statusCode >= 200 && response.statusCode < 300, 
              statusCode: response.statusCode,
              data: responseBody 
            });
        }
      });
    });

    request.on('error', (error) => {
      console.error('Proxy Request Error:', error);
      reject(error);
    });

    if (body) {
      request.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    
    request.end();
  });
});

// Window Control IPC Handlers
ipcMain.on('window-minimize', () => {
  console.log('Main: window-minimize received');
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  console.log('Main: window-maximize received');
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  console.log('Main: window-close received');
  if (mainWindow) mainWindow.hide(); // Hide to tray instead of closing
});

ipcMain.on('close-quick-window', () => {
  if (quickWindow) quickWindow.hide();
});

// Dynamic resize for quick window based on content
ipcMain.handle('resize-quick-window', async (event, { width, height }) => {
  if (quickWindow) {
    const currentBounds = quickWindow.getBounds();
    // Constrain to min/max
    const newWidth = Math.max(200, Math.min(600, width));
    const newHeight = Math.max(100, Math.min(500, height));
    quickWindow.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: newWidth,
      height: newHeight
    });
    return { success: true, width: newWidth, height: newHeight };
  }
  return { success: false };
});

ipcMain.on('quick-window-ready', () => {
  if (quickWindow && lastQuickText) {
    quickWindow.webContents.send('quick-translate-text', lastQuickText);
  }
});

// Current shortcut storage
let currentShortcut = 'CommandOrControl+Shift+X';

// Update global shortcut handler
ipcMain.handle('update-shortcut', async (event, newShortcut) => {
  try {
    // Unregister all shortcuts first
    globalShortcut.unregisterAll();

    // Register the new shortcut
    const success = globalShortcut.register(newShortcut, quickTranslateHandler);

    if (success) {
      currentShortcut = newShortcut;
      console.log('Shortcut updated to:', newShortcut);
      return { success: true, message: 'Shortcut updated' };
    } else {
      // Fallback to old shortcut
      globalShortcut.register(currentShortcut, quickTranslateHandler);
      return { success: false, message: 'Failed to register shortcut. It may be in use by another application.' };
    }
  } catch (error) {
    console.error('Failed to update shortcut:', error);
    // Try to restore old shortcut
    try {
      globalShortcut.register(currentShortcut, quickTranslateHandler);
    } catch (e) {}
    return { success: false, message: error.message };
  }
});

// Auto-launch configuration handler
ipcMain.handle('set-auto-launch', async (event, enabled) => {
  try {
    setAutoLaunch(enabled);
    console.log('Auto-launch set to:', enabled);
    return { success: true, enabled };
  } catch (error) {
    console.error('Failed to set auto-launch:', error);
    return { success: false, message: error.message };
  }
});

// Get current auto-launch state
ipcMain.handle('get-auto-launch', async () => {
  try {
    const enabled = getAutoLaunch();
    return { success: true, enabled };
  } catch (error) {
    console.error('Failed to get auto-launch state:', error);
    return { success: false, enabled: false, message: error.message };
  }
});

// OCR Dependency checking
ipcMain.handle('check-ocr-dependencies', async () => {
  try {
    const result = await checkAllDependencies();
    return {
      success: true,
      ocrAvailable: result.ocrAvailable,
      details: result.details,
      message: getMissingComponentsMessage(result.details)
    };
  } catch (error) {
    console.error('Failed to check OCR dependencies:', error);
    return { success: false, ocrAvailable: false, message: error.message };
  }
});

// Install OCR dependencies
ipcMain.handle('install-ocr-dependencies', async () => {
  try {
    const result = await installDependencies((progress) => {
      // Send progress updates to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ocr-install-progress', progress);
      }
    });

    // Re-check dependencies after installation
    const checkResult = await checkAllDependencies();

    return {
      success: result.success,
      ocrAvailable: checkResult.ocrAvailable,
      message: result.message,
      details: checkResult.details
    };
  } catch (error) {
    console.error('Failed to install OCR dependencies:', error);
    return { success: false, ocrAvailable: false, message: error.message };
  }
});

// Show OCR install prompt dialog
ipcMain.handle('show-ocr-install-prompt', async (event, missingMessage) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Install Now', 'Skip'],
    defaultId: 0,
    cancelId: 1,
    title: 'OCR Components Missing',
    message: 'Required OCR components are missing',
    detail: `${missingMessage}\n\nWould you like to install them now? This may require administrator privileges.`
  });

  return { install: result.response === 0 };
});

// Proxy configuration handler
ipcMain.handle('set-proxy', async (event, proxySettings) => {
  try {
    if (!proxySettings.enabled || !proxySettings.host) {
      // Disable proxy
      await session.defaultSession.setProxy({ mode: 'direct' });
      console.log('Proxy disabled');
      return { success: true, message: 'Proxy disabled' };
    }

    // Build proxy URL
    let proxyUrl = '';
    const { protocol, host, port, username, password } = proxySettings;

    if (username && password) {
      proxyUrl = `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
    } else {
      proxyUrl = `${protocol}://${host}:${port}`;
    }

    // Set proxy based on protocol
    const proxyRules = protocol === 'socks5'
      ? `socks5://${host}:${port}`
      : proxyUrl;

    await session.defaultSession.setProxy({
      proxyRules: proxyRules,
      proxyBypassRules: 'localhost,127.0.0.1'
    });

    console.log('Proxy configured:', proxyRules);
    return { success: true, message: 'Proxy configured' };
  } catch (error) {
    console.error('Failed to set proxy:', error);
    return { success: false, message: error.message };
  }
});

// Screenshot capture for OCR
ipcMain.handle('capture-screen', async () => {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
    
    // Hide main window temporarily so it's not in the screenshot
    if (mainWindow) {
      mainWindow.hide();
    }
    
    // Small delay to ensure window is hidden
    setTimeout(() => {
      // Use gnome-screenshot for area selection
      exec(`gnome-screenshot -a -f "${tempFile}"`, (error) => {
        // Show main window again
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
        
        if (error) {
          console.error('Screenshot error:', error);
          // User might have cancelled
          resolve({ success: false, cancelled: true });
          return;
        }
        
        // Check if file was created (user didn't cancel)
        if (fs.existsSync(tempFile)) {
          try {
            const imageData = fs.readFileSync(tempFile);
            const base64 = `data:image/png;base64,${imageData.toString('base64')}`;
            fs.unlinkSync(tempFile); // Clean up temp file
            resolve({ success: true, data: base64 });
          } catch (readError) {
            console.error('Failed to read screenshot:', readError);
            resolve({ success: false, error: readError.message });
          }
        } else {
          resolve({ success: false, cancelled: true });
        }
      });
    }, 200);
  });
});

// Clean up OCR text - remove unwanted line breaks within paragraphs
function cleanOcrText(text) {
  if (!text) return '';
  
  // Split into lines
  const lines = text.split('\n');
  const result = [];
  let currentParagraph = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Empty line means paragraph break
    if (!line) {
      if (currentParagraph) {
        result.push(currentParagraph.trim());
        currentParagraph = '';
      }
      continue;
    }
    
    // Check if previous line ended with sentence-ending punctuation
    const prevEndsWithPunctuation = currentParagraph && 
      /[.!?。！？；;:：）)】」』"']$/.test(currentParagraph.trim());
    
    // Check if current line starts with a capital letter or Chinese character (might be new paragraph)
    const startsNewSentence = /^[A-Z\u4e00-\u9fff]/.test(line);
    
    // If previous line ended with punctuation and current starts with capital, might be new paragraph
    // But only if the previous line was reasonably long (not just a short title)
    if (prevEndsWithPunctuation && startsNewSentence && currentParagraph.length > 50) {
      result.push(currentParagraph.trim());
      currentParagraph = line;
    } else if (currentParagraph) {
      // Continue the same paragraph - join with space for English, no space for CJK
      const lastChar = currentParagraph.slice(-1);
      const firstChar = line.charAt(0);
      
      // Check if both are CJK characters (no space needed)
      const isCJK = (char) => /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char);
      
      if (isCJK(lastChar) || isCJK(firstChar)) {
        currentParagraph += line;
      } else {
        // Add space for non-CJK (English, etc.)
        currentParagraph += ' ' + line;
      }
    } else {
      currentParagraph = line;
    }
  }
  
  // Don't forget the last paragraph
  if (currentParagraph) {
    result.push(currentParagraph.trim());
  }
  
  return result.join('\n\n');
}

// OCR using Tesseract (local)
ipcMain.handle('ocr-image', async (event, base64Image) => {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(os.tmpdir(), `ocr-${Date.now()}.png`);
    
    try {
      // Remove data URL prefix if present
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(tempFile, imageBuffer);
      
      // Run Tesseract with multiple languages (chi_sim+chi_tra+eng+jpn+kor)
      exec(`tesseract "${tempFile}" stdout -l chi_sim+chi_tra+eng+jpn+kor 2>/dev/null`, (error, stdout, stderr) => {
        // Clean up temp file
        try { fs.unlinkSync(tempFile); } catch (e) {}
        
        if (error) {
          console.error('Tesseract error:', error);
          resolve({ success: false, error: error.message });
          return;
        }
        
        const rawText = stdout.trim();
        if (rawText) {
          // Clean up the OCR text to remove unwanted line breaks
          const cleanedText = cleanOcrText(rawText);
          resolve({ success: true, text: cleanedText });
        } else {
          resolve({ success: false, error: 'No text detected in image' });
        }
      });
    } catch (err) {
      try { fs.unlinkSync(tempFile); } catch (e) {}
      resolve({ success: false, error: err.message });
    }
  });
});

// Screenshot OCR triggered from tray menu
function triggerScreenshotOCR() {
  const tempFile = path.join(os.tmpdir(), `screenshot-ocr-${Date.now()}.png`);
  
  // Use gnome-screenshot for area selection
  exec(`gnome-screenshot -a -f "${tempFile}"`, (error) => {
    if (error) {
      console.error('Screenshot error:', error);
      return;
    }
    
    // Check if file was created (user didn't cancel)
    if (fs.existsSync(tempFile)) {
      try {
        const imageData = fs.readFileSync(tempFile);
        const base64 = `data:image/png;base64,${imageData.toString('base64')}`;
        fs.unlinkSync(tempFile); // Clean up temp file
        
        // Run Tesseract OCR
        const ocrTempFile = path.join(os.tmpdir(), `ocr-tray-${Date.now()}.png`);
        fs.writeFileSync(ocrTempFile, imageData);
        
        exec(`tesseract "${ocrTempFile}" stdout -l chi_sim+chi_tra+eng+jpn+kor 2>/dev/null`, (ocrError, stdout) => {
          try { fs.unlinkSync(ocrTempFile); } catch (e) {}
          
          if (ocrError) {
            console.error('Tesseract error:', ocrError);
            return;
          }
          
          const rawText = stdout.trim();
          if (rawText) {
            // Clean up the OCR text to remove unwanted line breaks
            const extractedText = cleanOcrText(rawText);
            // Show main window and send OCR result
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
              mainWindow.webContents.send('ocr-result', extractedText);
            }
          }
        });
      } catch (readError) {
        console.error('Failed to read screenshot:', readError);
      }
    }
  });
}

// Quick Translate Handler - extracted as a named function for dynamic shortcut updates
const quickTranslateHandler = () => {
  // Use xdotool to get REAL mouse position (Electron's screen API is unreliable on some Linux setups)
  exec('xdotool getmouselocation --shell', (error, stdout) => {
      if (error) {
        console.error('xdotool getmouselocation error:', error);
        return;
      }
      
      // Parse xdotool output: X=1234\nY=567\nSCREEN=0\nWINDOW=...
      const lines = stdout.trim().split('\n');
      const vars = {};
      lines.forEach(line => {
        const [key, value] = line.split('=');
        vars[key] = parseInt(value, 10);
      });
      
      const mouseX = vars.X || 0;
      const mouseY = vars.Y || 0;
      console.log('Real mouse position from xdotool:', mouseX, mouseY);
      
      // Now copy the selected text
      const oldText = clipboard.readText();
      clipboard.clear();

      exec('xdotool key ctrl+c', (copyError) => {
        if (copyError) {
          console.error('xdotool copy error:', copyError);
        }

        setTimeout(() => {
          let text = clipboard.readText();
          
          if (!text) {
             text = oldText; 
          }

          if (text && text.trim()) {
            lastQuickText = text;
            
            // Find which display the mouse is on
            const allDisplays = screen.getAllDisplays();
            let targetDisplay = allDisplays[0];
            
            for (const disp of allDisplays) {
              const { x, y, width, height } = disp.bounds;
              if (mouseX >= x && mouseX < x + width && mouseY >= y && mouseY < y + height) {
                targetDisplay = disp;
                break;
              }
            }
            
            console.log('Target display:', targetDisplay.id, targetDisplay.bounds);

            // Calculate position (bottom-right of cursor)
            let x = mouseX + 15;
            let y = mouseY + 15;

            const winWidth = 400;
            const winHeight = 300;
            const { x: dx, y: dy, width: dw, height: dh } = targetDisplay.bounds;
            
            // Check right edge
            if (x + winWidth > dx + dw) {
              x = dx + dw - winWidth - 10;
            }
            
            // Check bottom edge
            if (y + winHeight > dy + dh) {
              y = dy + dh - winHeight - 10;
            }

            // Ensure it doesn't go off-screen left/top
            if (x < dx) x = dx + 10;
            if (y < dy) y = dy + 10;

            x = Math.floor(x);
            y = Math.floor(y);

            console.log('Final position to set:', { x, y });
            
            // Destroy old window
            if (quickWindow) {
              quickWindow.destroy();
              quickWindow = null;
            }
            
            // Create window at exact position
            quickWindow = new BrowserWindow({
              x: x,
              y: y,
              width: winWidth,
              height: winHeight,
              frame: false,
              alwaysOnTop: true,
              show: true,
              skipTaskbar: true,
              resizable: true,
              movable: true,
              useContentSize: false,
              minWidth: 200,
              minHeight: 100,
              maxWidth: 600,
              maxHeight: 500,
              webPreferences: {
                preload: path.join(__dirname, 'preload.cjs'),
                nodeIntegration: false,
                contextIsolation: true,
              }
            });
            
            // Force position after creation
            quickWindow.setBounds({ x, y, width: winWidth, height: winHeight });

            const isDev = !app.isPackaged;
            const baseUrl = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../dist/index.html')}`;
            const startUrl = `${baseUrl}?mode=quick`;
            quickWindow.loadURL(startUrl);
            
            quickWindow.on('blur', () => {
              if (quickWindow) quickWindow.hide();
            });

            quickWindow.on('closed', () => {
              quickWindow = null;
            });
            
            quickWindow.webContents.once('did-finish-load', () => {
              quickWindow.setBounds({ x, y, width: winWidth, height: winHeight });
              quickWindow.setAlwaysOnTop(true, 'floating');
              quickWindow.focus();
              quickWindow.webContents.send('quick-translate-text', text);
            });
          }
        }, 100);
      });
    });
};

app.whenReady().then(() => {
  const startHidden = shouldStartHiddenOnLaunch();
  createWindow({ startHidden });
  createQuickWindow();
  createTray();

  // Register Global Shortcut for Quick Translate
  globalShortcut.register(currentShortcut, quickTranslateHandler);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on('window-all-closed', function () {
  // Don't quit when all windows are closed - app lives in tray
  // Only quit via tray menu or before-quit event
});
