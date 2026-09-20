import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, LanguageCode, TranslationProviderId, ModelVerificationState } from '../types';
import { DEFAULT_SETTINGS, PROVIDER_IDS } from '../constants';
import { platform } from '../src/lib/platform';

// Cross-window sync: each window runs its own store instance over one shared
// localStorage. After a persisted settings write, nudge the other window to
// rehydrate so neither side keeps (and later persists) a stale snapshot.
// Debounced so bursts (typing in Settings) coalesce into one event.
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
function broadcastSettingsChanged() {
  if (!platform.isAvailable()) return;
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    platform.emitSettingsChanged();
  }, 250);
}

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
  setQuickSourceLang: (lang: LanguageCode) => void;
  setQuickTargetLang: (lang: LanguageCode) => void;
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

      // Actions (settings writes notify the other window — see broadcastSettingsChanged)
      setSourceLang: (lang) => { set({ sourceLang: lang }); broadcastSettingsChanged(); },
      setTargetLang: (lang) => { set({ targetLang: lang }); broadcastSettingsChanged(); },
      setQuickSourceLang: (lang) => { set({ quickSourceLang: lang }); broadcastSettingsChanged(); },
      setQuickTargetLang: (lang) => { set({ quickTargetLang: lang }); broadcastSettingsChanged(); },
      setProvider: (id) => { set({ provider: id }); broadcastSettingsChanged(); },
      toggleAutoTranslate: () => { set((state) => ({ autoTranslate: !state.autoTranslate })); broadcastSettingsChanged(); },
      updateSettings: (newSettings) => { set((state) => ({ ...state, ...newSettings })); broadcastSettingsChanged(); },

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
      // Bumped alongside the provider collapse. Note this does NOT drive the
      // fix-up below: zustand v5 only calls `migrate` when the stored blob has
      // a *numeric* version field (middleware.js: `typeof
      // deserializedStorageValue.version === "number"`), and every blob written
      // before this release has no version at all -- so `migrate` would never
      // fire for exactly the users who need it. It is kept so a future v1 -> v2
      // migration can rely on it.
      version: 1,
      // The 'gemini' and 'openrouter' providers folded into the single
      // OpenAI-compatible one. A blob written before that change holds an id
      // that no longer exists in PROVIDERS, which leaves Settings with nothing
      // selected and every translation failing -- and the quick-translate popup
      // has no Settings UI to recover from. Coerce those users to the key-free
      // default and drop the dead credentials rather than carrying them over.
      // Anyone already on 'openai' keeps their config untouched.
      //
      // This runs on every rehydrate (including the cross-window ones), which is
      // fine: it is pure and idempotent, and once partialize rewrites the blob
      // without the dead keys it is a no-op.
      //
      // Typed loosely on purpose: the removed ids are gone from
      // TranslationProviderId, so comparing a typed value against them would be
      // a TS2367 "no overlap" error.
      merge: (persisted: unknown, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        const { geminiApiKey, openrouterApiKey, openrouterModel, modelId, ...rest } =
          persisted as Record<string, unknown>;
        if (!PROVIDER_IDS.includes(rest.provider as never)) {
          rest.provider = DEFAULT_SETTINGS.provider;
        }
        return { ...current, ...rest };
      },
      partialize: (state) => ({
        // Only persist settings
        autoTranslate: state.autoTranslate,
        debounceMs: state.debounceMs,
        sourceLang: state.sourceLang,
        targetLang: state.targetLang,
        provider: state.provider,
        useOcrPreProcessing: state.useOcrPreProcessing,
        // OpenAI-compatible LLM
        openaiBaseUrl: state.openaiBaseUrl,
        openaiApiKey: state.openaiApiKey,
        openaiModel: state.openaiModel,
        customSystemInstruction: state.customSystemInstruction,
        systemPromptEnabled: state.systemPromptEnabled,
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
        // Quick Window Appearance
        quickWindowOpacity: state.quickWindowOpacity,
        quickWindowBorderOpacity: state.quickWindowBorderOpacity,
        quickWindowWidth: state.quickWindowWidth,
        // Quick Window Language
        quickSourceLang: state.quickSourceLang,
        quickTargetLang: state.quickTargetLang,
        // Appearance
        appearanceTheme: state.appearanceTheme,
        accentColor: state.accentColor,
        followSystemAccent: state.followSystemAccent,
        translationTextSize: state.translationTextSize,
        surfaceStyle: state.surfaceStyle,
        glassOpacity: state.glassOpacity,
      }),
    }
  )
);