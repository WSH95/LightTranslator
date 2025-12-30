import { GoogleGenAI } from "@google/genai";
import { TranslationProviderId } from "../types";

// --- Types ---
interface TranslateOptions {
  provider?: TranslationProviderId;
  // Gemini Options
  modelId?: string;
  customSystemInstruction?: string;
  systemPromptEnabled?: boolean;
  geminiApiKey?: string;
  // OpenAI Options
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  // DeepL Options
  deeplApiKey?: string;
  // Microsoft Options
  microsoftSubscriptionKey?: string;
  microsoftRegion?: string;
}

interface VerifyModelOptions {
  provider: TranslationProviderId;
  geminiApiKey?: string;
  modelId?: string;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  openaiModel?: string;
}

// Helper to get Gemini client with the provided API key
const getGeminiClient = (apiKey?: string) => {
  const key = apiKey || process.env.API_KEY || '';
  if (!key) {
    throw new Error("Gemini API Key is required. Please configure it in Settings.");
  }
  return new GoogleGenAI({ apiKey: key });
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

  const provider = options.provider || 'gemini';

  if (provider === 'openai') {
    return translateWithOpenAI(text, sourceLang, targetLang, options);
  }

  if (provider === 'deepl') {
    return translateWithDeepL(text, sourceLang, targetLang, options);
  }

  if (provider === 'google') {
    return translateWithGoogleFree(text, sourceLang, targetLang);
  }

  if (provider === 'microsoft') {
    return translateWithMicrosoft(text, sourceLang, targetLang, options);
  }

  // Default to Gemini
  return translateWithGemini(text, sourceLang, targetLang, options);
};

/**
 * Main OCR Function
 */
export const translateImage = async (
  base64Image: string,
  targetLang: string,
  options: TranslateOptions = {}
): Promise<{ detectedText: string; translatedText: string }> => {
  return translateImageWithGemini(base64Image, targetLang, options);
};

/**
 * Model Identity Verification Function
 * Uses quota-free methods where possible to verify model availability.
 * - Gemini: Uses models.get() API (no generation quota consumed)
 * - OpenAI: Uses /models endpoint to list available models (no generation quota)
 */
