import { Language, TranslationProvider } from './types';

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
  // LLM Providers
  { 
    id: 'gemini', 
    name: 'Google Gemini', 
    category: 'llm',
    enabled: true,
    requiresKey: true,
    description: 'Multimodal, High speed.' 
  },
  {
    id: 'openai',
    name: 'OpenAI Compatible',
    category: 'llm',
    enabled: true,
    requiresKey: true,
    description: 'DeepSeek, GPT-4, Ollama.'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'llm',
    enabled: true,
    requiresKey: true,
    description: 'GPT-4, Claude, Llama, etc.'
  },
  // Cloud Providers
  { 
    id: 'deepl', 
    name: 'DeepL Translate', 
    category: 'cloud',
    enabled: true,
    requiresKey: true,
    description: 'High accuracy'
  },
  {
    id: 'google',
    name: 'Google Translate',
    category: 'cloud',
    enabled: true,
    requiresKey: false,
    description: 'Web API'
  },
  {
    id: 'microsoft',
    name: 'Microsoft Translator',
    category: 'cloud',
    enabled: true,
    requiresKey: true,
    description: 'Azure Cognitive Services'
  },
];

export const DEFAULT_SETTINGS = {
  autoTranslate: true,
  debounceMs: 500,
  sourceLang: 'auto' as const,
  targetLang: 'zh-CN' as const,
  provider: 'google' as const,
  useOcrPreProcessing: false,
  
  // Gemini Defaults
  modelId: 'gemini-3-flash-preview',
  customSystemInstruction: '',
  systemPromptEnabled: true,
  geminiApiKey: '',

  // OpenAI Defaults
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiApiKey: '',
  openaiModel: 'gpt-3.5-turbo',

  // OpenRouter Defaults
  openrouterApiKey: '',
  openrouterModel: 'openai/gpt-3.5-turbo',

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
};