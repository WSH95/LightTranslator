import { TranslationProviderId } from "../types";
import { DEFAULT_SETTINGS } from "../constants";
import { platform } from "../src/lib/platform";
import { translateWithGoogleFreeEndpoints } from "./googleTranslateService";

// --- Types ---
interface TranslateOptions {
  provider?: TranslationProviderId;
  // OpenAI-compatible LLM (OpenAI, Gemini, OpenRouter, DeepSeek, Ollama, ...)
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  customSystemInstruction?: string;
  systemPromptEnabled?: boolean;
  // DeepL Options
  deeplApiKey?: string;
  // Microsoft Options
  microsoftSubscriptionKey?: string;
  microsoftRegion?: string;
}

interface VerifyModelOptions {
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  openaiModel?: string;
}

interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

// --- Shared transport ---

/**
 * Pull a human-readable message out of a provider error body. Providers
 * disagree on the envelope ({error:{message}}, {error:{code}}, {message}), and
 * the native transport hands us the raw body string rather than parsed JSON —
 * so without this the user sees a wall of JSON.
 */
const extractApiError = (payload: unknown): string => {
  let obj: any = payload;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { return payload as string; }
  }
  return obj?.error?.message || obj?.error?.code || obj?.message ||
    (typeof payload === 'string' ? payload : JSON.stringify(payload));
};

/**
 * One request path for every provider.
 *
 * Packaged builds route through the backend's proxy_request — the WebView CSP
 * blocks direct calls, and the backend owns the proxy settings. The browser dev
 * server falls back to fetch. Both ends yield the same parsed JSON or the same
 * thrown Error, so no caller branches on the transport.
 */
const httpJson = async (url: string, options: HttpOptions = {}): Promise<any> => {
  let payload: unknown;

  if (platform.isAvailable()) {
    const response = await platform.request(url, options);
    if (!response.ok) {
      const detail = extractApiError(response.data || response.error || 'Unknown error');
      throw new Error(response.statusCode ? `${response.statusCode} — ${detail}` : detail);
    }
    payload = response.data;
  } else {
    const response = await fetch(url, options as RequestInit);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} — ${extractApiError(text)}`);
    }
    payload = text;
  }

  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch { return payload; }
  }
  return payload;
};

// --- OpenAI-compatible helpers ---

const llmChatUrl = (baseUrl: string) => `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

const llmHeaders = (apiKey?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // OpenRouter reads these for attribution; every other endpoint ignores them.
    'HTTP-Referer': 'https://github.com/ArianaProjects/LightTranslator',
    'X-Title': 'LightTranslator',
  };
  // Local servers (Ollama, llama.cpp, LM Studio) accept no key at all, so an
  // empty key is a valid configuration rather than an error.
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return headers;
};

const requireLlmConfig = (options: TranslateOptions | VerifyModelOptions) => {
  if (!options.openaiBaseUrl) {
    throw new Error("Base URL is required. Configure the provider in Settings.");
  }
};

/**
 * Models fence their JSON, prepend prose, or trail an explanation. Take the
 * first balanced {...} and parse that; the scan is string-aware so braces
 * inside the extracted text cannot end the object early. Never throws.
 */
const parseJsonReply = (raw: string): { extracted?: string; translation?: string } => {
  if (!raw) return {};
  let s = raw.trim();

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  try { return JSON.parse(s); } catch { /* fall through to the brace scan */ }

  const start = s.indexOf('{');
  if (start === -1) return {};
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch { return {}; }
    }
  }
  return {};
};

/**
 * Main Translation Function
 * Routes to the correct provider based on options.
 */
export const translateText = async (
  text: string,
  sourceLang: string,
  targetLang: string,
  options: TranslateOptions = {}
): Promise<string> => {
  if (!text.trim()) return "";

  const provider = options.provider || DEFAULT_SETTINGS.provider;

  if (provider === 'openai') {
    return translateWithLlm(text, sourceLang, targetLang, options);
  }

  if (provider === 'deepl') {
    return translateWithDeepL(text, sourceLang, targetLang, options);
  }

  if (provider === 'microsoft') {
    return translateWithMicrosoft(text, sourceLang, targetLang, options);
  }

  // 'google', plus any id that predates the current provider list: the no-key
  // endpoint always works, so an unknown provider degrades instead of throwing.
  return translateWithGoogleFree(text, sourceLang, targetLang);
};

