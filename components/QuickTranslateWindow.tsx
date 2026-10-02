import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { AppWindow, Check, Copy, LoaderCircle, Move, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translateText } from '../services/translationService';
import { cleanTextLineBreaks } from '../utils/textUtils';
import { PROVIDERS, LANGUAGES } from '../constants';
import { platform, type QuickMoveState } from '../src/lib/platform';
import { LanguagePill } from './ui';
import { LanguageCode } from '../types';
import { measureQuickWindowLayout } from '../utils/quickWindowDomSizing';
import { QuickWindowResizeCoordinator } from '../utils/quickWindowSizing';

// Languages available for target selection (exclude 'auto')
const TARGET_LANGUAGES = LANGUAGES.filter((lang) => lang.code !== 'auto');

export const QuickTranslateWindow: React.FC = () => {
  const [sourceText, setSourceText] = useState('');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moveState, setMoveState] = useState<QuickMoveState | null>(null);
  const [movePending, setMovePending] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const moveStateRef = useRef<QuickMoveState | null>(null);
  const movePendingRef = useRef(false);
  const moveRequestRef = useRef(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const resizeCoordinatorRef = useRef<QuickWindowResizeCoordinator | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current handleTranslate for the mount-once event listener
  const handleTranslateRef = useRef<(text: string) => void>(() => {});
  // Monotonic token so a slow response can't overwrite a newer request
  const requestSeq = useRef(0);

  const {
    provider,
    quickSourceLang,
    quickTargetLang,
    quickWindowMaxWidth,
    translationTextSize,
    setQuickTargetLang,
  } = useAppStore();

  const refreshSettings = useCallback(async () => {
    try {
      await useAppStore.persist.rehydrate();
    } catch (err) {
      console.warn('Failed to refresh settings from storage:', err);
    }
  }, []);

  const acceptMoveState = useCallback((next: QuickMoveState) => {
    const current = moveStateRef.current;
    if (current && next.revision <= current.revision) return;
    if (current?.openingId !== next.openingId) {
      // A new opening/closure invalidates both pending replies and their errors.
      moveRequestRef.current += 1;
      movePendingRef.current = false;
      setMovePending(false);
      setMoveError(null);
    }
    moveStateRef.current = next;
    setMoveState(next);
  }, []);

  const handleMoveToggle = async () => {
    const current = moveStateRef.current;
    if (!current || movePendingRef.current) return;
    const request = ++moveRequestRef.current;
    movePendingRef.current = true;
    setMovePending(true);
    setMoveError(null);
    try {
      const confirmed = await platform.setQuickMoveMode(current.openingId, !current.enabled);
      if (request === moveRequestRef.current) acceptMoveState(confirmed);
    } catch {
      if (request === moveRequestRef.current) setMoveError('Could not change Move mode. Try again.');
    } finally {
      if (request === moveRequestRef.current) {
        movePendingRef.current = false;
        setMovePending(false);
      }
    }
  };

  // One coordinator owns every layout-triggered resize. It measures clones
  // outside the viewport-sized root, coalesces invalidations into one frame,
  // serializes IPC, and ignores dimensions already applied.
  useLayoutEffect(() => {
    if (!platform.isAvailable()) return;
    const coordinator = new QuickWindowResizeCoordinator({
      measure: () => {
        const header = headerRef.current;
        const scrollContainer = scrollContainerRef.current;
        if (!header || !scrollContainer) return null;
        return measureQuickWindowLayout({
          header,
          scrollContainer,
          footer: footerRef.current,
          menu: menuRef.current,
          maximumWidth: useAppStore.getState().quickWindowMaxWidth,
        });
      },
      resize: (dimensions) => platform.resizeQuickWindow(dimensions),
    });
    resizeCoordinatorRef.current = coordinator;
    coordinator.request();
    return () => {
      coordinator.dispose();
      if (resizeCoordinatorRef.current === coordinator) resizeCoordinatorRef.current = null;
    };
  }, []);

  // State, settings and font changes all feed the same coordinator. A
  // ResizeObserver catches late glyph/font geometry without deriving width
  // from the viewport or starting a second sizing path.
  useLayoutEffect(() => {
    resizeCoordinatorRef.current?.request();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => resizeCoordinatorRef.current?.request());
    [headerRef.current, scrollContainerRef.current, bodyRef.current, footerRef.current]
      .filter((element): element is HTMLElement => element !== null)
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [
    translated,
    error,
    loading,
    menuOpen,
    quickWindowMaxWidth,
    translationTextSize,
    provider,
    quickSourceLang,
    quickTargetLang,
    moveError,
  ]);

  useEffect(() => {
    const fonts = document.fonts;
    let cancelled = false;
    const requestLayout = () => {
      if (!cancelled) resizeCoordinatorRef.current?.request();
    };
    void fonts.ready.then(requestLayout);
    fonts.addEventListener('loadingdone', requestLayout);
    return () => {
      cancelled = true;
      fonts.removeEventListener('loadingdone', requestLayout);
    };
  }, []);

  useEffect(() => () => {
    requestSeq.current += 1;
    moveRequestRef.current += 1;
    movePendingRef.current = false;
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  useEffect(() => {
    if (platform.isAvailable()) {
      // Both listeners must exist before the backend sends its state snapshot
      // and any parked text. Each disposer also handles StrictMode remounts.
      let registered = 0;
      const onRegistered = () => {
        if (++registered === 2) platform.sendQuickReady();
      };
      const stopMove = platform.onQuickMoveState(acceptMoveState, onRegistered);
      const stopText = platform.onQuickTranslate(
        (receivedText: string) => {
          const cleanedText = cleanTextLineBreaks(receivedText);
          setSourceText(cleanedText);
          handleTranslateRef.current(cleanedText);
        },
        onRegistered
      );
      return () => { stopMove(); stopText(); };
    }
  }, [acceptMoveState]);

  // Hide-on-blur lives in the backend; Escape remains an explicit dismissal.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && platform.isAvailable()) {
        platform.closeQuickWindow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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

  const handleMenuOpenChange = useCallback((open: boolean) => {
    setMenuOpen(open);
  }, []);

  const handleMenuElementChange = useCallback((element: HTMLDivElement | null) => {
    menuRef.current = element;
    resizeCoordinatorRef.current?.request();
  }, []);

  const handleSelectLang = async (code: LanguageCode) => {
    if (code === quickTargetLang) return;
    // Pull the latest persisted snapshot first so this write doesn't clobber
    // settings the main window saved while this window held a stale copy
    await refreshSettings();
    setQuickTargetLang(code);
    // Re-translate with the new target language
    if (sourceText.trim()) {
      void handleTranslate(sourceText);
    }
  };

  const handleCopy = async () => {
    if (!translated) return;
    try {
      await navigator.clipboard.writeText(translated);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        copiedTimerRef.current = null;
        setCopied(false);
      }, 2000);
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
      className="h-screen w-screen rounded-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgb(var(--bg-rgb) / var(--quick-bg-a))',
        // The Opacity slider has been user-facing since before the refresh,
        // and alpha with no blur is just a muddy ghost of the desktop. This
        // is independent of the glass theme, which governs the main window.
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        // Inset, not an outer shadow: #root fills the window, so anything
        // drawn outside it never composites. quickWindowBorderOpacity feeds
        // the ring alpha, scaled per theme (see --quick-ring-scale).
        boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / calc(var(--quick-ring-a) * var(--quick-ring-scale)))',
      }}
    >
      <div
        ref={headerRef}
        className="quick-window-header h-11 shrink-0 box-border flex items-center gap-1 px-2 select-none"
      >
        <LanguagePill
          value={quickTargetLang}
          options={TARGET_LANGUAGES}
          onChange={handleSelectLang}
          onOpenChange={handleMenuOpenChange}
          onMenuElementChange={handleMenuElementChange}
          title="Target language"
        />

        <div
          className={`flex-1 self-stretch min-w-6 ${moveState?.enabled ? 'cursor-move -webkit-app-region-drag' : ''}`}
          data-tauri-drag-region={moveState?.enabled ? '' : undefined}
          title={moveState?.enabled ? 'Drag the header; stays open' : undefined}
        />

        {platform.isAvailable() && (
          <button
            type="button"
            onClick={handleMoveToggle}
            disabled={!moveState}
            aria-disabled={movePending}
            className="icon-btn icon-btn-xs quick-move-toggle -webkit-app-region-no-drag"
            aria-label="Move"
            aria-pressed={moveState?.enabled ?? false}
            aria-busy={movePending}
            title={moveState?.enabled
              ? 'Drag the header; stays open. Click to restore automatic closing.'
              : 'Move: keep open and drag the header'}
          >
            <Move size={15} />
          </button>
        )}

        {/* Move stays available during translation. */}
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

      {/* The scroll container. Its absence was the regression: a translation
          past the window's max height was clipped with no way to reach it. */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div ref={bodyRef} className="px-4 pt-0.5 pb-3.5 flex items-center gap-2.5 text-sm text-muted">
            <LoaderCircle size={16} className="shrink-0 text-accent animate-spin" />
            Translating…
          </div>
        ) : (
          /* Dimmed while the language popover is open. */
          <div
            ref={bodyRef}
            className={`px-4 pt-0.5 pb-3.5 transition-opacity duration-150 ${menuOpen ? 'opacity-40' : ''}`}
          >
            {error ? (
              <div className="text-sm text-danger whitespace-pre-wrap [overflow-wrap:anywhere]">{error}</div>
            ) : (
              <div
                lang={quickTargetLang}
                className="translation-text text-text whitespace-pre-wrap [overflow-wrap:anywhere]"
              >
                {translated || (
                  <span lang="en" className="text-placeholder select-none">
                    Select text and press the shortcut
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {(!loading || moveError) && (
        <div ref={footerRef} className="shrink-0 px-4 pb-2.5 flex items-center gap-2 text-[11px] text-muted">
          {moveError ? (
            <span role="status" className="text-danger">{moveError}</span>
          ) : (
            <>
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="truncate">{providerName} · {sourceName}</span>
            </>
          )}
        </div>
      )}

    </div>
  );
};
