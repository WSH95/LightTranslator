/**
 * Platform Abstraction Layer
 *
 * One contract, three backends: Tauri (Ubuntu 22.04+/Debian 12+), Electron
 * (Ubuntu 18.04-20.04, where Tauri 2's webkit2gtk-4.1 does not exist), and a
 * plain-web fallback. The React UI above this file is shared verbatim, so the
 * interface is identical everywhere; only these implementations differ.
 *
 * PARITY RULE: `PlatformBackend` is derived from the Tauri implementation, so
 * the compiler rejects an Electron backend that is missing anything. Behavior
 * parity is enforced separately by the checklist in .project-steward/VERIFY.md.
 */

import { toGnomeAccelerator } from '../../utils/shortcutUtils';

// Type definitions for the platform API
export interface ProxyRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface ProxyResponse {
  ok: boolean;
  statusCode?: number;
  data?: string;
  error?: string;
}

export interface ProxySettings {
  enabled: boolean;
  protocol: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface WindowDimensions {
  width: number;
  height: number;
}

export interface OcrDependencyStatus {
  tesseractInstalled: boolean;
  tesseractVersion?: string;
  languages: string[];
  gnomeScreenshotInstalled: boolean;
}

export interface OcrResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface ShortcutStatus {
  /**
   * 'x11-grab': the app grabs the key from the X server (X11 sessions).
   * 'gnome': GNOME owns the key and runs `command` (Wayland on GNOME).
   * 'manual': a Wayland desktop with no way to register — the user has to bind
   * `command` in their own keyboard settings.
   */
  mechanism: 'x11-grab' | 'gnome' | 'manual';
  sessionType: 'x11' | 'wayland';
  /** The command that triggers a quick translate. */
  command: string;
  /** The accelerator GNOME currently holds, in GTK spelling. */
  gnomeBinding?: string | null;
  /** Placement extension state (Wayland on GNOME only). */
  extension: 'active' | 'pending-restart' | 'disabled' | 'missing' | 'not-applicable';
}

/**
 * Raw `org.gnome.desktop.interface` values. Kept raw on purpose: mapping a
 * theme name to an accent hex is UI policy and lives in src/lib/theme.ts, so
 * both backends stay identical and trivial.
 */
export interface SystemAppearance {
  /** 'default' | 'prefer-light' | 'prefer-dark', or null off GNOME. */
  colorScheme: string | null;
  /** GNOME 47+ only; null on GNOME 46 and earlier. */
  accentColor: string | null;
  /** e.g. 'Yaru', 'Yaru-viridian', 'Yaru-bark-dark'. */
  gtkTheme: string | null;
}

export interface OcrInstallGuidance {
  os: string;
  packageManager?: string;
  /** Human-readable descriptions of what is missing */
  missing: string[];
  /** Copy-pastable install command(s); empty when nothing is missing */
  commands: string[];
}

// Detect Tauri runtime
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

// Detect Electron runtime (preload exposes window.electron via contextBridge)
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && 'electron' in window;
};

/** Shape exposed by electron/preload.cjs — see PlatformBackend for the contract. */
interface ElectronBridge {
  request(url: string, options?: ProxyRequestOptions): Promise<ProxyResponse>;
  minimize(): void;
  maximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizedChanged(cb: (maximized: boolean) => void): () => void;
  onQuickTranslate(cb: (text: string) => void): () => void;
  sendQuickReady(): void;
  closeQuickWindow(): void;
  onOpenSettings(cb: () => void): () => void;
  emitSettingsChanged(): void;
  onSettingsChanged(cb: (sender: string) => void): () => void;
  captureScreen(): Promise<{ success: boolean; data?: string; cancelled?: boolean; error?: string }>;
  ocrImage(base64Image: string): Promise<OcrResult>;
  onOcrResult(cb: (text: string) => void): () => void;
  onOcrDepsMissing(cb: () => void): () => void;
  setProxy(settings: ProxySettings): Promise<{ success: boolean }>;
  updateShortcut(shortcut: string, gnomeBinding: string | null): Promise<{ success: boolean; message?: string }>;
  getShortcutStatus(): Promise<ShortcutStatus>;
  getSystemAppearance(): Promise<SystemAppearance>;
  reregisterShortcut(): Promise<{ success: boolean; message?: string; mechanism: string }>;
  setAutoLaunch(enabled: boolean): Promise<{ success: boolean }>;
  getAutoLaunch(): Promise<{ success: boolean; enabled: boolean }>;
  resizeQuickWindow(dimensions: WindowDimensions): Promise<unknown>;
  resizeMainWindow(dimensions: WindowDimensions): Promise<unknown>;
  checkOcrDependencies(): Promise<OcrDependencyStatus>;
  getOcrInstallGuidance(): Promise<OcrInstallGuidance>;
}