export const verifyModelIdentity = async (options: VerifyModelOptions): Promise<string> => {
  const { provider, geminiApiKey, modelId, openaiBaseUrl, openaiApiKey, openaiModel } = options;

  if (provider === 'gemini') {
    if (!geminiApiKey) {
      throw new Error("Gemini API Key is required for verification.");
    }
    const requestedModel = modelId || 'gemini-3-flash-preview';

    try {
      // Use the models.get() API - this doesn't consume generation quota
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}?key=${geminiApiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Model not found");
      }

      const data = await response.json();
      // Return the display name or model name from the API
      return data.displayName || data.name?.replace('models/', '') || requestedModel;
    } catch (error: any) {
      console.error("Gemini Verification Error:", error);
      throw new Error(error.message || "Failed to verify Gemini model");
    }
  }

  if (provider === 'openai') {
    if (!openaiApiKey || !openaiBaseUrl) {
      throw new Error("OpenAI API Key and Base URL are required for verification.");
    }
    const baseUrl = openaiBaseUrl.replace(/\/+$/, '');
    const requestedModel = openaiModel || 'gpt-3.5-turbo';

    try {
      // Use /models endpoint to verify the API key works and get model info
      // This doesn't consume chat completion quota
      const url = `${baseUrl}/models/${requestedModel}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.id || requestedModel;
      }

      // If specific model endpoint fails, try listing models to verify API key
      const listResponse = await fetch(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        }
      });

      if (!listResponse.ok) {
        const err = await listResponse.json();
        throw new Error(err.error?.message || "API key verification failed");
      }

      // API key is valid, return the configured model name
      return requestedModel;
    } catch (error: any) {
      console.error("OpenAI Verification Error:", error);
      throw new Error(`OpenAI Verification Error: ${error.message}`);
    }
  }

  throw new Error("Model verification is only available for LLM providers (Gemini, OpenAI).");
};

// --- Internal Providers ---

const translateWithGemini = async (text: string, source: string, target: string, options: TranslateOptions) => {
  const geminiClient = getGeminiClient(options.geminiApiKey);
  const modelId = options.modelId || 'gemini-3-flash-preview';
  const systemPromptEnabled = options.systemPromptEnabled !== false; // Default to true

  let systemInstruction: string | undefined = undefined;

  if (systemPromptEnabled) {
    systemInstruction = options.customSystemInstruction;
    if (!systemInstruction) {
      const isToChinese = target.startsWith('zh');
      systemInstruction = isToChinese
        ? `You are a professional translator. Translate text to ${target}. Be faithful, professional, and do not add explanations.`
        : `You are a professional translator. Translate text to ${target}. Use professional terminology. No explanations.`;
    }
  }

  const prompt = `Source: ${source}\nTarget: ${target}\nText:\n${text}`;

  try {
    const response = await geminiClient.models.generateContent({
      model: modelId,
      contents: prompt,
      config: { systemInstruction, temperature: 0.3 },
    });
    return response.text?.trim() || "Translation failed.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "Gemini API Error");
  }
};

const translateImageWithGemini = async (base64Image: string, targetLang: string, options: TranslateOptions) => {
  const geminiClient = getGeminiClient(options.geminiApiKey);
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  const modelId = options.modelId || 'gemini-3-flash-preview';

  const prompt = `Extract text and translate to ${targetLang}. Return JSON: { "extracted": "...", "translation": "..." }`;

  try {
    const response = await geminiClient.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: 'application/json' }
    });
    const result = JSON.parse(response.text || "{}");
    return {
      detectedText: result.extracted || "No text detected.",
      translatedText: result.translation || "Could not translate."
    };
  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    throw new Error(error.message || "Gemini OCR Failed");
  }
};

const translateWithOpenAI = async (text: string, source: string, target: string, options: TranslateOptions) => {
  if (!options.openaiApiKey || !options.openaiBaseUrl) {
    throw new Error("OpenAI API Key and Base URL are required.");
  }
  const baseUrl = options.openaiBaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const systemPromptEnabled = options.systemPromptEnabled !== false; // Default to true

  // Build messages array
  const messages: Array<{ role: string; content: string }> = [];

  if (systemPromptEnabled) {
    const systemPrompt = options.customSystemInstruction ||
      `You are a professional translator. Translate the following content from ${source === 'auto' ? 'detected language' : source} to ${target}. Output ONLY the translation, no explanations.`;
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: text });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.openaiApiKey}`
      },
      body: JSON.stringify({
        model: options.openaiModel || 'gpt-3.5-turbo',
        messages,
        temperature: 0.3
      })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "OpenAI API Request Failed");
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "Translation empty.";
  } catch (error: any) {
    console.error("OpenAI Error:", error);
    throw new Error(`OpenAI Error: ${error.message}`);
  }
};

