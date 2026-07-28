import { useCallback, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { platform, OcrDependencyStatus, OcrInstallGuidance } from '../src/lib/platform';

// OCR components are optional at install time: nothing is probed at app
// startup. The check runs when the user actually invokes OCR, and missing
// components surface as OS-specific install guidance (DECISIONS.md 0003).

// Module-level in-flight guard so concurrent callers share one probe
let inFlightCheck: Promise<OcrDependencyStatus | null> | null = null;

/**
 * Hook for on-demand OCR dependency checking and install guidance
 */
export function useOcrDependencies() {
  const { ocrStatus, setOcrStatus } = useAppStore();
  const [guidance, setGuidance] = useState<OcrInstallGuidance | null>(null);

  // Check OCR dependencies (deduplicated across concurrent callers)
  const checkDependencies = useCallback(async (): Promise<OcrDependencyStatus | null> => {
    if (!platform.isAvailable()) {
      setOcrStatus({ checked: true, available: false, message: 'Not running in native environment' });
      return null;
    }

    if (!inFlightCheck) {
      inFlightCheck = (async () => {
        try {
          return await platform.checkOcrDependencies();
        } finally {
          inFlightCheck = null;
        }
      })();
    }

    setOcrStatus({ checking: true });

    try {
      const result = await inFlightCheck;
      if (!result) return null;

      setOcrStatus({
        checking: false,
        checked: true,
        available: result.tesseractInstalled && result.gnomeScreenshotInstalled,
        message: result.tesseractInstalled ? null : 'Tesseract OCR is not installed',
        details: {
          tesseract: {
            installed: result.tesseractInstalled,
            version: result.tesseractVersion || null,
            languages: result.languages,
            missingLangs: [],
          },
          screenshotTool: result.gnomeScreenshotInstalled,
        },
      });

      return result;
    } catch (error: any) {
      setOcrStatus({
        checking: false,
        checked: true,
        available: false,
        message: error.message || 'Failed to check OCR dependencies',
      });
      return null;
    }
  }, [setOcrStatus]);

  // Fetch OS-specific install guidance (also reports partially missing
  // language packs while OCR itself remains usable)
  const loadGuidance = useCallback(async (): Promise<OcrInstallGuidance | null> => {
    if (!platform.isAvailable()) return null;
    try {
      const result = await platform.getOcrInstallGuidance();
      setGuidance(result);
      return result;
    } catch (error) {
      console.error('Failed to load OCR install guidance:', error);
      return null;
    }
  }, []);

  // Check + refresh guidance; used on modal open and by the Re-check button
  const recheck = useCallback(async () => {
    const result = await checkDependencies();
    if (result) {
      await loadGuidance();
    }
    return result;
  }, [checkDependencies, loadGuidance]);

  return {
    ocrStatus,
    guidance,
    checkDependencies,
    loadGuidance,
    recheck,
    isOcrAvailable: ocrStatus.available,
    isChecking: ocrStatus.checking,
  };
}
