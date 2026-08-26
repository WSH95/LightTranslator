export interface GoogleProxyRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface GoogleProxyResponse {
  ok: boolean;
  statusCode?: number;
  data?: string;
  error?: string;
}

export type GoogleRequester = (
  url: string,
  options?: GoogleProxyRequestOptions,
) => Promise<GoogleProxyResponse>;

interface GoogleEndpoint {
  label: string;
  url: string;
  parse: (data: unknown) => string;
}

interface EndpointResult {
  translation?: string;
  failure?: string;
}

const requestHeaders = {
  Accept: 'application/json',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
};

const parseJson = (data: unknown): unknown => {
  if (typeof data === 'string') return JSON.parse(data);
  return data;
};

const parseChromeDictionaryResponse = (data: unknown): string => {
  const parsed = parseJson(data) as {
    sentences?: Array<{ trans?: unknown }>;
  } | null;
  if (!parsed || !Array.isArray(parsed.sentences)) {
    throw new Error('missing sentences');
  }

  const translation = parsed.sentences
    .map((sentence) => typeof sentence?.trans === 'string' ? sentence.trans : '')
    .join('');
  if (!translation) throw new Error('empty translation');
  return translation;
};

const parseGtxResponse = (data: unknown): string => {
  const parsed = parseJson(data) as unknown[] | null;
  const segments = Array.isArray(parsed) && Array.isArray(parsed[0])
    ? parsed[0] as unknown[]
    : null;
  if (!segments) throw new Error('missing translation segments');

  const translation = segments
    .map((segment) => Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : '')
    .join('');
  if (!translation) throw new Error('empty translation');
  return translation;
};

const describeTransportError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim().slice(0, 160) || 'unknown transport error';
};

const attemptEndpoint = async (
  endpoint: GoogleEndpoint,
  body: string,
  request: GoogleRequester,
): Promise<EndpointResult> => {
  let response: GoogleProxyResponse;
  try {
    response = await request(endpoint.url, {
      method: 'POST',
      headers: requestHeaders,
      body,
    });
  } catch (error) {
    return { failure: `${endpoint.label}: ${describeTransportError(error)}` };
  }

  if (!response.ok) {
    const detail = response.statusCode != null
      ? `HTTP ${response.statusCode}`
      : describeTransportError(response.error || 'network error');
    return { failure: `${endpoint.label}: ${detail}` };
  }

  try {
    return { translation: endpoint.parse(response.data) };
  } catch (error) {
    return {
      failure: `${endpoint.label}: invalid response (${describeTransportError(error)})`,
    };
  }
};

/**
 * Translate through Google's no-key web endpoints.
 *
 * The Chrome Dictionary endpoint is preferred because the older GTX client is
 * aggressively throttled on some networks. Both requests keep source text in
 * a form body rather than a URL. The second endpoint is attempted at most once.
 */
export const translateWithGoogleFreeEndpoints = async (
  text: string,
  source: string,
  target: string,
  request: GoogleRequester,
): Promise<string> => {
  const sl = source === 'auto' ? 'auto' : source;
  const body = new URLSearchParams({ q: text }).toString();

  const primaryParams = new URLSearchParams({
    client: 'dict-chrome-ex',
    sl,
    tl: target,
    dt: 't',
    dj: '1',
  });
  const fallbackParams = new URLSearchParams({
    client: 'gtx',
    sl,
    tl: target,
    dt: 't',
  });

  const primary = await attemptEndpoint({
    label: 'Chrome endpoint',
    url: `https://clients5.google.com/translate_a/single?${primaryParams.toString()}`,
    parse: parseChromeDictionaryResponse,
  }, body, request);
  if (primary.translation != null) return primary.translation;

  console.warn(`[google-free] ${primary.failure}; trying GTX fallback`);
  const fallback = await attemptEndpoint({
    label: 'GTX endpoint',
    url: `https://translate.googleapis.com/translate_a/single?${fallbackParams.toString()}`,
    parse: parseGtxResponse,
  }, body, request);
  if (fallback.translation != null) return fallback.translation;

  throw new Error(
    `both no-key endpoints failed (${primary.failure}; ${fallback.failure}). ` +
    'Try again later or use another engine.'
  );
};
