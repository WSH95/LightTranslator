export type LanguageCode = 'auto' | 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru';

export interface Language {
  code: LanguageCode;
  name: string;
}

export type TranslationProviderId = 'gemini' | 'openai' | 'deepl' | 'google' | 'microsoft';

export type ProviderCategory = 'llm' | 'cloud';

export interface TranslationProvider {
  id: TranslationProviderId;
  name: string;
  category: ProviderCategory;
  enabled: boolean;
  description?: string;
  requiresKey?: boolean; // New field to hide key input if needed
}

export interface AppSettings {
  autoTranslate: boolean;
  debounceMs: number;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  provider: TranslationProviderId;
  useOcrPreProcessing: boolean;

  // Gemini Specific
  modelId: string;
  customSystemInstruction: string;
  systemPromptEnabled: boolean;
  geminiApiKey: string;

  // OpenAI / Custom LLM Specific
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;

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