const bridge = (): ElectronBridge => (window as unknown as { electron: ElectronBridge }).electron;

// Platform-specific imports for Tauri (lazy loaded)
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let tauriWindow: { getCurrentWindow: () => { label: string; minimize: () => Promise<void>; toggleMaximize: () => Promise<void>; close: () => Promise<void>; hide: () => Promise<void>; isMaximized: () => Promise<boolean>; onFocusChanged: (handler: (event: { payload: boolean }) => void) => Promise<() => void>; onResized: (handler: () => void) => Promise<() => void> } } | null = null;
let tauriEvent: { listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>; emitTo: (target: string, event: string, payload?: unknown) => Promise<void> } | null = null;

// Initialize Tauri APIs if available
const initTauri = async () => {
  if (isTauri() && !tauriInvoke) {
    try {
      const tauri = await import('@tauri-apps/api/core');
      const window = await import('@tauri-apps/api/window');
      const event = await import('@tauri-apps/api/event');
      tauriInvoke = tauri.invoke;
      tauriWindow = window;
      tauriEvent = event;
    } catch (e) {
      console.error('Failed to load Tauri APIs:', e);
    }
  }
};

// Initialize on module load if Tauri is detected
if (isTauri()) {
  initTauri();
}

/**
 * Wraps async listener registration so the returned disposer works even when
 * it runs before registration resolves. Without this, React StrictMode's
 * mount→unmount→remount cycle runs the first cleanup while `unlisten` is
 * still null, permanently orphaning that listener (duplicate events).
 */
function makeDisposableListener(
  start: () => Promise<(() => void) | null>,
  onRegistered?: () => void
): () => void {
  let cancelled = false;
  let unlisten: (() => void) | null = null;
  start()
    .then((fn) => {
      if (!fn) return;
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
        onRegistered?.();
      }
    })
    .catch((e) => console.error('Failed to register listener:', e));
  return () => {
    cancelled = true;
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
  };
}

/**
 * Tauri backend. This object also defines the contract (see PlatformBackend
 * below), so anything added here must be added to the Electron backend too —
 * the compiler will say so.
 */