const translateWithDeepL = async (text: string, source: string, target: string, options: TranslateOptions) => {
  if (!options.deeplApiKey) {
    throw new Error("DeepL API Key is required.");
  }

  const isFree = options.deeplApiKey.endsWith(':fx');
  const baseUrl = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
  
  // DeepL Language Codes: EN-US, EN-GB, PT-BR, etc.
  // Our app uses 'en', 'zh-CN', etc.
  // DeepL 'target_lang' supports 'ZH' (Simplified) but 'zh-CN' is deprecated/mapped.
  // Let's do some basic mapping if needed.
  let targetLang = target.toUpperCase();
  if (targetLang === 'EN') targetLang = 'EN-US'; // Default to US English
  if (targetLang === 'ZH-CN') targetLang = 'ZH';
  
  const params = new URLSearchParams();
  params.append('text', text);
  params.append('target_lang', targetLang);
  if (source !== 'auto') {
    params.append('source_lang', source.toUpperCase().split('-')[0]); // DeepL source is usually 2 chars (EN, ZH, JA)
  }

  const url = `${baseUrl}?${params.toString()}`;

  try {
    // Use Electron Proxy if available (better for bypassing firewalls/CORS)
    // @ts-ignore
    if (window.electron && window.electron.request) {
        // Use the new enhanced proxy request with headers
        // @ts-ignore
        const response = await window.electron.request(url, {
          method: 'POST',
          headers: {
             'Authorization': `DeepL-Auth-Key ${options.deeplApiKey}`,
             'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        if (!response.ok) {
             // Try to parse error
             const errData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
             throw new Error(`DeepL Error: ${response.statusCode} - ${errData}`);
        }
        
        const data = response.data;
        return data.translations?.[0]?.text || "Translation empty.";
    } else {
        // Fallback for Web
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${options.deeplApiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || "DeepL API Request Failed");
        }
        const data = await response.json();
        return data.translations?.[0]?.text || "Translation empty.";
    }
  } catch (error: any) {
    console.error("DeepL Error:", error);
    throw new Error(`DeepL Error: ${error.message}`);
  }
};

/**
 * Google Translate (Free/GTX) Implementation
 * Note: This endpoint is rate-limited and intended for browser internal use.
 * In a production App, use the Cloud API or a proxy server.
 * When running in Electron, we should route this through the main process to avoid CORS.
 */
const translateWithGoogleFree = async (text: string, source: string, target: string) => {
  try {
    const sl = source === 'auto' ? 'auto' : source;
    // Fix language codes for Google (e.g., zh-CN -> zh-CN is usually fine, but ensure compatibility)
    const tl = target; 
    
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

    // Check if we are in Electron environment (exposed via preload)
    // @ts-ignore
    if (window.electron && window.electron.request) {
        // Use Electron main process to fetch (bypasses CORS)
        // @ts-ignore
        const response = await window.electron.request(url);
        if (!response.ok) throw new Error("Google Network Error");
        // Google GTX returns [[["Translated Text", "Original", ...], ...], ...]
        const data = response.data;
        return data[0].map((s: any) => s[0]).join('');
    } else {
        // Fallback for Web (May hit CORS)
        const response = await fetch(url);
        if (!response.ok) throw new Error("Google API Error (CORS or Limit)");
        const data = await response.json();
        return data[0].map((s: any) => s[0]).join('');
    }

  } catch (error: any) {
    console.error("Google Free Error:", error);
    throw new Error("Google Translate Failed. If using Web, this is likely CORS. Please use the Desktop App.");
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

  const region = options.microsoftRegion || 'eastus';

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

  const baseUrl = 'https://api.cognitive.microsofttranslator.com/translate';
  const params = new URLSearchParams({
    'api-version': '3.0',
    'to': toLang,
  });

  if (fromLang) {
    params.append('from', fromLang);
  }

  const url = `${baseUrl}?${params.toString()}`;
  const body = JSON.stringify([{ Text: text }]);

  try {
    // Use Electron Proxy if available
    // @ts-ignore
    if (window.electron && window.electron.request) {
      // @ts-ignore
      const response = await window.electron.request(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': options.microsoftSubscriptionKey,
          'Ocp-Apim-Subscription-Region': region,
          'Content-Type': 'application/json',
        },
        body: body,
      });

      if (!response.ok) {
        const errData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        throw new Error(`Microsoft Translator Error: ${response.statusCode} - ${errData}`);
      }

      const data = response.data;
      return data[0]?.translations?.[0]?.text || "Translation empty.";
    } else {
      // Fallback for Web
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': options.microsoftSubscriptionKey,
          'Ocp-Apim-Subscription-Region': region,
          'Content-Type': 'application/json',
        },
        body: body,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Microsoft Translator API Request Failed");
      }

      const data = await response.json();
      return data[0]?.translations?.[0]?.text || "Translation empty.";
    }
  } catch (error: any) {
    console.error("Microsoft Translator Error:", error);
    throw new Error(`Microsoft Translator Error: ${error.message}`);
  }
};
