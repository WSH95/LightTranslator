import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translateText } from '../services/geminiService';
import { cleanTextLineBreaks } from '../utils/textUtils';
import { PROVIDERS, LANGUAGES } from '../constants';
import { platform } from '../src/lib/platform';
import { LanguageCode } from '../types';

// Window size constraints
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;
const MAX_WIDTH = 600;
const MAX_HEIGHT = 500;
const HEADER_HEIGHT = 32;
const LANG_BAR_HEIGHT = 28;
const PADDING = 32; // p-4 = 16px * 2
const DROPDOWN_MIN_HEIGHT = 280; // Minimum window height when dropdown is open

// Languages available for target selection (exclude 'auto')
const TARGET_LANGUAGES = LANGUAGES.filter((lang) => lang.code !== 'auto');

export const QuickTranslateWindow: React.FC = () => {
  useEffect(() => {
    document.body.style.background = 'transparent';
    return () => { document.body.style.background = ''; };
  }, []);

  const [sourceText, setSourceText] = useState('');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    provider,
    quickWindowOpacity,
    quickWindowBorderOpacity,
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

  // Resize window to fit content
  const resizeToFitContent = useCallback(() => {
    if (!contentRef.current || !platform.isAvailable()) return;

    const contentEl = contentRef.current;
    const contentWidth = contentEl.scrollWidth;
    const contentHeight = contentEl.scrollHeight;

    const desiredWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, contentWidth + PADDING + 16));
    const desiredHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, contentHeight + HEADER_HEIGHT + LANG_BAR_HEIGHT + PADDING));

    platform.resizeQuickWindow({ width: desiredWidth, height: desiredHeight });
  }, []);

  // Resize when translation changes
  useEffect(() => {
    if (translated || error) {
      setTimeout(resizeToFitContent, 50);
    }
  }, [translated, error, resizeToFitContent]);

  useEffect(() => {
    if (platform.isAvailable()) {
      platform.sendQuickReady();

      const unlisten = platform.onQuickTranslate((receivedText: string) => {
        console.log('Received text:', receivedText);
        const cleanedText = cleanTextLineBreaks(receivedText);
        setSourceText(cleanedText);
        handleTranslate(cleanedText);
      });

      return unlisten;
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

  // Close dropdown when clicking outside it
  useEffect(() => {
    if (!langDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
        setTimeout(resizeToFitContent, 50);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [langDropdownOpen]);

  const handleTranslate = async (inputText: string) => {
    if (!inputText.trim()) return;

    setTranslated('');
    setLoading(true);
    setError(null);

    try {
      await refreshSettings();
      const {
        quickTargetLang,
        provider,
        modelId,
        customSystemInstruction,
        geminiApiKey,
        openaiApiKey,
        openaiBaseUrl,
        openaiModel,
        openrouterApiKey,
        openrouterModel,
        deeplApiKey,
        microsoftSubscriptionKey,
        microsoftRegion
      } = useAppStore.getState();
      const result = await translateText(inputText, 'auto', quickTargetLang, {
        provider,
        modelId,
        customSystemInstruction,
        geminiApiKey,
        openaiApiKey,
        openaiBaseUrl,
        openaiModel,
        openrouterApiKey,
        openrouterModel,
        deeplApiKey,
        microsoftSubscriptionKey,
        microsoftRegion
      });
      setTranslated(result);
    } catch (err: any) {
      setError(err.message || 'Translation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (platform.isAvailable()) {
      platform.closeQuickWindow();
    }
  };

  const toggleDropdown = useCallback(() => {
    setLangDropdownOpen((prev) => {
      const next = !prev;
      if (next && platform.isAvailable()) {
        // Expand window to fit dropdown
        platform.resizeQuickWindow({ width: MAX_WIDTH, height: DROPDOWN_MIN_HEIGHT });
      } else {
        // Shrink back after a brief delay for the close to render
        setTimeout(resizeToFitContent, 50);
      }
      return next;
    });
  }, [resizeToFitContent]);

  const handleSelectLang = (code: LanguageCode) => {
    if (code === quickTargetLang) {
      setLangDropdownOpen(false);
      return;
    }
    setQuickTargetLang(code);
    setLangDropdownOpen(false);
    setTimeout(resizeToFitContent, 50);
    // Re-translate with the new target language
    if (sourceText.trim()) {
      setTimeout(() => handleTranslate(sourceText), 100);
    }
  };

  const currentTargetName = TARGET_LANGUAGES.find((l) => l.code === quickTargetLang)?.name || quickTargetLang;

  return (
    <div
      className="h-screen w-screen backdrop-blur-3xl rounded-3xl flex flex-col overflow-hidden relative"
      style={{
        backgroundColor: `rgba(255, 255, 255, ${quickWindowOpacity})`,
        border: `1px solid rgba(150, 150, 150, ${quickWindowBorderOpacity * 2})`
      }}
    >
      {/* Header / Drag Area */}
      <div
        className="h-8 bg-gray-100/80 flex items-center justify-between px-3 -webkit-app-region-drag border-b border-gray-200/50"
        data-tauri-drag-region
      >
        <span className="text-xs font-medium text-gray-600 pointer-events-none select-none">
          Powered by {PROVIDERS.find(p => p.id === provider)?.name || 'Unknown'}
        </span>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-gray-200 rounded-full -webkit-app-region-no-drag transition-colors"
        >
          <X size={14} className="text-gray-500" />
        </button>
      </div>

      {/* Language Bar */}
      <div className="h-7 flex items-center px-3 border-b border-gray-200/30 bg-gray-50/40" ref={dropdownRef}>
        <span className="text-[11px] text-gray-400 mr-1.5 select-none">Translate to</span>
        <button
          onClick={toggleDropdown}
          className="flex items-center gap-0.5 text-[11px] font-medium text-gray-700 px-2 py-0.5 rounded-full bg-white/70 border border-gray-200/60 hover:bg-white hover:border-gray-300/80 transition-all -webkit-app-region-no-drag"
        >
          {currentTargetName}
          <ChevronDown size={10} className={`text-gray-400 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Custom Dropdown */}
        {langDropdownOpen && (
          <div className="absolute left-3 top-[60px] z-50 min-w-[140px] max-h-[200px] overflow-y-auto rounded-xl bg-white/95 backdrop-blur-xl border border-gray-200/70 shadow-lg py-1">
            {TARGET_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelectLang(lang.code)}
                className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                  lang.code === quickTargetLang
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div ref={contentRef} className="space-y-2">
          {loading && <Loader2 size={10} className="animate-spin text-blue-400" />}

          {error ? (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">
              {error}
            </div>
          ) : (
            <div className="text-sm text-gray-900 font-medium leading-relaxed break-words">
              {translated || <span className="text-gray-300 italic">Translating...</span>}
            </div>
          )}
        </div>
      </div>


    </div>
  );
};
