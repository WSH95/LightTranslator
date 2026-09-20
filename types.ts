export type LanguageCode = 'auto' | 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru';

export interface Language {
  code: LanguageCode;
  name: string;
}

export type TranslationProviderId = 'openai' | 'deepl' | 'google' | 'microsoft';

export interface TranslationProvider {
  id: TranslationProviderId;
  name: string;
  description?: string;
}

/** A one-click endpoint preset for the OpenAI-compatible provider. */
export interface LlmPreset {
  label: string;
  baseUrl: string;
  model: string;
  /** False when the endpoint has no vision model, so image translation is unavailable. */
  vision: boolean;
}

export interface AppSettings {
  autoTranslate: boolean;
  debounceMs: number;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  provider: TranslationProviderId;
  useOcrPreProcessing: boolean;

  // OpenAI-compatible LLM (OpenAI, Gemini, OpenRouter, DeepSeek, Ollama, ...)
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  customSystemInstruction: string;
  systemPromptEnabled: boolean;

  // DeepL Specific
  deeplApiKey: string;

  // Microsoft Translator Specific
  microsoftSubscriptionKey: string;
  microsoftRegion: string;

  // Proxy Settings
  proxyEnabled: boolean;
  proxyProtocol: 'http' | 'https' | 'socks5';
  proxyHost: string;
  proxyPort: number;
  proxyUsername: string;
  proxyPassword: string;

  // Shortcut Settings
  selectionShortcut: string;

  // Startup Settings
  launchAtStartup: boolean;

  // Quick Window Appearance
  quickWindowOpacity: number; // 0.5-1.0
  quickWindowBorderOpacity: number; // 0-1.0

  // Quick Window Language Settings (independent from main panel)
  quickSourceLang: LanguageCode;
  quickTargetLang: LanguageCode;
}

export interface ProxySettings {
  enabled: boolean;
  protocol: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface TranslationResult {
  original: string;
  translated: string;
  isLoading: boolean;
  error?: string;
}

export interface OcrResult {
  text: string;
  translated: string;
}

export interface ModelVerificationState {
  isVerifying: boolean;
  verifiedIdentity: string | null;
  lastVerifiedAt: number | null;
  error: string | null;
}
