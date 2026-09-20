import React, { useEffect, useCallback, useRef, useState } from 'react';
import { X, Copy, Check, ScanText, Loader2, ClipboardList } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translateText, translateImage } from '../services/translationService';
import { cleanTextLineBreaks } from '../utils/textUtils';
import { PROVIDERS } from '../constants';
import { platform } from '../src/lib/platform';

interface TranslatorViewProps {
  onOpenOCR: () => void;
}

export const TranslatorView: React.FC<TranslatorViewProps> = ({ onOpenOCR }) => {
  const {
    inputText,
    translatedText,
    sourceLang,
    targetLang,
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

  // Clear stale verification state when provider or model changes
  useEffect(() => {
    clearModelVerification();
  }, [provider, openaiModel, clearModelVerification]);

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

  return (
    <div className="flex flex-col h-full overflow-hidden relative font-sans px-4 pb-4 gap-3">

      {/* Top: Input Area - Glass Card */}
      <div className="flex-1 min-h-0 bg-macos-card border border-macos-cardBorder shadow-macos-card rounded-2xl p-4 relative group flex flex-col transition-all focus-within:ring-2 focus-within:ring-macos-active/20 focus-within:border-macos-active/50">
        <textarea
          ref={textareaRef}
          className="w-full flex-1 min-h-0 bg-transparent resize-none focus:outline-none text-lg text-gray-800 placeholder-gray-400 font-normal leading-relaxed tracking-normal overflow-y-auto"
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

        {isProcessingImage && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl z-10">
            <Loader2 size={32} className="text-macos-active animate-spin mb-3" />
            <span className="text-sm font-semibold text-macos-text tracking-wide">Scanning Image...</span>
          </div>
        )}

        {/* Floating Controls for Input */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
          <button
            onClick={onOpenOCR}
            className={`p-1.5 bg-white shadow-sm border rounded-lg transition-colors hover:scale-105 relative ${ocrStatus.available
                ? 'border-black/5 text-macos-muted hover:text-macos-active'
                : 'border-amber-500/30 text-amber-500 hover:text-amber-600'
              }`}
            title={ocrStatus.available ? 'Upload Image for OCR' : 'OCR Unavailable - Click to install dependencies'}
          >
            <ScanText size={16} />
            {!ocrStatus.available && ocrStatus.checked && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </button>
          <button
            onClick={handleClipboardTranslate}
            className="p-1.5 bg-white shadow-sm border border-black/5 rounded-lg text-macos-muted hover:text-macos-active transition-colors hover:scale-105"
            title="Paste & Translate"
          >
            <ClipboardList size={16} />
          </button>
          {inputText && (
            <button
              onClick={() => { setInputText(''); setTranslatedText(''); textareaRef.current?.focus(); }}
              className="p-1.5 bg-white shadow-sm border border-black/5 rounded-lg text-macos-muted hover:text-red-500 transition-colors hover:scale-105"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom: Output Area - Darker/Different Card.
          The output carries lang={targetLang}: it drives the CJK glyph
          variant, e.g. the ideographic full stop sits at the bottom-left in
          Simplified Chinese and centred in Traditional. Without it the engine
          picks whichever CJK font fontconfig offers an English document. */}
      <div className="flex-1 min-h-0 bg-white/30 border border-macos-cardBorder shadow-sm rounded-2xl p-4 relative group transition-colors flex flex-col">
        {errorMessage ? (
          <div className="h-full flex items-center justify-center text-red-500 text-sm font-medium animate-in fade-in">
            <span className="bg-red-50 px-4 py-2 rounded-lg border border-red-100 shadow-sm">{errorMessage}</span>
          </div>
        ) : (
          <div
            lang={targetLang}
            className="w-full flex-1 min-h-0 text-lg text-gray-800 font-normal leading-relaxed overflow-y-auto whitespace-pre-wrap selection:bg-macos-active/20"
          >
            {translatedText || <span lang="en" className="text-gray-400 select-none italic">Translation will appear here...</span>}
          </div>
        )}

        {isTranslating && (
          <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-2 py-1 rounded-md shadow-sm border border-black/5">
            <Loader2 size={16} className="text-macos-active animate-spin" />
          </div>
        )}

        {/* Floating Controls for Output */}
        {translatedText && !isTranslating && (
          <button
            onClick={handleCopy}
            className="absolute top-4 right-4 p-2 bg-white hover:bg-macos-active hover:text-white rounded-xl text-macos-muted transition-all opacity-0 group-hover:opacity-100 shadow-md border border-black/5 scale-90 hover:scale-100 active:scale-95"
            title="Copy"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        )}
      </div>
    </div>
  );
};
