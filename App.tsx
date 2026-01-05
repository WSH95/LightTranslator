import React, { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { TranslatorView } from './components/TranslatorView';
import { SettingsModal } from './components/SettingsModal';
import { OcrModal } from './components/OcrModal';
import { QuickTranslateWindow } from './components/QuickTranslateWindow';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useOcrDependencies } from './hooks/useOcrDependencies';
import { useAppStore } from './store/useAppStore';

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const hasPrompted = useRef(false);
  const { updateSettings } = useAppStore();

  // Initialize directly from URL to avoid flash/race conditions
  const [isQuickMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    console.log('App mounted. Search params:', window.location.search);
    return params.get('mode') === 'quick';
  });

  // OCR dependency management
  const { ocrStatus, promptAndInstall } = useOcrDependencies();

  // Listen for open-settings event from tray menu
  useEffect(() => {
    if ((window as any).electron?.onOpenSettings) {
      (window as any).electron.onOpenSettings(() => {
        setShowSettings(true);
      });
    }
  }, []);

  // Sync auto-launch state with system on app startup
  useEffect(() => {
    const syncAutoLaunchState = async () => {
      if ((window as any).electron?.getAutoLaunch) {
        try {
          const result = await (window as any).electron.getAutoLaunch();
          if (result.success) {
            updateSettings({ launchAtStartup: result.enabled });
          }
        } catch (error) {
          console.error('Failed to sync auto-launch state:', error);
        }
      }
    };
    syncAutoLaunchState();
  }, [updateSettings]);

  // Prompt user to install OCR dependencies if missing (only once on first check)
  useEffect(() => {
    if (ocrStatus.checked && !ocrStatus.available && !hasPrompted.current && !isQuickMode) {
      hasPrompted.current = true;
      // Small delay to ensure UI is fully loaded
      const timer = setTimeout(() => {
        promptAndInstall();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [ocrStatus.checked, ocrStatus.available, isQuickMode, promptAndInstall]);

  if (isQuickMode) {
    return (
      <ErrorBoundary>
        <QuickTranslateWindow />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {/* Changed: Removed padding and centering. Now fills the viewport (window). */}
      <div className="w-screen h-screen bg-transparent overflow-hidden">
        {/* 
          Main Window Container 
          Changed: Removed fixed max-width and height. 
          Added h-full w-full to fill the Electron window.
          Removed rounded corners (optional, depending on if you want frameless window)
        */}
        <div className="app-window w-full h-full flex flex-col overflow-hidden relative transition-all duration-300">
          
          {/* Unified Header */}
          <TitleBar onOpenSettings={() => setShowSettings(true)} />
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden relative flex flex-col">
            <TranslatorView onOpenOCR={() => setShowOCR(true)} />
          </div>

          {/* Footer Info */}
          <div className="h-8 bg-white/20 border-t border-black/5 flex items-center justify-between px-4 text-[10px] text-macos-muted select-none backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/80 shadow-[0_0_5px_rgba(34,197,94,0.3)]"></div>
              <span className="font-medium text-macos-text/70">Ready</span>
            </div>
            <span className="opacity-50 font-medium">LightTranslator Desktop v1.0.2</span>
          </div>

          {/* Modals */}
          {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
          {showOCR && <OcrModal onClose={() => setShowOCR(false)} />}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;