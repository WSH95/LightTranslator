/**
 * Platform Abstraction Layer
 *
 * This module provides a unified API that works with both Electron and Tauri backends.
 * During the transition period, both backends are supported. The abstraction automatically
 * detects the runtime environment and uses the appropriate API.
 */

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

export interface OcrInstallProgress {
  stage: string;
  progress: number;
  message: string;
}

// Detect runtime environment
export const isTauri = (): boolean => {
  // Tauri v2 uses __TAURI_INTERNALS__, v1 used __TAURI__
  return typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && 'electron' in window;
};

// Debug logging for platform detection
if (typeof window !== 'undefined') {
  console.log('[Platform] Detection:', {
    hasTauriInternals: '__TAURI_INTERNALS__' in window,
    hasTauri: '__TAURI__' in window,
    hasElectron: 'electron' in window,
    isTauri: isTauri(),
    isElectron: isElectron()
  });
}

// Platform-specific imports for Tauri (lazy loaded)
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let tauriWindow: { getCurrentWindow: () => { minimize: () => Promise<void>; toggleMaximize: () => Promise<void>; close: () => Promise<void>; hide: () => Promise<void>; onFocusChanged: (handler: (event: { payload: boolean }) => void) => Promise<() => void> } } | null = null;
let tauriEvent: { listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void> } | null = null;

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
 * Platform API - Unified interface for both Electron and Tauri
 */
