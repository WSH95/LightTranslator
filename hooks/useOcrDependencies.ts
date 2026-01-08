import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { platform } from '../src/lib/platform';

/**
 * Hook to manage OCR dependency checking and installation
 */
export function useOcrDependencies() {
  const { ocrStatus, setOcrStatus } = useAppStore();

  // Check OCR dependencies
  const checkDependencies = useCallback(async () => {
    if (!platform.isAvailable()) {
      // Not in native environment
      setOcrStatus({ checked: true, available: false, message: 'Not running in native environment' });
      return;
    }

    setOcrStatus({ checking: true });

    try {
      const result = await platform.checkOcrDependencies();

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

  // Show install prompt and install if user accepts
  const promptAndInstall = useCallback(async () => {
    if (!platform.isAvailable()) return false;

    try {
      // Show native dialog prompt
      const shouldInstall = await platform.showOcrInstallPrompt(ocrStatus.message || 'OCR components are missing');

      if (!shouldInstall) {
        return false; // User chose to skip
      }

      // User wants to install
      setOcrStatus({ installing: true });

      const success = await platform.installOcrDependencies();

      // Re-check dependencies after install
      const result = await platform.checkOcrDependencies();

      setOcrStatus({
        installing: false,
        available: result.tesseractInstalled && result.gnomeScreenshotInstalled,
        message: success ? null : 'Installation may have failed',
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

      return success;
    } catch (error: any) {
      setOcrStatus({
        installing: false,
        message: error.message || 'Installation failed',
      });
      return false;
    }
  }, [ocrStatus.message, setOcrStatus]);

  // Check on mount (only if not already checked)
  useEffect(() => {
    if (!ocrStatus.checked && !ocrStatus.checking) {
      checkDependencies();
    }
  }, [ocrStatus.checked, ocrStatus.checking, checkDependencies]);

  return {
    ocrStatus,
    checkDependencies,
    promptAndInstall,
    isOcrAvailable: ocrStatus.available,
    isChecking: ocrStatus.checking,
    isInstalling: ocrStatus.installing,
  };
}
