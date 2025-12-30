import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Copy, Loader2, ExternalLink } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translateText } from '../services/geminiService';
import { cleanTextLineBreaks } from '../utils/textUtils';

// Window size constraints
const MIN_WIDTH = 200;
const MIN_HEIGHT = 100;
const MAX_WIDTH = 600;
const MAX_HEIGHT = 500;
const HEADER_HEIGHT = 32;
const PADDING = 32; // p-4 = 16px * 2

export const QuickTranslateWindow: React.FC = () => {
  const [, setText] = useState('');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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
    deeplApiKey,
    microsoftSubscriptionKey,
    microsoftRegion
  } = useAppStore();

  // Resize window to fit content
  const resizeToFitContent = useCallback(() => {
    if (!contentRef.current || !(window as any).electron) return;

    // Measure the actual content size
    const contentEl = contentRef.current;
    const contentWidth = contentEl.scrollWidth;
    const contentHeight = contentEl.scrollHeight;

    // Calculate desired window size (content + header + padding)
    const desiredWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, contentWidth + PADDING + 16));
    const desiredHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, contentHeight + HEADER_HEIGHT + PADDING));

    // Request resize via IPC
    (window as any).electron.resizeQuickWindow({ width: desiredWidth, height: desiredHeight });
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
    if ((window as any).electron) {
      (window as any).electron.sendQuickReady();

      (window as any).electron.onQuickTranslate((receivedText: string) => {
        console.log('Received text:', receivedText);
        // Clean up the text to remove unnecessary line breaks
        const cleanedText = cleanTextLineBreaks(receivedText);
        setText(cleanedText);
        handleTranslate(cleanedText);
      });
    }
  }, []);

  const handleTranslate = async (inputText: string) => {
    if (!inputText.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await translateText(inputText, sourceLang, targetLang, {
        provider,
        modelId,
        customSystemInstruction,
        geminiApiKey,
        openaiApiKey,
        openaiBaseUrl,
        openaiModel,
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
    if ((window as any).electron) {
      (window as any).electron.closeQuickWindow();
    }
  };

  return (
    <div className="h-screen w-screen bg-white/95 backdrop-blur-xl border-2 border-blue-500/50 flex flex-col overflow-hidden shadow-2xl relative">
      {/* Header / Drag Area */}
      <div className="h-8 bg-gray-100/80 flex items-center justify-between px-3 -webkit-app-region-drag border-b border-gray-200/50">
        <span className="text-xs font-medium text-gray-600">Quick Translate</span>
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
           <div className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold flex items-center gap-2">
             Translation
             {loading && <Loader2 size={10} className="animate-spin" />}
           </div>

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

      {/* Resize Handle Indicator */}
      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 opacity-30 hover:opacity-60 transition-opacity">
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-400">
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
};
