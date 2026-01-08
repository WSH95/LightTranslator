import React, { useEffect, useCallback, useRef, useState } from 'react';
import { X, Copy, Check, ScanText, Loader2, ArrowDown, ClipboardList, AlertTriangle, Bot, Cloud, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translateText, translateImage, verifyModelIdentity } from '../services/geminiService';
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
    modelId,
    customSystemInstruction,
    systemPromptEnabled,
    geminiApiKey,
    openaiApiKey,
    openaiBaseUrl,
    openaiModel,
    openrouterApiKey,
    openrouterModel,
    deeplApiKey,
    microsoftSubscriptionKey,
    microsoftRegion,
    ocrStatus,
    modelVerification,
    setInputText,
    setTranslatedText,
    setIsTranslating,
    setErrorMessage,
    setModelVerification,
    clearModelVerification
  } = useAppStore();

  const [copied, setCopied] = React.useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // We use a ref to track the latest request to prevent race conditions
  const latestRequestText = useRef<string>('');

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
        modelId,
        customSystemInstruction,
        systemPromptEnabled,
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
  }, [sourceLang, targetLang, provider, modelId, customSystemInstruction, systemPromptEnabled, geminiApiKey, openaiApiKey, openaiBaseUrl, openaiModel, openrouterApiKey, openrouterModel, deeplApiKey, microsoftSubscriptionKey, microsoftRegion, setIsTranslating, setErrorMessage, setTranslatedText]);

  useEffect(() => {
    if (!autoTranslate) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (inputText.trim()) {
      debounceTimer.current = setTimeout(() => performTranslation(inputText), debounceMs);
    } else {
      // If input is cleared, clear immediately and cancel any pending translation display
      setTranslatedText('');
      setIsTranslating(false);
      latestRequestText.current = '';
    }
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [inputText, performTranslation, autoTranslate, debounceMs, setTranslatedText, setIsTranslating]);

  // Listen for OCR result from tray menu
  useEffect(() => {
    if (platform.isAvailable()) {
      const unlisten = platform.onOcrResult((text: string) => {
        setInputText(text);
        performTranslation(text);
      });
      return unlisten;
    }
  }, [setInputText, performTranslation]);

  // Get provider info
  const currentProvider = PROVIDERS.find(p => p.id === provider);
  const isLlmProvider = currentProvider?.category === 'llm';

  // Get the configured model name for display
  const configuredModelName = provider === 'gemini' ? modelId : provider === 'openrouter' ? openrouterModel : openaiModel;

  // Clear verification when provider or model changes (don't auto-verify to save quota)
  useEffect(() => {
    clearModelVerification();
  }, [provider, modelId, openaiModel, openrouterModel, clearModelVerification]);

  // Manual verification handler - only runs when user clicks verify button
  const handleVerify = useCallback(async () => {
    if (!isLlmProvider) return;

    // Check credentials
    const hasCredentials =
      (provider === 'gemini' && geminiApiKey) ||
      (provider === 'openai' && openaiApiKey && openaiBaseUrl) ||
      (provider === 'openrouter' && openrouterApiKey);

    if (!hasCredentials) {
      setModelVerification({
        isVerifying: false,
        verifiedIdentity: null,
        error: 'API key not configured'
      });
      return;
    }

    setModelVerification({ isVerifying: true, error: null });

    try {
      const identity = await verifyModelIdentity({
        provider,
        geminiApiKey,
        modelId,
        openaiBaseUrl,
        openaiApiKey,
        openaiModel,
        openrouterApiKey,
        openrouterModel
      });

      setModelVerification({
        isVerifying: false,
        verifiedIdentity: identity,
        lastVerifiedAt: Date.now(),
        error: null
      });
    } catch (error: any) {
      setModelVerification({
        isVerifying: false,
        verifiedIdentity: null,
        error: error.message || 'Verification failed'
      });
    }
  }, [provider, geminiApiKey, modelId, openaiApiKey, openaiBaseUrl, openaiModel, openrouterApiKey, openrouterModel, isLlmProvider, setModelVerification]);

  const handleCopy = () => {
    if (translatedText) {
      navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClipboardTranslate = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleanedText = cleanTextLineBreaks(text);
        setInputText(cleanedText);
        performTranslation(cleanedText);
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
        const result = await translateImage(reader.result as string, targetLang, { modelId, geminiApiKey });
        setInputText(result.detectedText);
        setTranslatedText(result.translatedText);
      } catch (err) {
        setErrorMessage("Failed to process pasted image.");
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
              performTranslation(inputText);
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

      {/* Bottom: Output Area - Darker/Different Card */}
      <div className="flex-1 min-h-0 bg-white/30 border border-macos-cardBorder shadow-sm rounded-2xl p-4 relative group transition-colors flex flex-col">
        {errorMessage ? (
          <div className="h-full flex items-center justify-center text-red-500 text-sm font-medium animate-in fade-in">
            <span className="bg-red-50 px-4 py-2 rounded-lg border border-red-100 shadow-sm">{errorMessage}</span>
          </div>
        ) : (
          <div className="w-full flex-1 min-h-0 text-lg text-gray-800 font-normal leading-relaxed overflow-y-auto whitespace-pre-wrap selection:bg-macos-active/20">
            {translatedText || <span className="text-gray-400 select-none italic">Translation will appear here...</span>}
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