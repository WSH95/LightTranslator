import { Language, LlmPreset, TranslationProvider, TranslationProviderId } from './types';

export const DEFAULT_SYSTEM_PROMPT = "Based on the source text to be translated, use relevant professional knowledge to translate, achieving professional and accurate translation.";

export const LANGUAGES: Language[] = [
  { code: 'auto', name: 'Auto Detect' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'ru', name: 'Russian' },
];

export const PROVIDERS: TranslationProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI Compatible',
    description: 'Any /chat/completions endpoint — OpenAI, Gemini, OpenRouter, DeepSeek, Ollama.'
  },
  {
    id: 'deepl',
    name: 'DeepL Translate',
    description: 'High accuracy'
  },
  {
    id: 'google',
    name: 'Google Translate',
    description: 'No-key web endpoints'
  },
  {
    id: 'microsoft',
    name: 'Microsoft Translator',
    description: 'Azure Cognitive Services'
  },
];

export const PROVIDER_IDS: TranslationProviderId[] = PROVIDERS.map(p => p.id);

/**
 * One-click endpoints for the OpenAI-compatible provider. Every one of these
 * speaks the same wire format, which is the whole point of having a single
 * provider: the only thing that changes is the base URL and the model name.
 *
 * Sample models are vision-capable wherever the endpoint offers one, because
 * this same config also serves paste-an-image translation.
 */
export const LLM_PRESETS: LlmPreset[] = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', vision: true },
  { label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3-flash-preview', vision: true },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', vision: true },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', vision: false },
  { label: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5vl:7b', vision: true },
];

export const DEFAULT_SETTINGS = {
  autoTranslate: true,
  debounceMs: 500,
  sourceLang: 'auto' as const,
  targetLang: 'zh-CN' as const,
  provider: 'google' as const,
  useOcrPreProcessing: false,

  // OpenAI-compatible LLM Defaults
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  customSystemInstruction: '',
  systemPromptEnabled: true,

  // DeepL Defaults
  deeplApiKey: '',

  // Microsoft Translator Defaults
  microsoftSubscriptionKey: '',
  microsoftRegion: 'eastus',

  // Proxy Defaults
  proxyEnabled: false,
  proxyProtocol: 'http' as const,
  proxyHost: '',
  proxyPort: 8080,
  proxyUsername: '',
  proxyPassword: '',

  // Shortcut Defaults
  selectionShortcut: 'CommandOrControl+Shift+X',

  // Startup Defaults
  launchAtStartup: false,

  // Quick Window Appearance Defaults
  quickWindowOpacity: 0.95,
  quickWindowBorderOpacity: 0.05,

  // Quick Window Language Defaults
  quickSourceLang: 'auto' as const,
  quickTargetLang: 'zh-CN' as const,
};