const tauriBackend = {
  /**
   * Make an HTTP request through the backend (bypasses CORS)
   */
  async request(url: string, options: ProxyRequestOptions = {}): Promise<ProxyResponse> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        try {
          return await tauriInvoke('proxy_request', { url, options }) as ProxyResponse;
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
    }

    // Fallback to fetch (may fail due to CORS)
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
      });
      const data = await response.text();
      return { ok: response.ok, statusCode: response.status, data };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  /**
   * Window controls
   */
  async minimize(): Promise<void> {
    await initTauri();
    if (tauriWindow) {
      await tauriWindow.getCurrentWindow().minimize();
    }
  },

  async maximize(): Promise<void> {
    await initTauri();
    if (tauriWindow) {
      await tauriWindow.getCurrentWindow().toggleMaximize();
    }
  },

  async close(): Promise<void> {
    await initTauri();
    if (tauriWindow) {
      // Hide to tray instead of closing
      await tauriWindow.getCurrentWindow().hide();
    }
  },

  /**
   * Maximized state of the main window, for the rounded-corner styling.
   * Reports the current state immediately, then every change.
   */
  onMaximizedChange(callback: (maximized: boolean) => void): () => void {
    let settle: ReturnType<typeof setTimeout> | undefined;
    return makeDisposableListener(async () => {
      await initTauri();
      if (!tauriWindow) return null;
      const win = tauriWindow.getCurrentWindow();
      const push = () => {
        win.isMaximized().then(callback).catch(() => { /* window gone */ });
      };
      push();
      // GTK delivers the new size and the maximized flag in separate events,
      // so re-read once the resize has settled.
      const unlisten = await win.onResized(() => {
        push();
        if (settle) clearTimeout(settle);
        settle = setTimeout(push, 150);
      });
      return () => {
        if (settle) clearTimeout(settle);
        unlisten();
      };
    });
  },

  /**
   * Quick Translate window
   */
  onQuickTranslate(callback: (text: string) => void, onRegistered?: () => void): () => void {
    return makeDisposableListener(async () => {
      await initTauri();
      if (!tauriEvent) return null;
      return tauriEvent.listen('quick-translate-text', (event) => {
        callback(event.payload as string);
      });
    }, onRegistered);
  },

  sendQuickReady(): void {
    initTauri().then(() => {
      if (tauriInvoke) {
        tauriInvoke('quick_window_ready');
      }
    });
  },

  closeQuickWindow(): void {
    initTauri().then(() => {
      if (tauriInvoke) {
        tauriInvoke('close_quick_window');
      }
    });
  },

  /**
   * Listen for window blur (focus lost) events
   */
  onWindowBlur(callback: () => void): () => void {
    return makeDisposableListener(async () => {
      await initTauri();
      if (!tauriWindow) return null;
      return tauriWindow.getCurrentWindow().onFocusChanged((event) => {
        if (!event.payload) {
          callback();
        }
      });
    });
  },

  async resizeQuickWindow(dimensions: WindowDimensions): Promise<void> {
    await initTauri();
    if (tauriInvoke) {
      await tauriInvoke('resize_quick_window', { dimensions });
    }
  },

  async resizeMainWindow(dimensions: WindowDimensions): Promise<void> {
    await initTauri();
    if (tauriInvoke) {
      await tauriInvoke('resize_main_window', { dimensions });
    }
  },

  /**
   * Settings callbacks
   */
  onOpenSettings(callback: () => void): () => void {
    return makeDisposableListener(async () => {
      await initTauri();
      if (!tauriEvent) return null;
      return tauriEvent.listen('open-settings', () => {
        callback();
      });
    });
  },

  /**
   * Cross-window settings sync: tell the other window that persisted settings
   * changed so it rehydrates from localStorage. emitTo targets only the other
   * window, so the sender never reacts to its own change (no event loop).
   */
  async emitSettingsChanged(): Promise<void> {
    await initTauri();
    if (!tauriEvent || !tauriWindow) return;
    const label = tauriWindow.getCurrentWindow().label;
    const target = label === 'quick' ? 'main' : 'quick';
    try {
      await tauriEvent.emitTo(target, 'settings-changed', label);
    } catch (e) {
      console.warn('Failed to emit settings-changed:', e);
    }
  },

  onSettingsChanged(callback: (sender: string) => void): () => void {
    return makeDisposableListener(async () => {
      await initTauri();
      if (!tauriEvent) return null;
      return tauriEvent.listen('settings-changed', (event) => {
        callback(event.payload as string);
      });
    });
  },

  /**
   * Screenshot capture for OCR
   */
  async captureScreen(): Promise<string | null> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('capture_screen') as Promise<string | null>;
    }
    return null;
  },

  /**
   * OCR image processing
   */
  async ocrImage(base64Image: string): Promise<OcrResult> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('ocr_image', { base64Image }) as Promise<OcrResult>;
    }
    return { success: false, error: 'No OCR backend available' };
  },

  /**
   * OCR result callback (from tray menu)
   */
  onOcrResult(callback: (text: string) => void): () => void {
    return makeDisposableListener(async () => {
      await initTauri();
      if (!tauriEvent) return null;
      return tauriEvent.listen('ocr-result', (event) => {
        callback(event.payload as string);
      });
    });
  },

  /**
   * Proxy settings
   */
  async setProxy(settings: ProxySettings): Promise<void> {
    await initTauri();
    if (tauriInvoke) {
      await tauriInvoke('set_proxy', { settings });
    }
  },

  /**
   * Keyboard shortcut settings. The GTK spelling goes along for the ride
   * because under Wayland the shortcut is registered with GNOME, not with us.
   */
  async updateShortcut(shortcut: string): Promise<boolean> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('update_shortcut', {
        shortcut,
        gnomeBinding: toGnomeAccelerator(shortcut),
      }) as Promise<boolean>;
    }
    return false;
  },

  /** Where this session's shortcut is registered, for the settings UI. */
  async getShortcutStatus(): Promise<ShortcutStatus | null> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('get_shortcut_status') as Promise<ShortcutStatus>;
    }
    return null;
  },

  /**
   * GNOME's own appearance settings. Null everywhere it cannot be read, so
   * callers always fall back to prefers-color-scheme and the stored accent.
   */
  async getSystemAppearance(): Promise<SystemAppearance | null> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('get_system_appearance') as Promise<SystemAppearance>;
    }
    return null;
  },

  /** Re-apply the registration for this session. */
  async reregisterShortcut(): Promise<void> {
    await initTauri();
    if (tauriInvoke) {
      await tauriInvoke('reregister_shortcut');
    }
  },

  /**
   * Auto-launch settings
   */
  async setAutoLaunch(enabled: boolean): Promise<void> {
    await initTauri();
    if (tauriInvoke) {
      await tauriInvoke('set_auto_launch', { enabled });
    }
  },

  async getAutoLaunch(): Promise<boolean> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('get_auto_launch') as Promise<boolean>;
    }
    return false;
  },

  /**
   * OCR dependency management
   */
  async checkOcrDependencies(): Promise<OcrDependencyStatus> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('check_ocr_dependencies') as Promise<OcrDependencyStatus>;
    }
    return {
      tesseractInstalled: false,
      languages: [],
      gnomeScreenshotInstalled: false,
    };
  },

  /**
   * OS-specific install guidance for missing OCR components
   * (OCR deps are installed on demand, not bundled as package dependencies)
   */
  async getOcrInstallGuidance(): Promise<OcrInstallGuidance | null> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('get_ocr_install_guidance') as Promise<OcrInstallGuidance>;
    }
    return null;
  },

  /**
   * Fired by the backend when a tray-initiated OCR finds components missing
   */
  onOcrDepsMissing(callback: () => void): () => void {
    return makeDisposableListener(async () => {
      await initTauri();
      if (!tauriEvent) return null;
      return tauriEvent.listen('ocr-deps-missing', () => {
        callback();
      });
    });
  },

};

