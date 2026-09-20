import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  ArrowRightLeft, Check, ClipboardList, Copy, LoaderCircle, ScanText, X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translateText, translateImage } from '../services/translationService';
import { cleanTextLineBreaks } from '../utils/textUtils';
import { LANGUAGES, PROVIDERS } from '../constants';
import { platform } from '../src/lib/platform';
import { LanguagePill } from './ui';

const TARGET_LANGUAGES = LANGUAGES.filter((language) => language.code !== 'auto');

interface TranslatorViewProps {
  onOpenOCR: () => void;
}

export const TranslatorView: React.FC<TranslatorViewProps> = ({ onOpenOCR }) => {
  const {
    inputText,
    translatedText,
    sourceLang,
    targetLang,
    setSourceLang,
    setTargetLang,
    autoTranslate,
    debounceMs,
    isTranslating,
    errorMessage,
    provider,
    customSystemInstruction,
    systemPromptEnabled,
    openaiApiKey,
    openaiBaseUrl,
    openaiModel,
    deeplApiKey,
    microsoftSubscriptionKey,
    microsoftRegion,
    ocrStatus,
    setInputText,
    setTranslatedText,
    setIsTranslating,
    setErrorMessage,
    clearModelVerification
  } = useAppStore();

  const [copied, setCopied] = React.useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // We use a ref to track the latest request to prevent race conditions
  const latestRequestText = useRef<string>('');
  // Image translation already supplies the translated result. Suppress only
  // the matching auto-translate pass; a later language or text change still
  // translates normally.
  const skipAutoTranslateRef = useRef<{
    text: string;
    sourceLang: string;
    targetLang: string;
  } | null>(null);

  const performTranslation = useCallback(async (text: string) => {
    // Immediate clear if empty, providing instant feedback
    if (!text.trim()) {
      setTranslatedText("");
      setIsTranslating(false);
      return;
    }

    setIsTranslating(true);
    setErrorMessage(null);
    latestRequestText.current = text;

    try {
      const result = await translateText(text, sourceLang, targetLang, {
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

      // Race Condition Check:
      // Only update state if the text we just translated matches the *current* input text
      // and also matches what we believe was the last requested text.
      const currentInput = useAppStore.getState().inputText;

      if (text === currentInput && text === latestRequestText.current) {
        setTranslatedText(result);
      }
    } catch (err: any) {
      const currentInput = useAppStore.getState().inputText;
      if (text === currentInput) {
        setErrorMessage(err.message || "Translation failed. Check settings.");
      }
    } finally {
      // Only turn off loading if we are still on the same request
      const currentInput = useAppStore.getState().inputText;
      if (text === currentInput) {
        setIsTranslating(false);
      }
    }
  }, [sourceLang, targetLang, provider, customSystemInstruction, systemPromptEnabled, openaiApiKey, openaiBaseUrl, openaiModel, deeplApiKey, microsoftSubscriptionKey, microsoftRegion, setIsTranslating, setErrorMessage, setTranslatedText]);

  // performTranslation's identity changes with every settings value; effects
  // call through this ref so editing a key/model/prompt in Settings doesn't
  // re-fire translations or re-register listeners.
  const performTranslationRef = useRef(performTranslation);
  useEffect(() => {
    performTranslationRef.current = performTranslation;
  });

  const cancelPendingDebounce = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, []);

  const setInputAndTranslateOnce = useCallback((text: string) => {
    const state = useAppStore.getState();
    const inputChanged = state.inputText !== text;
    // Cancel the previous input's timer before changing state. Waiting for the
    // next effect cleanup leaves a small window where the stale request fires.
    cancelPendingDebounce();
    setInputText(text);

    // Auto-translate owns changed input. Explicit actions still work when it
    // is disabled, and re-run once when the requested text is already shown.
    if (!state.autoTranslate || !inputChanged) {
      performTranslationRef.current(text);
    }
  }, [cancelPendingDebounce, setInputText]);

  const performImmediateTranslation = useCallback((text: string) => {
    cancelPendingDebounce();
    performTranslation(text);
  }, [cancelPendingDebounce, performTranslation]);

  useEffect(() => {
    if (!autoTranslate) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const skip = skipAutoTranslateRef.current;
    if (skip) {
      skipAutoTranslateRef.current = null;
      if (
        skip.text === inputText &&
        skip.sourceLang === sourceLang &&
        skip.targetLang === targetLang
      ) {
        return;
      }
    }

    if (inputText.trim()) {
      debounceTimer.current = setTimeout(() => performTranslationRef.current(inputText), debounceMs);
    } else {
      // If input is cleared, clear immediately and cancel any pending translation display
      setTranslatedText('');
      setIsTranslating(false);
      latestRequestText.current = '';
    }
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    // sourceLang/targetLang stay as triggers on purpose: changing language
    // should retranslate. Other settings edits should not.
  }, [inputText, autoTranslate, debounceMs, sourceLang, targetLang, setTranslatedText, setIsTranslating]);

  // Listen for OCR result from tray menu (registered once, not per settings edit)
  useEffect(() => {
    if (platform.isAvailable()) {
      const unlisten = platform.onOcrResult((text: string) => {
        const cleaned = cleanTextLineBreaks(text);
        setInputAndTranslateOnce(cleaned);
      });
      return unlisten;
    }
  }, [setInputAndTranslateOnce]);

  // Text handed over by the pop-up's "open in main window" button.
  useEffect(() => {
    if (platform.isAvailable()) {
      return platform.onQuickToMain((text: string) => {
        setInputAndTranslateOnce(cleanTextLineBreaks(text));
      });
    }
  }, [setInputAndTranslateOnce]);

  // Clear stale verification state when provider or model changes
  useEffect(() => {
    clearModelVerification();
  }, [provider, openaiModel, clearModelVerification]);

  // Moved here from the title bar: the language choosers now live in the
  // panes, and the swap control sits in the gap between them.
  const handleSwap = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const handleCopy = async () => {
    if (translatedText) {
      try {
        await navigator.clipboard.writeText(translatedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setErrorMessage('Failed to copy to clipboard.');
      }
    }
  };

  const handleClipboardTranslate = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleanedText = cleanTextLineBreaks(text);
        setInputAndTranslateOnce(cleanedText);
      }
    } catch (err) {
      setErrorMessage("Failed to read clipboard.");
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        cancelPendingDebounce();
        const blob = items[i].getAsFile();
        if (blob) processPastedImage(blob);
        return;
      }
    }
  };

  const processPastedImage = (file: File) => {
    setIsProcessingImage(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setErrorMessage(null);
        const result = await translateImage(reader.result as string, targetLang, {
          provider,
          openaiBaseUrl,
          openaiApiKey,
          openaiModel,
        });
        cancelPendingDebounce();
        skipAutoTranslateRef.current = {
          text: result.detectedText,
          sourceLang,
          targetLang,
        };
        setInputText(result.detectedText);
        setTranslatedText(result.translatedText);
      } catch (err: any) {
        // Image translation needs the OpenAI-compatible provider on a
        // vision-capable model; surface the real cause rather than a
        // generic message so the user knows what to change.
        setErrorMessage(err?.message || "Failed to process pasted image.");
      } finally {
        setIsProcessingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const providerName = PROVIDERS.find((entry) => entry.id === provider)?.name ?? 'Unknown';
  const busy = isTranslating || isProcessingImage;
  const status = isProcessingImage
    ? 'Scanning image\u2026'
    : isTranslating
      ? 'Translating\u2026'
      : `Ready \u00b7 ${providerName}`;

  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 pt-1 px-3 pb-3 relative">

      {/* ---------------- source ---------------- */}
      <div className="card pane overflow-hidden flex flex-col min-h-0">
        <div className="h-12 shrink-0 flex items-center justify-between pl-[10px] pr-2">
          <LanguagePill
            value={sourceLang}
            options={LANGUAGES}
            onChange={setSourceLang}
            title="Source language"
          />
          <div className="flex gap-[2px]">
            <button
              type="button"
              onClick={onOpenOCR}
              className="icon-btn icon-btn-sm"
              title={ocrStatus.available ? 'OCR screenshot or image' : 'OCR unavailable \u2014 click to install dependencies'}
              aria-label="OCR screenshot or image"
            >
              <ScanText size={15} />
            </button>
            <button
              type="button"
              onClick={handleClipboardTranslate}
              className="icon-btn icon-btn-sm"
              title="Paste and translate"
              aria-label="Paste and translate"
            >
              <ClipboardList size={15} />
            </button>
            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setTranslatedText('');
                  textareaRef.current?.focus();
                }}
                className="icon-btn icon-btn-sm"
                title="Clear"
                aria-label="Clear"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          className="translation-text flex-1 min-h-0 w-full bg-transparent resize-none overflow-y-auto focus:outline-none text-text placeholder:text-placeholder pt-1.5 px-4 pb-4 selection:bg-accent/20"
          placeholder="Enter text..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              performImmediateTranslation(inputText);
            }
          }}
          onPaste={handlePaste}
          spellCheck="false"
        />
      </div>

      {/* ---------------- target ---------------- */}
      <div className="card pane overflow-hidden flex flex-col min-h-0">
        <div className="h-12 shrink-0 flex items-center justify-between pl-[10px] pr-2">
          <LanguagePill
            value={targetLang}
            options={TARGET_LANGUAGES}
            onChange={setTargetLang}
            align="left"
            title="Target language"
          />
          <button
            type="button"
            onClick={handleCopy}
            disabled={!translatedText}
            className="icon-btn icon-btn-sm"
            title="Copy translation"
            aria-label="Copy translation"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>

        {/* lang={targetLang} drives the CJK glyph variant: the ideographic
            full stop sits bottom-left in Simplified Chinese and centred in
            Traditional. Without it the engine picks whichever CJK font
            fontconfig offers an English document. */}
        <div
          lang={targetLang}
          className="translation-text flex-1 min-h-0 overflow-y-auto whitespace-pre-wrap pt-1.5 px-4 pb-4 text-text selection:bg-accent/20"
        >
          {errorMessage ? (
            <span lang="en" className="text-sm text-danger">{errorMessage}</span>
          ) : (
            translatedText || (
              <span lang="en" className="text-placeholder select-none">Translation will appear here...</span>
            )
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2 px-4 pb-3 text-xs text-muted">
          {busy
            ? <LoaderCircle size={16} className="shrink-0 text-accent animate-spin" />
            : <span className="shrink-0 w-[7px] h-[7px] rounded-full bg-accent" />}
          <span className="truncate">{status}</span>
        </div>
      </div>

      {/* Deliberately off-centre: the spec places this 32px below the grid's
          padding box, so it straddles the bottom edge of the pane top rows
          rather than centring on them. */}
      <button
        type="button"
        onClick={handleSwap}
        disabled={sourceLang === 'auto'}
        className="swap-btn absolute left-1/2 -translate-x-1/2 top-[32px]"
        title={sourceLang === 'auto' ? 'Pick a source language to swap' : 'Swap languages'}
        aria-label="Swap languages"
      >
        <ArrowRightLeft size={13} />
      </button>
    </div>
  );
};
