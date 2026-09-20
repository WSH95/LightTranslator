import type { Language, LlmPreset, TranslationProvider, TranslationProviderId } from './types';

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

/**
 * The ten Yaru accents offered in Settings > Appearance.
 *
 * `dark` is the light hex re-rendered at OKLCH L~=0.742 with chroma x1.19 and
 * the hue held, then gamut-mapped back into sRGB (Orange, Blue, Purple and Red
 * land near x0.7-0.8 because x1.19 leaves the gamut). That rule reproduces the
 * approved #03875B -> #3dc78f pair, and every row clears 6:1 against --bg and
 * 5:1 against --card in dark mode. Hand-edit a row rather than reaching for
 * runtime colour maths.
 *
 * Swatch fills stay the canonical light hex in both themes; only the selection
 * ring and the resolved --accent lighten.
 */
export const ACCENTS = [
  { name: 'Orange', light: '#E95420', dark: '#ff835c' },
  { name: 'Bark', light: '#787859', dark: '#aeae87' },
  { name: 'Sage', light: '#657B69', dark: '#98b49d' },
  { name: 'Olive', light: '#4B8501', dark: '#79c334' },
  { name: 'Viridian', light: '#03875B', dark: '#3dc78f' },
  { name: 'Prussian Green', light: '#308280', dark: '#5bbebb' },
  { name: 'Blue', light: '#0073E5', dark: '#70aeff' },
  { name: 'Purple', light: '#7764D8', dark: '#a79cff' },
  { name: 'Magenta', light: '#B34CB3', dark: '#f070f0' },
  { name: 'Red', light: '#DA3450', dark: '#ff7d87' },
] as const;

export type Accent = (typeof ACCENTS)[number];

export const DEFAULT_ACCENT: Accent = ACCENTS[4]; // Viridian

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
  quickWindowWidth: null as number | null,
  quickWindowHeight: null as number | null,

  // Quick Window Language Defaults
  quickSourceLang: 'auto' as const,
  quickTargetLang: 'zh-CN' as const,

  // Appearance Defaults
  appearanceTheme: 'system' as const,
  accentColor: DEFAULT_ACCENT.light,
  followSystemAccent: false,
  translationTextSize: 'medium' as const,
  surfaceStyle: 'solid' as const,
  glassOpacity: 0.75,
};