/**
 * Main OCR Function — translates text found in an image.
 * Needs the OpenAI-compatible provider pointed at a vision-capable model.
 */
export const translateImage = async (
  base64Image: string,
  targetLang: string,
  options: TranslateOptions = {}
): Promise<{ detectedText: string; translatedText: string }> => {
  const provider = options.provider || DEFAULT_SETTINGS.provider;
  if (provider !== 'openai') {
    throw new Error(
      "Image translation needs the OpenAI Compatible provider with a vision-capable model. Select it in Settings."
    );
  }
  requireLlmConfig(options);

  const model = options.openaiModel || DEFAULT_SETTINGS.openaiModel;
  // Callers hand us a full data URI (FileReader, platform.captureScreen) and
  // image_url takes one directly, so only a bare base64 blob needs wrapping.
  const dataUri = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/png;base64,${base64Image}`;

  // Deliberately no response_format: {type:'json_object'} — Gemini's compat
  // layer accepts it, but llama.cpp, LM Studio, older vLLM and several proxies
  // reject unknown top-level fields outright. Asking in the prompt and parsing
  // tolerantly works everywhere.
  const requestBody = JSON.stringify({
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'You extract text from images and translate it. Reply with one JSON object and nothing else.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              `Extract all text visible in this image, then translate it to ${targetLang}.\n` +
              `Reply with ONLY this JSON object — no markdown fences, no commentary:\n` +
              `{"extracted":"<verbatim source text>","translation":"<translation in ${targetLang}>"}`
          },
          { type: 'image_url', image_url: { url: dataUri } },
        ]
      },
    ],
  });

  try {
    const data = await httpJson(llmChatUrl(options.openaiBaseUrl!), {
      method: 'POST',
      headers: llmHeaders(options.openaiApiKey),
      body: requestBody,
    });

    const content = data?.choices?.[0]?.message?.content?.trim() || "";
    const parsed = parseJsonReply(content);

    if (typeof parsed.extracted === 'string' || typeof parsed.translation === 'string') {
      return {
        detectedText: (parsed.extracted ?? '').trim() || "No text detected.",
        translatedText: (parsed.translation ?? '').trim() || "Could not translate.",
      };
    }

    // Prose-only reply: showing the model's answer beats erroring out.
    return { detectedText: '', translatedText: content || "Could not translate." };
  } catch (error: any) {
    console.error("Image Translation Error:", error);
    const detail = error?.message || "Unknown error";
    if (/image|vision|multimodal|content type|does ?n[o']?t support/i.test(detail)) {
      throw new Error(
        `"${model}" does not accept images. Choose a vision-capable model in Settings ` +
        `(e.g. gpt-4o-mini, gemini-3-flash-preview, qwen2.5vl). Server said: ${detail}`
      );
    }
    throw new Error(`Image translation failed: ${detail}`);
  }
};

/**
 * Model Identity Verification
 * Quota-free: asks the endpoint about the model rather than generating with it.
 */
export const verifyModelIdentity = async (options: VerifyModelOptions): Promise<string> => {
  requireLlmConfig(options);
  const baseUrl = options.openaiBaseUrl!.replace(/\/+$/, '');
  const model = options.openaiModel || DEFAULT_SETTINGS.openaiModel;
  const headers = llmHeaders(options.openaiApiKey);

  try {
    const data = await httpJson(`${baseUrl}/models/${model}`, { headers });
    return data?.id || model;
  } catch (error: any) {
    // Not every server exposes /models/{id}; listing is the portable fallback
    // and still proves the base URL and key are good.
    try {
      await httpJson(`${baseUrl}/models`, { headers });
      return model;
    } catch (listError: any) {
      console.error("Model Verification Error:", listError);
      throw new Error(`Verification failed: ${listError?.message || error?.message || 'unknown error'}`);
    }
  }
};

// --- Internal Providers ---

const translateWithLlm = async (text: string, source: string, target: string, options: TranslateOptions) => {
  requireLlmConfig(options);

  const messages: Array<{ role: string; content: string }> = [];

  if (options.systemPromptEnabled !== false) {
    const systemPrompt = options.customSystemInstruction ||
      `You are a professional translator. Translate the following content from ${source === 'auto' ? 'detected language' : source} to ${target}. Output ONLY the translation, no explanations.`;
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: text });

  const requestBody = JSON.stringify({
    model: options.openaiModel || DEFAULT_SETTINGS.openaiModel,
    messages,
    temperature: 0.3
  });

  try {
    const data = await httpJson(llmChatUrl(options.openaiBaseUrl!), {
      method: 'POST',
      headers: llmHeaders(options.openaiApiKey),
      body: requestBody,
    });
    return data?.choices?.[0]?.message?.content?.trim() || "Translation empty.";
  } catch (error: any) {
    console.error("LLM Error:", error);
    throw new Error(`LLM Error: ${error.message}`);
  }
};

const translateWithDeepL = async (text: string, source: string, target: string, options: TranslateOptions) => {
  if (!options.deeplApiKey) {
    throw new Error("DeepL API Key is required.");
  }

  const isFree = options.deeplApiKey.endsWith(':fx');
  const url = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

  // DeepL Language Codes: EN-US, EN-GB, PT-BR, etc.
  // Our app uses 'en', 'zh-CN', etc.
  // DeepL 'target_lang' supports 'ZH' (Simplified) but 'zh-CN' is deprecated/mapped.
  let targetLang = target.toUpperCase();
  if (targetLang === 'EN') targetLang = 'EN-US'; // Default to US English
  if (targetLang === 'ZH-CN') targetLang = 'ZH-HANS';
  if (targetLang === 'ZH-TW') targetLang = 'ZH-HANT'; // 'ZH-TW' is not a valid DeepL target

  // Text goes in the form body, not the URL: query strings have length
  // limits and end up in proxy/server logs
  const params = new URLSearchParams();
  params.append('text', text);
  params.append('target_lang', targetLang);
  if (source !== 'auto') {
    params.append('source_lang', source.toUpperCase().split('-')[0]); // DeepL source is usually 2 chars (EN, ZH, JA)
  }

  try {
    const data = await httpJson(url, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${options.deeplApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString(),
    });
    return data?.translations?.[0]?.text || "Translation empty.";
  } catch (error: any) {
    console.error("DeepL Error:", error);
    throw new Error(`DeepL Error: ${error.message}`);
  }
};

/**
 * Google Translate (no-key web endpoints) implementation.
 * These endpoints are unofficial and may be throttled or changed by Google.
 * Production deployments that require a supported API should use Cloud Translation.
 * When running in Electron, we should route this through the main process to avoid CORS.
 */
const translateWithGoogleFree = async (text: string, source: string, target: string) => {
  try {
    return await translateWithGoogleFreeEndpoints(text, source, target, platform.request);
  } catch (error: any) {
    console.error("Google Free Error:", error);
    // Keep the endpoint-specific cause; the CORS hint only makes sense in web mode.
    const detail = error?.message ? `: ${error.message}` : '';
    throw new Error(platform.isAvailable()
      ? `Google Translate failed${detail}`
      : `Google Translate failed${detail} (web mode is often blocked by CORS — use the desktop app)`);
  }
};

/**
 * Microsoft Translator Implementation
 * Uses Azure Cognitive Services Translator API
 */
const translateWithMicrosoft = async (text: string, source: string, target: string, options: TranslateOptions) => {
  if (!options.microsoftSubscriptionKey) {
    throw new Error("Microsoft Subscription Key is required.");
  }

  const region = options.microsoftRegion || DEFAULT_SETTINGS.microsoftRegion;

  // Map language codes to Microsoft format
  // Microsoft uses: en, zh-Hans (simplified), zh-Hant (traditional), ja, ko, etc.
  const mapLangCode = (code: string): string => {
    const mapping: Record<string, string> = {
      'zh-CN': 'zh-Hans',
      'zh-TW': 'zh-Hant',
      'auto': '',  // Microsoft auto-detects if source not specified
    };
    return mapping[code] || code;
  };

  const fromLang = source === 'auto' ? '' : mapLangCode(source);
  const toLang = mapLangCode(target);

  const params = new URLSearchParams({
    'api-version': '3.0',
    'to': toLang,
  });

  if (fromLang) {
    params.append('from', fromLang);
  }

  const url = `https://api.cognitive.microsofttranslator.com/translate?${params.toString()}`;

  try {
    const data = await httpJson(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': options.microsoftSubscriptionKey,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ Text: text }]),
    });
    return data?.[0]?.translations?.[0]?.text || "Translation empty.";
  } catch (error: any) {
    console.error("Microsoft Translator Error:", error);
    throw new Error(`Microsoft Translator Error: ${error.message}`);
  }
};
