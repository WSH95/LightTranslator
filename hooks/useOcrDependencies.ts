import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

/**
 * Hook to manage OCR dependency checking and installation
 */
export function useOcrDependencies() {
  const { ocrStatus, setOcrStatus } = useAppStore();

  // Check OCR dependencies
  const checkDependencies = useCallback(async () => {
    if (!(window as any).electron?.checkOcrDependencies) {
      // Not in Electron environment
      setOcrStatus({ checked: true, available: false, message: 'Not running in Electron' });
      return;
    }

    setOcrStatus({ checking: true });

    try {
      const result = await (window as any).electron.checkOcrDependencies();

      setOcrStatus({
        checking: false,
        checked: true,
        available: result.ocrAvailable,
        message: result.message,
        details: result.details,
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
    if (!(window as any).electron) return false;

    const { showOcrInstallPrompt, installOcrDependencies } = (window as any).electron;

    try {
      // Show native dialog prompt
      const promptResult = await showOcrInstallPrompt(ocrStatus.message || 'OCR components are missing');

      if (!promptResult.install) {
        return false; // User chose to skip
      }

      // User wants to install
      setOcrStatus({ installing: true });

      const installResult = await installOcrDependencies();

      setOcrStatus({
        installing: false,
        available: installResult.ocrAvailable,
        message: installResult.message,
        details: installResult.details,
      });

      return installResult.success;
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
