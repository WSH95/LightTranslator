import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, LanguageCode, TranslationProviderId, ModelVerificationState } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

// OCR dependency status
interface OcrStatus {
  available: boolean;
  checked: boolean;
  checking: boolean;
  installing: boolean;
  message: string | null;
  details: {
    platform?: string;
    tesseract?: {
      installed: boolean;
      version: string | null;
      languages: string[];
      missingLangs: string[];
    };
    screenshotTool?: boolean;
    missingComponents?: string[];
  } | null;
}

interface AppState extends AppSettings {
  // Actions
  setSourceLang: (lang: LanguageCode) => void;
  setTargetLang: (lang: LanguageCode) => void;
  setProvider: (id: TranslationProviderId) => void;
  toggleAutoTranslate: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // UI State (not persisted)
  inputText: string;
  setInputText: (text: string) => void;
  translatedText: string;
  setTranslatedText: (text: string) => void;
  isTranslating: boolean;
  setIsTranslating: (loading: boolean) => void;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;

  // OCR State (not persisted - checked at runtime)
  ocrStatus: OcrStatus;
  setOcrStatus: (status: Partial<OcrStatus>) => void;

  // Model Verification State (not persisted - verified at runtime)
  modelVerification: ModelVerificationState;
  setModelVerification: (state: Partial<ModelVerificationState>) => void;
  clearModelVerification: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      
      // UI State Defaults
      inputText: '',
      translatedText: '',
      isTranslating: false,
      errorMessage: null,

      // OCR State Defaults (not persisted - checked at runtime)
      ocrStatus: {
        available: true, // Assume available until checked
        checked: false,
        checking: false,
        installing: false,
        message: null,
        details: null,
      },

      // Model Verification State Defaults (not persisted - verified at runtime)
      modelVerification: {
        isVerifying: false,
        verifiedIdentity: null,
        lastVerifiedAt: null,
        error: null,
      },

      // Actions
      setSourceLang: (lang) => set({ sourceLang: lang }),
      setTargetLang: (lang) => set({ targetLang: lang }),
      setProvider: (id) => set({ provider: id }),
      toggleAutoTranslate: () => set((state) => ({ autoTranslate: !state.autoTranslate })),
      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
      
      setInputText: (text) => set({ inputText: text }),
      setTranslatedText: (text) => set({ translatedText: text }),
      setIsTranslating: (loading) => set({ isTranslating: loading }),
      setErrorMessage: (msg) => set({ errorMessage: msg }),
      setOcrStatus: (status) => set((state) => ({
        ocrStatus: { ...state.ocrStatus, ...status }
      })),
      setModelVerification: (verificationState) => set((state) => ({
        modelVerification: { ...state.modelVerification, ...verificationState }
      })),
      clearModelVerification: () => set({
        modelVerification: {
          isVerifying: false,
          verifiedIdentity: null,
          lastVerifiedAt: null,
          error: null,
        }
      }),
    }),
    {
      name: 'light-translator-storage',
      partialize: (state) => ({
        // Only persist settings
        autoTranslate: state.autoTranslate,
        debounceMs: state.debounceMs,
        sourceLang: state.sourceLang,
        targetLang: state.targetLang,
        provider: state.provider,
        useOcrPreProcessing: state.useOcrPreProcessing,
        // Gemini
        modelId: state.modelId,
        customSystemInstruction: state.customSystemInstruction,
        systemPromptEnabled: state.systemPromptEnabled,
        geminiApiKey: state.geminiApiKey,
        // OpenAI
        openaiBaseUrl: state.openaiBaseUrl,
        openaiApiKey: state.openaiApiKey,
        openaiModel: state.openaiModel,
        // OpenRouter
        openrouterApiKey: state.openrouterApiKey,
        openrouterModel: state.openrouterModel,
        // DeepL
        deeplApiKey: state.deeplApiKey,
        // Microsoft
        microsoftSubscriptionKey: state.microsoftSubscriptionKey,
        microsoftRegion: state.microsoftRegion,
        // Proxy
        proxyEnabled: state.proxyEnabled,
        proxyProtocol: state.proxyProtocol,
        proxyHost: state.proxyHost,
        proxyPort: state.proxyPort,
        proxyUsername: state.proxyUsername,
        proxyPassword: state.proxyPassword,
        // Shortcut
        selectionShortcut: state.selectionShortcut,
        // Startup
        launchAtStartup: state.launchAtStartup,
      }),
    }
  )
);