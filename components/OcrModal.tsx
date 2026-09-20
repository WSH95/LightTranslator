import React, { useState, useRef, useEffect } from 'react';
import {
  Check, Copy, LoaderCircle, RefreshCw, Scissors, TriangleAlert, Upload, X,
} from 'lucide-react';
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
  // Screenshot and upload used to be two controls stacked on top of each
  // other; the approved design makes them modes. Same capabilities.
  const [mode, setMode] = useState<'screenshot' | 'upload'>('screenshot');

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

  const captureDisabled = isCapturing || !isOcrAvailable;

  // The preview area is the trigger. Selecting a *segment* must never start a
  // capture: screenshot is the default mode, so that would fire
  // gnome-screenshot the moment the dialog opens.
  const activateDropArea = () => {
    if (preview) return;
    if (mode === 'screenshot') {
      if (!captureDisabled) handleScreenCapture();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 rounded-[var(--window-radius)]"
      style={{ background: 'rgba(0,0,0,.3)' }}
    >
      {/* max-h-full plus a scrolling body keeps the dependency guidance inside
          the window — which matters more now the main window is 520px tall. */}
      <div
        className="w-[480px] max-h-full bg-bg rounded-xl flex flex-col overflow-hidden"
        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.25), 0 16px 40px rgba(0,0,0,.45)' }}
      >
        <div className="h-[47px] shrink-0 flex items-center justify-center relative text-[15px] font-bold text-text">
          OCR Screenshot/Image
          <button
            type="button"
            onClick={onClose}
            className="win-ctrl absolute right-[10px] top-[11px]"
            title="Close"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-1.5 pb-5 flex flex-col gap-3.5">

          {/* Missing components: a plain boxed list, no amber. */}
          {!isOcrAvailable && ocrStatus.checked && (
            <div className="card list overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                <TriangleAlert size={18} className="text-text shrink-0 mt-0.5" />
                <div className="min-w-0 text-[13px] leading-normal">
                  <div className="text-text font-medium">OCR Components Missing</div>
                  <div className="text-muted mt-0.5">
                    {guidance && guidance.missing.length > 0
                      ? `Missing: ${guidance.missing.join(' · ')}${
                          guidance.packageManager ? ` — detected ${guidance.os} (${guidance.packageManager})` : ''
                        }`
                      : ocrStatus.message || 'Required OCR components are not installed.'}
                  </div>
                </div>
              </div>

              {guidance?.commands.map((command, index) => (
                <div key={command} className="p-4 flex items-stretch gap-2">
                  <code className="flex-1 min-w-0 text-xs font-mono bg-pill text-text rounded px-2 py-1.5 overflow-x-auto whitespace-pre select-text">
                    {command}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyCommand(command, index)}
                    className="icon-btn icon-btn-xs shrink-0"
                    title="Copy command"
                  >
                    {copiedCommand === index ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              ))}

              <div className="p-4 flex items-center justify-between gap-3">
                <span className="text-[13px] text-muted">
                  {guidance?.commands.length
                    ? 'Run this in a terminal, then click Re-check.'
                    : 'Install the OCR components, then click Re-check.'}
                </span>
                <button type="button" onClick={recheck} disabled={isChecking} className="btn shrink-0">
                  {isChecking
                    ? <><LoaderCircle size={12} className="animate-spin" />Checking...</>
                    : <><RefreshCw size={12} />Re-check</>}
                </button>
              </div>
            </div>
          )}

          {/* OCR works, but some language packs are absent */}
          {isOcrAvailable && guidance && guidance.missing.length > 0 && (
            <p className="text-xs text-muted px-1">
              Note: {guidance.missing.join(' · ')} not installed — OCR runs with the available languages.
              {guidance.commands[0] ? ` To add them: ${guidance.commands[0]}` : ''}
            </p>
          )}

          <div className="flex gap-[3px] p-[3px] rounded-[9px] shrink-0" style={{ background: 'var(--ctrl-bg)' }}>
            {([
              { id: 'screenshot', label: 'Screenshot Area', icon: Scissors },
              { id: 'upload', label: 'Upload image', icon: Upload },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={`flex-1 h-[30px] rounded-[7px] flex items-center justify-center gap-2 text-[13px] text-text transition-colors duration-150 ${
                  mode === id ? 'font-medium' : ''
                }`}
                style={mode === id
                  ? { background: 'var(--card)', boxShadow: '0 1px 2px rgba(0,0,0,.12)' }
                  : undefined}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <div
            onClick={activateDropArea}
            onDragOver={(e) => { if (mode === 'upload') e.preventDefault(); }}
            onDrop={handleDrop}
            className={`h-[200px] shrink-0 rounded-xl relative overflow-hidden flex flex-col items-center justify-center gap-1.5 ${
              preview || (mode === 'screenshot' && captureDisabled) ? '' : 'cursor-pointer'
            }`}
            style={{ border: '1px dashed var(--drop-border)', background: 'var(--stripes)' }}
          >
            {preview ? (
              <>
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPreview(null); }}
                  className="win-ctrl absolute top-2 right-2"
                  title="Remove image"
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </>
            ) : mode === 'screenshot' ? (
              <>
                {isCapturing
                  ? <LoaderCircle size={26} className="text-muted animate-spin" />
                  : <Scissors size={26} className="text-muted" />}
                <div className="text-sm font-medium text-text mt-1">
                  {isCapturing ? 'Select area to capture...' : 'Click and drag to select region'}
                </div>
                <div className="text-xs font-mono text-muted">preview appears here</div>
              </>
            ) : (
              <>
                <Upload size={26} className="text-muted" />
                <div className="text-sm font-medium text-text mt-1">Upload image</div>
                <div className="text-xs font-mono text-muted">PNG, JPG, WebP</div>
              </>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />

          {error && <p className="text-[13px] text-danger px-1">{error}</p>}

          <div className="flex justify-end gap-2 shrink-0">
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!preview || isProcessing || !isOcrAvailable}
              className="btn btn-suggested"
            >
              {isProcessing && <LoaderCircle size={14} className="animate-spin" />}
              {!isOcrAvailable ? 'OCR Unavailable' : isProcessing ? 'Processing...' : 'Analyze & Translate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
