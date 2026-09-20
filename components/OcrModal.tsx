import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Loader2, Scissors, AlertTriangle, Copy, Check, RefreshCw } from 'lucide-react';
import { translateText } from '../services/translationService';
import { cleanTextLineBreaks } from '../utils/textUtils';
import { useAppStore } from '../store/useAppStore';
import { useOcrDependencies } from '../hooks/useOcrDependencies';
import { platform } from '../src/lib/platform';

interface OcrModalProps {
  onClose: () => void;
}

export const OcrModal: React.FC<OcrModalProps> = ({ onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<number | null>(null);

  // On-demand OCR dependency check: runs when the modal opens, never at
  // app startup. Missing components render as install guidance below.
  const { ocrStatus, guidance, recheck, isOcrAvailable, isChecking } = useOcrDependencies();

  useEffect(() => {
    recheck();
    // recheck is stable; run once per modal open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyCommand = async (command: string, index: number) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(index);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch {
      /* leave the command selectable for manual copy */
    }
  };

  const {
    sourceLang,
    targetLang,
    setInputText,
    setTranslatedText,
    provider,
    customSystemInstruction,
    systemPromptEnabled,
    openaiApiKey,
    openaiBaseUrl,
    openaiModel,
    deeplApiKey,
    microsoftSubscriptionKey,
    microsoftRegion
  } = useAppStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScreenCapture = async () => {
    if (!platform.isAvailable()) {
      setError('Screenshot feature is not available');
      return;
    }

    setIsCapturing(true);
    setError(null);

    try {
      const result = await platform.captureScreen();

      if (result) {
        setPreview(result);
      }
      // If result is null, user cancelled - do nothing
    } catch (err: any) {
      setError(`Screenshot failed: ${err.message}`);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!preview) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Use local Tesseract OCR to extract text
      if (!platform.isAvailable()) {
        throw new Error('OCR feature is not available');
      }

      const ocrResult = await platform.ocrImage(preview);

      if (!ocrResult.success) {
        throw new Error(ocrResult.error || 'OCR failed');
      }

      // Backends return raw OCR layout; reflow paragraphs in shared code so
      // every backend yields the same text
      const extractedText = cleanTextLineBreaks(ocrResult.text || '');
      setInputText(extractedText);

      // Step 2: Translate using the user's selected provider
      const translatedResult = await translateText(extractedText, sourceLang, targetLang, {
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

      setTranslatedText(translatedResult);
      onClose();
    } catch (err: any) {
      console.error('OCR Error:', err);
      setError(err.message || 'Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 rounded-[var(--window-radius)]">
      {/* max-h-full + a scrolling body keep the dialog inside the window at any
          size; without it the install-guidance block overflows a 680px window */}
      <div className="bg-white/80 backdrop-blur-3xl border border-white/40 rounded-2xl w-full max-w-md max-h-full shadow-macos-window text-macos-text flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon size={18} className="text-macos-active" />
            OCR Screenshot/Image
          </h3>
          <button onClick={onClose} className="text-macos-muted hover:text-macos-text transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {/* Install guidance: OCR components are installed on demand */}
          {!isOcrAvailable && ocrStatus.checked && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-700">OCR Components Missing</p>
                  {guidance && guidance.missing.length > 0 ? (
                    <p className="text-xs text-amber-700/80 mt-1">
                      Missing: {guidance.missing.join(' · ')}
                      {guidance.packageManager ? ` — detected ${guidance.os} (${guidance.packageManager})` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700/80 mt-1">
                      {ocrStatus.message || 'Required OCR components are not installed.'}
                    </p>
                  )}

                  {guidance && guidance.commands.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {guidance.commands.map((command, index) => (
                        <div key={index} className="flex items-stretch gap-1.5">
                          <code className="flex-1 text-[11px] leading-relaxed bg-amber-100/60 text-amber-900 rounded px-2 py-1.5 overflow-x-auto whitespace-pre font-mono select-text">
                            {command}
                          </code>
                          <button
                            onClick={() => copyCommand(command, index)}
                            className="px-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded transition-colors flex items-center"
                            title="Copy command"
                          >
                            {copiedCommand === index ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      ))}
                      <p className="text-[11px] text-amber-700/70">
                        Run this in a terminal, then click Re-check.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={recheck}
                    disabled={isChecking}
                    className="mt-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-medium rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isChecking ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={12} />
                        Re-check
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OCR works, but some language packs are absent */}
          {isOcrAvailable && guidance && guidance.missing.length > 0 && (
            <div className="mb-4 px-3 py-2 bg-black/[0.04] border border-black/10 rounded-lg">
              <p className="text-[11px] text-macos-muted">
                Note: {guidance.missing.join(' · ')} not installed — OCR runs with the available languages.
                {guidance.commands[0] ? ` To add them: ${guidance.commands[0]}` : ''}
              </p>
            </div>
          )}

          {!preview ? (
            <div className="space-y-4">
              {/* Screenshot Button */}
              <button
                onClick={handleScreenCapture}
                disabled={isCapturing || !isOcrAvailable}
                className="w-full border-2 border-macos-active/50 bg-macos-active/10 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-macos-active hover:bg-macos-active/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 rounded-full bg-macos-active/20 group-hover:bg-macos-active/30 flex items-center justify-center mb-3 transition-colors">
                  {isCapturing ? (
                    <Loader2 size={24} className="text-macos-active animate-spin" />
                  ) : (
                    <Scissors size={24} className="text-macos-active" />
                  )}
                </div>
                <p className="text-sm text-macos-text font-medium">
                  {isCapturing ? 'Select area to capture...' : 'Screenshot Area'}
                </p>
                <p className="text-xs text-macos-muted mt-1">Click and drag to select region</p>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-black/5"></div>
                <span className="text-xs text-macos-muted">or</span>
                <div className="flex-1 h-px bg-black/5"></div>
              </div>

              {/* Upload Area */}
              <div 
                className="border-2 border-dashed border-black/10 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-macos-active/50 hover:bg-black/[0.03] transition-all group"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="w-10 h-10 rounded-full bg-black/5 group-hover:bg-macos-active/20 flex items-center justify-center mb-3 transition-colors">
                  <Upload size={20} className="text-macos-muted group-hover:text-macos-active" />
                </div>
                <p className="text-sm text-macos-text font-medium">Upload image</p>
                <p className="text-xs text-macos-muted mt-1">PNG, JPG, WebP</p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-black/10 bg-black/5">
               <img src={preview} alt="Preview" className="w-full h-48 object-contain" />
               <button 
                onClick={() => setPreview(null)}
                className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-red-500/80 transition-colors"
               >
                 <X size={14} />
               </button>
            </div>
          )}
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*"
          />

          {error && <div className="mt-4 text-xs text-red-600 bg-red-50 border border-red-100 p-2 rounded">{error}</div>}
        </div>

        <div className="shrink-0 px-5 py-4 bg-black/[0.03] border-t border-black/5 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-macos-muted hover:text-macos-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!preview || isProcessing || !isOcrAvailable}
            className="px-4 py-2 bg-macos-active hover:bg-macos-active/90 text-white text-xs font-medium rounded-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing && <Loader2 size={14} className="animate-spin" />}
            {!isOcrAvailable ? 'OCR Unavailable' : isProcessing ? 'Processing...' : 'Analyze & Translate'}
          </button>
        </div>
      </div>
    </div>
  );
};