/**
 * The contract every backend must satisfy, derived from the Tauri backend so
 * the two can never drift apart silently.
 */
export type PlatformBackend = typeof tauriBackend;

/**
 * Electron backend. Mirrors the Tauri semantics exactly; the main process
 * (electron/main.js) implements the same behaviors as src-tauri/src/lib.rs.
 */
const electronBackend: PlatformBackend = {
  async request(url: string, options: ProxyRequestOptions = {}): Promise<ProxyResponse> {
    try {
      return await bridge().request(url, options);
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },

  async minimize(): Promise<void> {
    bridge().minimize();
  },

  async maximize(): Promise<void> {
    bridge().maximize();
  },

  async close(): Promise<void> {
    // Hide to tray, matching the Tauri behavior
    bridge().close();
  },

  onMaximizedChange(callback: (maximized: boolean) => void): () => void {
    return makeDisposableListener(async () => {
      bridge().isMaximized().then(callback).catch(() => { /* window gone */ });
      return bridge().onMaximizedChanged(callback);
    });
  },

  onQuickTranslate(callback: (text: string) => void, onRegistered?: () => void): () => void {
    return makeDisposableListener(
      async () => bridge().onQuickTranslate(callback),
      onRegistered
    );
  },

  sendQuickReady(): void {
    bridge().sendQuickReady();
  },

  closeQuickWindow(): void {
    bridge().closeQuickWindow();
  },

  onWindowBlur(callback: () => void): () => void {
    // Electron delivers focus loss to the renderer as a DOM event
    const handler = () => callback();
    window.addEventListener('blur', handler);
    return () => window.removeEventListener('blur', handler);
  },

  async resizeQuickWindow(dimensions: WindowDimensions): Promise<void> {
    await bridge().resizeQuickWindow(dimensions);
  },

  async resizeMainWindow(dimensions: WindowDimensions): Promise<void> {
    await bridge().resizeMainWindow(dimensions);
  },

  onOpenSettings(callback: () => void): () => void {
    return makeDisposableListener(async () => bridge().onOpenSettings(callback));
  },

  async emitSettingsChanged(): Promise<void> {
    bridge().emitSettingsChanged();
  },

  onSettingsChanged(callback: (sender: string) => void): () => void {
    return makeDisposableListener(async () => bridge().onSettingsChanged(callback));
  },

  async captureScreen(): Promise<string | null> {
    const result = await bridge().captureScreen();
    if (result?.success && result.data) return result.data;
    if (result?.cancelled) return null;
    if (result?.error) throw new Error(result.error);
    return null;
  },

  async ocrImage(base64Image: string): Promise<OcrResult> {
    return bridge().ocrImage(base64Image);
  },

  onOcrResult(callback: (text: string) => void): () => void {
    return makeDisposableListener(async () => bridge().onOcrResult(callback));
  },

  async setProxy(settings: ProxySettings): Promise<void> {
    await bridge().setProxy(settings);
  },

  async updateShortcut(shortcut: string): Promise<boolean> {
    const result = await bridge().updateShortcut(shortcut, toGnomeAccelerator(shortcut));
    if (!result?.success) {
      throw new Error(result?.message || `Failed to register '${shortcut}'`);
    }
    return true;
  },

  async getSystemAppearance(): Promise<SystemAppearance | null> {
    return bridge().getSystemAppearance();
  },

  async getShortcutStatus(): Promise<ShortcutStatus | null> {
    return bridge().getShortcutStatus();
  },

  async reregisterShortcut(): Promise<void> {
    const result = await bridge().reregisterShortcut();
    if (!result?.success) {
      throw new Error(result?.message || 'Failed to register the shortcut');
    }
  },

  async setAutoLaunch(enabled: boolean): Promise<void> {
    await bridge().setAutoLaunch(enabled);
  },

  async getAutoLaunch(): Promise<boolean> {
    const result = await bridge().getAutoLaunch();
    return Boolean(result?.enabled);
  },

  async checkOcrDependencies(): Promise<OcrDependencyStatus> {
    return bridge().checkOcrDependencies();
  },

  async getOcrInstallGuidance(): Promise<OcrInstallGuidance | null> {
    return bridge().getOcrInstallGuidance();
  },

  onOcrDepsMissing(callback: () => void): () => void {
    return makeDisposableListener(async () => bridge().onOcrDepsMissing(callback));
  },
};

/** Tauri wins if both are somehow present. */
const activeBackend = (): PlatformBackend =>
  !isTauri() && isElectron() ? electronBackend : tauriBackend;

/**
 * Platform API used by the UI. Delegates to whichever backend is running.
 */
export const platform = {
  request: (url: string, options?: ProxyRequestOptions) => activeBackend().request(url, options),
  minimize: () => activeBackend().minimize(),
  maximize: () => activeBackend().maximize(),
  close: () => activeBackend().close(),
  onMaximizedChange: (cb: (maximized: boolean) => void) => activeBackend().onMaximizedChange(cb),
  onQuickTranslate: (cb: (text: string) => void, onRegistered?: () => void) =>
    activeBackend().onQuickTranslate(cb, onRegistered),
  sendQuickReady: () => activeBackend().sendQuickReady(),
  closeQuickWindow: () => activeBackend().closeQuickWindow(),
  onWindowBlur: (cb: () => void) => activeBackend().onWindowBlur(cb),
  resizeQuickWindow: (dimensions: WindowDimensions) => activeBackend().resizeQuickWindow(dimensions),
  resizeMainWindow: (dimensions: WindowDimensions) => activeBackend().resizeMainWindow(dimensions),
  onOpenSettings: (cb: () => void) => activeBackend().onOpenSettings(cb),
  emitSettingsChanged: () => activeBackend().emitSettingsChanged(),
  onSettingsChanged: (cb: (sender: string) => void) => activeBackend().onSettingsChanged(cb),
  captureScreen: () => activeBackend().captureScreen(),
  ocrImage: (base64Image: string) => activeBackend().ocrImage(base64Image),
  onOcrResult: (cb: (text: string) => void) => activeBackend().onOcrResult(cb),
  onOcrDepsMissing: (cb: () => void) => activeBackend().onOcrDepsMissing(cb),
  setProxy: (settings: ProxySettings) => activeBackend().setProxy(settings),
  updateShortcut: (shortcut: string) => activeBackend().updateShortcut(shortcut),
  getShortcutStatus: () => activeBackend().getShortcutStatus(),
  getSystemAppearance: () => activeBackend().getSystemAppearance(),
  reregisterShortcut: () => activeBackend().reregisterShortcut(),
  setAutoLaunch: (enabled: boolean) => activeBackend().setAutoLaunch(enabled),
  getAutoLaunch: () => activeBackend().getAutoLaunch(),
  checkOcrDependencies: () => activeBackend().checkOcrDependencies(),
  getOcrInstallGuidance: () => activeBackend().getOcrInstallGuidance(),

  /** True when a native backend (Tauri or Electron) is present. */
  isAvailable(): boolean {
    return isTauri() || isElectron();
  },

  getPlatformName(): 'tauri' | 'electron' | 'web' {
    if (isTauri()) return 'tauri';
    if (isElectron()) return 'electron';
    return 'web';
  },
};

export default platform;
