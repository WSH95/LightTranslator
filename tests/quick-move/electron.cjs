const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const output = process.env.QUICK_MOVE_QA_OUTPUT || '/tmp/lighttranslator-quick-move';
fs.mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'lighttranslator-move-qa-')));
app.commandLine.appendSwitch('ozone-platform', 'x11');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  // This fixture verifies renderer geometry. Non-resizable Electron/X11
  // programmatic sizing remains a separate native acceptance issue (PLAN M5).
  const win = new BrowserWindow({ width: 480, height: 220, show: false, frame: false, transparent: true, resizable: true, skipTaskbar: true,
    webPreferences: { sandbox: true, backgroundThrottling: false, preload: path.join(__dirname, 'preload.cjs') } });
  const js = code => win.webContents.executeJavaScript(code, true);
  const nativeResizes = [];
  ipcMain.handle('qa-resize-window', (_event, { width, height }) => {
    win.setSize(width, height);
    nativeResizes.push({ requested: [width, height], bounds: win.getContentBounds() });
  });
  await win.loadURL('http://127.0.0.1:5178/tests/quick-move/fixture.html');
  // Keep frames/layout active without taking focus or intercepting mouse input.
  win.setOpacity(0);
  win.setIgnoreMouseEvents(true);
  win.showInactive();
  for (let i = 0; i < 50 && !(await js('!!window.moveQa')); i++) await pause(100);
  if (await js('typeof window.nativeResize') !== 'function') throw new Error('Missing native resize bridge');
  let checks;
  try {
    checks = await js('moveQa.run()');
  } catch (error) {
    console.error(JSON.stringify({nativeResizes: nativeResizes.slice(-3)}));
    throw error;
  }
  fs.writeFileSync(path.join(output, 'electron.json'), JSON.stringify({engine: process.versions, checks}, null, 2));
  console.log(JSON.stringify(checks, null, 2));
  const dimensions = await js('moveQa.calls.dimensions.at(-1)');
  if (dimensions) win.setSize(dimensions.width, dimensions.height);
  await pause(100);
  fs.writeFileSync(path.join(output, 'electron.png'), (await win.webContents.capturePage()).toPNG());
  win.destroy(); app.exit(checks.every(c => c.pass) ? 0 : 1);
}).catch(error => { console.error(error); app.exit(2); });
setTimeout(() => { console.error('QA timed out'); app.exit(3); }, 60000).unref();
