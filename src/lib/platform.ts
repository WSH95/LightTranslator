/**
 * Platform Abstraction Layer (Tauri-only)
 *
 * This module provides a unified API for the Tauri backend.
 * It automatically detects the Tauri runtime and provides
 * fallbacks for web environments where applicable.
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

// Detect Tauri runtime
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

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
 * Platform API - Tauri interface
 */
export const platform = {
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
   * Quick Translate window
   */
  onQuickTranslate(callback: (text: string) => void): () => void {
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
    let unlisten: (() => void) | null = null;
    initTauri().then(() => {
      if (tauriWindow) {
        tauriWindow.getCurrentWindow().onFocusChanged((event) => {
          if (!event.payload) {
            callback();
          }
        }).then((fn) => {
          unlisten = fn;
        });
      }
    });
    return () => unlisten?.();
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
   * Keyboard shortcut settings
   */
  async updateShortcut(shortcut: string): Promise<boolean> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('update_shortcut', { shortcut }) as Promise<boolean>;
    }
    return false;
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

  async installOcrDependencies(): Promise<boolean> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('install_ocr_dependencies') as Promise<boolean>;
    }
    return false;
  },

  async showOcrInstallPrompt(message: string): Promise<boolean> {
    await initTauri();
    if (tauriInvoke) {
      return tauriInvoke('show_ocr_install_prompt', { message }) as Promise<boolean>;
    }
    return false;
  },

  onOcrInstallProgress(callback: (progress: OcrInstallProgress) => void): () => void {
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
  },

  /**
   * Check if Tauri backend is available
   */
  isAvailable(): boolean {
    return isTauri();
  },

  /**
   * Get the current platform name
   */
  getPlatformName(): 'tauri' | 'web' {
    if (isTauri()) return 'tauri';
    return 'web';
  },
};

export default platform;
