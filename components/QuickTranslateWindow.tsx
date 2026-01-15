import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Copy, Loader2, ExternalLink } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translateText } from '../services/geminiService';
import { cleanTextLineBreaks } from '../utils/textUtils';
import { PROVIDERS } from '../constants';
import { platform } from '../src/lib/platform';

// Window size constraints
const MIN_WIDTH = 200;
const MIN_HEIGHT = 100;
const MAX_WIDTH = 600;
const MAX_HEIGHT = 500;
const HEADER_HEIGHT = 32;
const PADDING = 32; // p-4 = 16px * 2

export const QuickTranslateWindow: React.FC = () => {
  useEffect(() => {
    // Make body transparent for the rounded window
    document.body.style.background = 'transparent';
    return () => { document.body.style.background = ''; };
  }, []);

  const [, setText] = useState('');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    provider,
    quickWindowOpacity,
    quickWindowBorderOpacity
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

    // Measure the actual content size
    const contentEl = contentRef.current;
    const contentWidth = contentEl.scrollWidth;
    const contentHeight = contentEl.scrollHeight;

    // Calculate desired window size (content + header + padding)
    const desiredWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, contentWidth + PADDING + 16));
    const desiredHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, contentHeight + HEADER_HEIGHT + PADDING));

    // Request resize via platform API
    platform.resizeQuickWindow({ width: desiredWidth, height: desiredHeight });
  }, []);

  // Resize when translation changes
  useEffect(() => {
    if (translated || error) {
      // Small delay to ensure DOM is updated
      setTimeout(resizeToFitContent, 50);
    }
  }, [translated, error, resizeToFitContent]);

  useEffect(() => {
    // Notify main process that we are ready to receive text
    if (platform.isAvailable()) {
      platform.sendQuickReady();

      const unlisten = platform.onQuickTranslate((receivedText: string) => {
        console.log('Received text:', receivedText);
        // Clean up the text to remove unnecessary line breaks
        const cleanedText = cleanTextLineBreaks(receivedText);
        setText(cleanedText);
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

  const handleTranslate = async (inputText: string) => {
    if (!inputText.trim()) return;

    // Reset state for new translation
    setTranslated('');
    setLoading(true);
    setError(null);

    try {
      await refreshSettings();
      const {
        sourceLang,
        targetLang,
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
      const result = await translateText(inputText, sourceLang, targetLang, {
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
        <span className="text-xs font-medium text-gray-600 pointer-events-none select-none">Powered by {PROVIDERS.find(p => p.id === provider)?.name || 'Unknown'}</span>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-gray-200 rounded-full -webkit-app-region-no-drag transition-colors"
        >
          <X size={14} className="text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Translation Result Only */}
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
