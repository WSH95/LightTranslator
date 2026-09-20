import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AppWindow, Check, Copy, LoaderCircle, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translateText } from '../services/translationService';
import { cleanTextLineBreaks } from '../utils/textUtils';
import { PROVIDERS, LANGUAGES } from '../constants';
import { platform } from '../src/lib/platform';
import { LanguagePill } from './ui';
import { LanguageCode } from '../types';

// The pop-up is a fixed 360 column (tauri.conf.json and electron/main.js pin
// min == max), so only the height ever tracks the content.
const WIDTH = 360;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 500;
// Enough for the whole language popover: 46 (its top) + 308 (6 + 9x32 + 8x1
// + 6, for the nine non-auto languages) + 8 of breathing room. The design
// sketch showed 300, but it only drew seven languages.
const MENU_OPEN_HEIGHT = 362;

// Languages available for target selection (exclude 'auto')
const TARGET_LANGUAGES = LANGUAGES.filter((lang) => lang.code !== 'auto');

export const QuickTranslateWindow: React.FC = () => {
  const [sourceText, setSourceText] = useState('');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  // Always-current handleTranslate for the mount-once event listener
  const handleTranslateRef = useRef<(text: string) => void>(() => {});
  // Monotonic token so a slow response can't overwrite a newer request
  const requestSeq = useRef(0);

  const {
    provider,
    quickSourceLang,
    quickTargetLang,
    setQuickTargetLang,
  } = useAppStore();

  const refreshSettings = useCallback(async () => {
    try {
      await useAppStore.persist.rehydrate();
    } catch (err) {
      console.warn('Failed to refresh settings from storage:', err);
    }
  }, []);

  /**
   * Measure the whole window body — header, text and footer — rather than
   * summing constants for each piece. The old version added HEADER_HEIGHT +
   * LANG_BAR_HEIGHT + PADDING, which silently drifts the moment the chrome
   * changes. Width is never computed: the window is pinned to 360, so a
   * content-derived width would grow it on every pass.
   */
  const resizeToFitContent = useCallback(() => {
    if (!measureRef.current || !platform.isAvailable()) return;
    const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, measureRef.current.scrollHeight));
    platform.resizeQuickWindow({ width: WIDTH, height });
  }, []);

  // Resize when translation changes
  useEffect(() => {
    if (translated || error) {
      setTimeout(resizeToFitContent, 50);
    }
  }, [translated, error, resizeToFitContent]);

  useEffect(() => {
    if (platform.isAvailable()) {
      // Signal readiness only AFTER the listener is registered — the backend
      // parks hotkey text until quick_window_ready, so the old order lost or
      // raced the very first event.
      return platform.onQuickTranslate(
        (receivedText: string) => {
          const cleanedText = cleanTextLineBreaks(receivedText);
          setSourceText(cleanedText);
          handleTranslateRef.current(cleanedText);
        },
        () => platform.sendQuickReady()
      );
    }
  }, []);

  // Close window when clicking outside (on blur)
  useEffect(() => {
    if (platform.isAvailable()) {
      const unlisten = platform.onWindowBlur(() => {
        platform.closeQuickWindow();
      });
      return unlisten;
    }
  }, []);

  const handleTranslate = async (inputText: string) => {
    if (!inputText.trim()) return;

    const seq = ++requestSeq.current;
    setTranslated('');
    setLoading(true);
    setError(null);

    try {
      await refreshSettings();
      const {
        quickSourceLang,
        quickTargetLang,
        provider,
        customSystemInstruction,
        systemPromptEnabled,
        openaiApiKey,
        openaiBaseUrl,
        openaiModel,
        deeplApiKey,
        microsoftSubscriptionKey,
        microsoftRegion
      } = useAppStore.getState();
      const result = await translateText(inputText, quickSourceLang, quickTargetLang, {
        provider,
        customSystemInstruction,
        systemPromptEnabled,
        openaiApiKey,
        openaiBaseUrl,
        openaiModel,
        deeplApiKey,
        microsoftSubscriptionKey,
        microsoftRegion
      });
      if (seq === requestSeq.current) setTranslated(result);
    } catch (err: any) {
      if (seq === requestSeq.current) setError(err.message || 'Translation failed');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  // Keep the listener's view of handleTranslate current on every render
  useEffect(() => {
    handleTranslateRef.current = handleTranslate;
  });

  const handleClose = () => {
    if (platform.isAvailable()) {
      platform.closeQuickWindow();
    }
  };

  // The window grows to hold the popover while it is open, then shrinks back.
  // Side effects stay OUT of any setState updater (React calls updaters twice
  // in StrictMode, doubling the resize).
  const handleMenuOpenChange = useCallback((open: boolean) => {
    setMenuOpen(open);
    if (!platform.isAvailable()) return;
    if (open) {
      platform.resizeQuickWindow({ width: WIDTH, height: MENU_OPEN_HEIGHT })
        .catch((e) => console.error('Failed to resize quick window:', e));
    } else {
      setTimeout(resizeToFitContent, 50);
    }
  }, [resizeToFitContent]);

  const handleSelectLang = async (code: LanguageCode) => {
    if (code === quickTargetLang) return;
    // Pull the latest persisted snapshot first so this write doesn't clobber
    // settings the main window saved while this window held a stale copy
    await refreshSettings();
    setQuickTargetLang(code);
    setTimeout(resizeToFitContent, 50);
    // Re-translate with the new target language
    if (sourceText.trim()) {
      setTimeout(() => handleTranslate(sourceText), 100);
    }
  };

  const handleCopy = async () => {
    if (!translated) return;
    try {
      await navigator.clipboard.writeText(translated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* nothing useful to say in a 360px pop-up */
    }
  };

  const handleOpenInMain = () => {
    if (!platform.isAvailable() || !sourceText.trim()) return;
    platform.openInMainWindow(sourceText)
      .catch((e) => console.error('Failed to open the main window:', e));
  };

  const providerName = PROVIDERS.find((entry) => entry.id === provider)?.name ?? 'Unknown';
  const sourceName = LANGUAGES.find((language) => language.code === quickSourceLang)?.name ?? quickSourceLang;

  return (
    <div
      className="h-screen w-screen rounded-xl overflow-hidden"
      style={{
        background: 'rgb(var(--bg-rgb) / var(--quick-bg-a))',
        // Inset, not an outer shadow: #root fills the window, so anything
        // drawn outside it never composites. quickWindowBorderOpacity feeds
        // the ring alpha, scaled per theme (see --quick-ring-scale).
        boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / calc(var(--quick-ring-a) * var(--quick-ring-scale)))',
      }}
    >
      <div ref={measureRef} className="flex flex-col">

        <div
          className="h-11 shrink-0 box-border flex items-center gap-1 px-2 select-none -webkit-app-region-drag"
          data-tauri-drag-region
        >
          <LanguagePill
            value={quickTargetLang}
            options={TARGET_LANGUAGES}
            onChange={handleSelectLang}
            onOpenChange={handleMenuOpenChange}
            title="Target language"
          />

          <div className="flex-1 self-stretch" data-tauri-drag-region />

          {/* While translating the header keeps only the pill and the close. */}
          {!loading && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!translated}
                className="icon-btn icon-btn-xs -webkit-app-region-no-drag"
                title="Copy translation"
                aria-label="Copy translation"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
              <button
                type="button"
                onClick={handleOpenInMain}
                disabled={!sourceText.trim()}
                className="icon-btn icon-btn-xs -webkit-app-region-no-drag"
                title="Open in main window"
                aria-label="Open in main window"
              >
                <AppWindow size={15} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="win-ctrl ml-1 -webkit-app-region-no-drag"
            title="Close"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {loading ? (
          <div className="px-4 pt-0.5 pb-3.5 flex items-center gap-2.5 text-sm text-muted">
            <LoaderCircle size={16} className="shrink-0 text-accent animate-spin" />
            Translating…
          </div>
        ) : (
          <>
            {/* Dimmed while the language popover is open. */}
            <div
              className={`px-4 pt-0.5 pb-3.5 transition-opacity duration-150 ${menuOpen ? 'opacity-40' : ''}`}
            >
              {error ? (
                <div className="text-sm text-danger">{error}</div>
              ) : (
                <div lang={quickTargetLang} className="translation-text text-text break-words">
                  {translated || (
                    <span lang="en" className="text-placeholder select-none">
                      Select text and press the shortcut
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 pb-2.5 flex items-center gap-2 text-[11px] text-muted">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="truncate">{providerName} · {sourceName}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
