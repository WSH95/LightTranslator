import React, { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { TranslatorView } from './components/TranslatorView';
import { SettingsView } from './components/SettingsView';
import { OcrModal } from './components/OcrModal';
import { QuickTranslateWindow } from './components/QuickTranslateWindow';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ResizeHandles } from './components/ui';
import { useAppStore } from './store/useAppStore';
import { platform } from './src/lib/platform';

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const { updateSettings } = useAppStore();

  // Initialize directly from URL to avoid flash/race conditions
  const [isQuickMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'quick';
  });
  // Rounded corners must square off while the window is maximized. The real
  // state comes from the backend: comparing sizes against screen.avail* is
  // wrong under Wayland, where the workarea is not exposed to the page.
  useEffect(() => {
    if (isQuickMode || !platform.isAvailable()) return;
    const root = document.documentElement;
    const unsubscribe = platform.onMaximizedChange((maximized) => {
      if (maximized) root.dataset.windowMaximized = '';
      else delete root.dataset.windowMaximized;
    });
    return () => {
      unsubscribe();
      delete root.dataset.windowMaximized;
    };
  }, [isQuickMode]);

  // Listen for open-settings event from tray menu
  useEffect(() => {
    if (platform.isAvailable()) {
      const unlisten = platform.onOpenSettings(() => {
        setShowSettings(true);
      });
      return unlisten;
    }
  }, []);

  // Tray-initiated OCR with missing components: open the OCR modal, which
  // runs the on-demand dependency check and shows install guidance
  useEffect(() => {
    if (isQuickMode || !platform.isAvailable()) return;
    return platform.onOcrDepsMissing(() => {
      // The tray asked for OCR and the dependencies are missing; the guidance
      // lives in the OCR dialog, so step out of settings to show it.
      setShowSettings(false);
      setShowOCR(true);
    });
  }, [isQuickMode]);

  // Resize main window when settings modal opens/closes
  useEffect(() => {
    if (showSettings && platform.isAvailable()) {
      platform.resizeMainWindow({ width: 760, height: 600 });
      return () => {
        platform.resizeMainWindow({ width: 760, height: 520 });
      };
    }
  }, [showSettings]);

  // Rehydrate when the other window persists a settings change
  useEffect(() => {
    if (!platform.isAvailable()) return;
    return platform.onSettingsChanged(() => {
      useAppStore.persist.rehydrate();
    });
  }, []);

  // Sync auto-launch state with system on app startup (main window only —
  // the quick window also mounts App and must not race a duplicate write)
  useEffect(() => {
    if (isQuickMode) return;
    const syncAutoLaunchState = async () => {
      if (platform.isAvailable()) {
        try {
          const enabled = await platform.getAutoLaunch();
          updateSettings({ launchAtStartup: enabled });
        } catch (error) {
          console.error('Failed to sync auto-launch state:', error);
        }
      }
    };
    syncAutoLaunchState();
  }, [updateSettings, isQuickMode]);

  // Restore persisted shortcut + proxy to the Rust backend on startup.
  // The backend boots with hardcoded defaults; without this push the UI
  // shows the saved values while the app actually uses the defaults.
  const didPushBackendSettings = useRef(false);
  useEffect(() => {
    if (isQuickMode || !platform.isAvailable() || didPushBackendSettings.current) return;
    didPushBackendSettings.current = true; // ref survives StrictMode remount

    const push = () => {
      const s = useAppStore.getState();
      // Always push, even when it is the default: under Wayland the accelerator
      // lives in GNOME's own settings, so the app has to state its value.
      if (s.selectionShortcut) {
        platform.updateShortcut(s.selectionShortcut)
          .catch((e) => console.error('Failed to restore shortcut:', e));
      }
      if (s.proxyEnabled && s.proxyHost) {
        platform.setProxy({
          enabled: true,
          protocol: s.proxyProtocol,
          host: s.proxyHost,
          port: s.proxyPort,
          username: s.proxyUsername,
          password: s.proxyPassword,
        }).catch((e) => console.error('Failed to restore proxy settings:', e));
      }
    };

    if (useAppStore.persist.hasHydrated()) {
      push();
    } else {
      const unsub = useAppStore.persist.onFinishHydration(() => {
        unsub();
        push();
      });
      return unsub;
    }
  }, [isQuickMode]);

  if (isQuickMode) {
    return (
      <ErrorBoundary>
        <QuickTranslateWindow />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="w-screen h-screen overflow-hidden">
        {/* Fills the frameless, transparent window; #root paints the surface.
            Settings replaces this view visually, but the translator stays
            MOUNTED behind it: unmounting would drop TranslatorView's
            platform.onOcrResult listener, so a tray OCR result arriving while
            settings is open would be emitted to nobody, and remounting would
            re-fire auto-translate against the surviving store text. */}
        <div className={`w-full h-full flex-col overflow-hidden relative ${showSettings ? 'hidden' : 'flex'}`}>

          <TitleBar onOpenSettings={() => setShowSettings(true)} />

          <TranslatorView onOpenOCR={() => setShowOCR(true)} />

          {showOCR && <OcrModal onClose={() => setShowOCR(false)} />}
        </div>

        {showSettings && <SettingsView onBack={() => setShowSettings(false)} />}

        {/* Outside the view swap: the translator and Settings share one
            window, so the grips must survive switching between them. */}
        <ResizeHandles />
      </div>
    </ErrorBoundary>
  );
};

export default App;