export const platform = {
  /**
   * Make an HTTP request through the backend (bypasses CORS)
   */
  async request(url: string, options: ProxyRequestOptions = {}): Promise<ProxyResponse> {
    console.log('[Platform.request] Starting request:', { url: url.substring(0, 100), isTauri: isTauri(), isElectron: isElectron() });

    if (isTauri()) {
      await initTauri();
      console.log('[Platform.request] Tauri detected, tauriInvoke:', !!tauriInvoke);
      if (tauriInvoke) {
        try {
          console.log('[Platform.request] Calling proxy_request via Tauri invoke');
          const result = await tauriInvoke('proxy_request', { url, options }) as ProxyResponse;
          console.log('[Platform.request] Tauri result:', { ok: result.ok, statusCode: result.statusCode, hasData: !!result.data });
          return result;
        } catch (e) {
          console.error('[Platform.request] Tauri invoke error:', e);
          return { ok: false, error: String(e) };
        }
      }
    }

    if (isElectron()) {
      console.log('[Platform.request] Using Electron');
      return (window as any).electron.request(url, options);
    }

    // Fallback to fetch (may fail due to CORS)
    console.log('[Platform.request] Falling back to fetch');
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
      });
      const data = await response.text();
      return { ok: response.ok, statusCode: response.status, data };
    } catch (error) {
      console.error('[Platform.request] Fetch error:', error);
      return { ok: false, error: String(error) };
    }
  },

  /**
   * Window controls
   */
  async minimize(): Promise<void> {
    if (isTauri()) {
      await initTauri();
      if (tauriWindow) {
        await tauriWindow.getCurrentWindow().minimize();
        return;
      }
    }

    if (isElectron()) {
      (window as any).electron.minimize();
    }
  },

  async maximize(): Promise<void> {
    if (isTauri()) {
      await initTauri();
      if (tauriWindow) {
        await tauriWindow.getCurrentWindow().toggleMaximize();
        return;
      }
    }

    if (isElectron()) {
      (window as any).electron.maximize();
    }
  },

  async close(): Promise<void> {
    if (isTauri()) {
      await initTauri();
      if (tauriWindow) {
        // In Tauri, we hide to tray instead of closing
        await tauriWindow.getCurrentWindow().hide();
        return;
      }
    }

    if (isElectron()) {
      (window as any).electron.close();
    }
  },

  /**
   * Quick Translate window
   */
  onQuickTranslate(callback: (text: string) => void): () => void {
    if (isTauri()) {
      let unlisten: (() => void) | null = null;
      initTauri().then(() => {
        if (tauriEvent) {
          tauriEvent.listen('quick-translate-text', (event) => {
            callback(event.payload as string);
          }).then((fn) => {
            unlisten = fn;
          });
        }
      });
      return () => unlisten?.();
    }

    if (isElectron()) {
      (window as any).electron.onQuickTranslate(callback);
      return () => {}; // Electron doesn't provide unlisten
    }

    return () => {};
  },

  sendQuickReady(): void {
    if (isTauri()) {
      initTauri().then(() => {
        if (tauriInvoke) {
          tauriInvoke('quick_window_ready');
        }
      });
      return;
    }

    if (isElectron()) {
      (window as any).electron.sendQuickReady();
    }
  },

  closeQuickWindow(): void {
    if (isTauri()) {
      initTauri().then(() => {
        if (tauriInvoke) {
          tauriInvoke('close_quick_window');
        }
      });
      return;
    }

    if (isElectron()) {
      (window as any).electron.closeQuickWindow();
    }
  },

  /**
   * Listen for window blur (focus lost) events
   */
  onWindowBlur(callback: () => void): () => void {
    if (isTauri()) {
      let unlisten: (() => void) | null = null;
      initTauri().then(() => {
        if (tauriWindow) {
          tauriWindow.getCurrentWindow().onFocusChanged((event) => {
            // When focus is lost (payload is false), trigger callback
            if (!event.payload) {
              callback();
            }
          }).then((fn) => {
            unlisten = fn;
          });
        }
      });
      return () => unlisten?.();
    }

    if (isElectron()) {
      // For Electron, use the window blur event
      const handler = () => callback();
      window.addEventListener('blur', handler);
      return () => window.removeEventListener('blur', handler);
    }

    return () => {};
  },

  async resizeQuickWindow(dimensions: WindowDimensions): Promise<void> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        await tauriInvoke('resize_quick_window', { dimensions });
        return;
      }
    }

    if (isElectron()) {
      await (window as any).electron.resizeQuickWindow(dimensions);
    }
  },

  /**
   * Settings callbacks
   */
  onOpenSettings(callback: () => void): () => void {
    if (isTauri()) {
      let unlisten: (() => void) | null = null;
      initTauri().then(() => {
        if (tauriEvent) {
          tauriEvent.listen('open-settings', () => {
            callback();
          }).then((fn) => {
            unlisten = fn;
          });
        }
      });
      return () => unlisten?.();
    }

    if (isElectron()) {
      (window as any).electron.onOpenSettings(callback);
      return () => {};
    }

    return () => {};
  },

  /**
   * Screenshot capture for OCR
   */
  async captureScreen(): Promise<string | null> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        return tauriInvoke('capture_screen') as Promise<string | null>;
      }
    }

    if (isElectron()) {
      return (window as any).electron.captureScreen();
    }

    return null;
  },

  /**
   * OCR image processing
   */
  async ocrImage(base64Image: string): Promise<OcrResult> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        return tauriInvoke('ocr_image', { base64Image }) as Promise<OcrResult>;
      }
    }

    if (isElectron()) {
      return (window as any).electron.ocrImage(base64Image);
    }

    return { success: false, error: 'No OCR backend available' };
  },

  /**
   * OCR result callback (from tray menu)
   */
  onOcrResult(callback: (text: string) => void): () => void {
    if (isTauri()) {
      let unlisten: (() => void) | null = null;
      initTauri().then(() => {
        if (tauriEvent) {
          tauriEvent.listen('ocr-result', (event) => {
            callback(event.payload as string);
          }).then((fn) => {
            unlisten = fn;
          });
        }
      });
      return () => unlisten?.();
    }

    if (isElectron()) {
      (window as any).electron.onOcrResult(callback);
      return () => {};
    }

    return () => {};
  },

  /**
   * Proxy settings
   */
  async setProxy(settings: ProxySettings): Promise<void> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        await tauriInvoke('set_proxy', { settings });
        return;
      }
    }

    if (isElectron()) {
      await (window as any).electron.setProxy(settings);
    }
  },

  /**
   * Keyboard shortcut settings
   */
  async updateShortcut(shortcut: string): Promise<boolean> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        return tauriInvoke('update_shortcut', { shortcut }) as Promise<boolean>;
      }
    }

    if (isElectron()) {
      return (window as any).electron.updateShortcut(shortcut);
    }

    return false;
  },

  /**
   * Auto-launch settings
   */
  async setAutoLaunch(enabled: boolean): Promise<void> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        await tauriInvoke('set_auto_launch', { enabled });
        return;
      }
    }

    if (isElectron()) {
      await (window as any).electron.setAutoLaunch(enabled);
    }
  },

  async getAutoLaunch(): Promise<boolean> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        return tauriInvoke('get_auto_launch') as Promise<boolean>;
      }
    }

    if (isElectron()) {
      return (window as any).electron.getAutoLaunch();
    }

    return false;
  },

  /**
   * OCR dependency management
   */
  async checkOcrDependencies(): Promise<OcrDependencyStatus> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        return tauriInvoke('check_ocr_dependencies') as Promise<OcrDependencyStatus>;
      }
    }

    if (isElectron()) {
      return (window as any).electron.checkOcrDependencies();
    }

    return {
      tesseractInstalled: false,
      languages: [],
      gnomeScreenshotInstalled: false,
    };
  },

  async installOcrDependencies(): Promise<boolean> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        return tauriInvoke('install_ocr_dependencies') as Promise<boolean>;
      }
    }

    if (isElectron()) {
      return (window as any).electron.installOcrDependencies();
    }

    return false;
  },

  async showOcrInstallPrompt(message: string): Promise<boolean> {
    if (isTauri()) {
      await initTauri();
      if (tauriInvoke) {
        return tauriInvoke('show_ocr_install_prompt', { message }) as Promise<boolean>;
      }
    }

    if (isElectron()) {
      return (window as any).electron.showOcrInstallPrompt(message);
    }

    return false;
  },

  onOcrInstallProgress(callback: (progress: OcrInstallProgress) => void): () => void {
    if (isTauri()) {
      let unlisten: (() => void) | null = null;
      initTauri().then(() => {
        if (tauriEvent) {
          tauriEvent.listen('ocr-install-progress', (event) => {
            callback(event.payload as OcrInstallProgress);
          }).then((fn) => {
            unlisten = fn;
          });
        }
      });
      return () => unlisten?.();
    }

    if (isElectron()) {
      (window as any).electron.onOcrInstallProgress(callback);
      return () => {};
    }

    return () => {};
  },

  /**
   * Check if native backend is available
   */
  isAvailable(): boolean {
    return isTauri() || isElectron();
  },

  /**
   * Get the current platform name
   */
  getPlatformName(): 'tauri' | 'electron' | 'web' {
    if (isTauri()) return 'tauri';
    if (isElectron()) return 'electron';
    return 'web';
  },
};

export default platform;
