import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Loader2, Scissors, AlertTriangle, Download } from 'lucide-react';
import { translateText } from '../services/geminiService';
import { useAppStore } from '../store/useAppStore';
import { useOcrDependencies } from '../hooks/useOcrDependencies';

interface OcrModalProps {
  onClose: () => void;
}

export const OcrModal: React.FC<OcrModalProps> = ({ onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OCR dependency status
  const { ocrStatus, isOcrAvailable, isInstalling, promptAndInstall } = useOcrDependencies();

  const {
    sourceLang,
    targetLang,
    setInputText,
    setTranslatedText,
    provider,
    modelId,
    customSystemInstruction,
    openaiApiKey,
    openaiBaseUrl,
    openaiModel,
    deeplApiKey
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
    if (!(window as any).electron?.captureScreen) {
      setError('Screenshot feature is not available');
      return;
    }
    
    setIsCapturing(true);
    setError(null);
    
    try {
      const result = await (window as any).electron.captureScreen();
      
      if (result.success && result.data) {
        setPreview(result.data);
      } else if (result.cancelled) {
        // User cancelled, do nothing
      } else if (result.error) {
        setError(`Screenshot failed: ${result.error}`);
      }
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
      if (!(window as any).electron?.ocrImage) {
        throw new Error('OCR feature is not available');
      }
      
      const ocrResult = await (window as any).electron.ocrImage(preview);
      
      if (!ocrResult.success) {
        throw new Error(ocrResult.error || 'OCR failed');
      }
      
      const extractedText = ocrResult.text;
      setInputText(extractedText);
      
      // Step 2: Translate using the user's selected provider
      const translatedResult = await translateText(extractedText, sourceLang, targetLang, {
        provider,
        modelId,
        customSystemInstruction,
        openaiApiKey,
        openaiBaseUrl,
        openaiModel,
        deeplApiKey
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-surfaceHighlight rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-surfaceHighlight">
          <h3 className="text-text font-medium flex items-center gap-2">
            <ImageIcon size={18} className="text-primary" />
            OCR Screenshot/Image
          </h3>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {/* OCR Unavailable Warning */}
          {!isOcrAvailable && ocrStatus.checked && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-400">OCR Components Missing</p>
                  <p className="text-xs text-amber-400/70 mt-1">
                    {ocrStatus.message || 'Required OCR components are not installed. OCR features will not work until they are installed.'}
                  </p>
                  <button
                    onClick={promptAndInstall}
                    disabled={isInstalling}
                    className="mt-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-medium rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Installing...
                      </>
                    ) : (
                      <>
                        <Download size={12} />
                        Install Dependencies
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!preview ? (
            <div className="space-y-4">
              {/* Screenshot Button */}
              <button
                onClick={handleScreenCapture}
                disabled={isCapturing || !isOcrAvailable}
                className="w-full border-2 border-primary/50 bg-primary/10 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary hover:bg-primary/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center mb-3 transition-colors">
                  {isCapturing ? (
                    <Loader2 size={24} className="text-primary animate-spin" />
                  ) : (
                    <Scissors size={24} className="text-primary" />
                  )}
                </div>
                <p className="text-sm text-text font-medium">
                  {isCapturing ? 'Select area to capture...' : 'Screenshot Area'}
                </p>
                <p className="text-xs text-muted mt-1">Click and drag to select region</p>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-surfaceHighlight"></div>
                <span className="text-xs text-muted">or</span>
                <div className="flex-1 h-px bg-surfaceHighlight"></div>
              </div>

              {/* Upload Area */}
              <div 
                className="border-2 border-dashed border-surfaceHighlight rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/50 hover:bg-surfaceHighlight/30 transition-all group"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="w-10 h-10 rounded-full bg-surfaceHighlight group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors">
                  <Upload size={20} className="text-muted group-hover:text-primary" />
                </div>
                <p className="text-sm text-text font-medium">Upload image</p>
                <p className="text-xs text-muted mt-1">PNG, JPG, WebP</p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-surfaceHighlight bg-black/50">
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

          {error && <div className="mt-4 text-xs text-red-400 bg-red-500/10 p-2 rounded">{error}</div>}
        </div>

        <div className="p-4 bg-surfaceHighlight/30 border-t border-surfaceHighlight flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-muted hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!preview || isProcessing || !isOcrAvailable}
            className="px-4 py-2 bg-primary hover:bg-indigo-500 text-white text-xs font-medium rounded-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing && <Loader2 size={14} className="animate-spin" />}
            {!isOcrAvailable ? 'OCR Unavailable' : isProcessing ? 'Processing...' : 'Analyze & Translate'}
          </button>
        </div>
      </div>
    </div>
  );
};