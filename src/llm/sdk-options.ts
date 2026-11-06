export const ANTHROPIC_API_VERSION = '2026-10-21';
export const GOOGLE_API_VERSION = 'v1beta';
export const DEFAULT_ANTHROPIC_MAX_TOKENS = 4096;
export const MODEL_REQUEST_TIMEOUT_MS = 15000;
const GENERATION_TIMEOUT_MS = 900000;

export function googleClientOptions(
  apiKey: string,
  timeout = GENERATION_TIMEOUT_MS,
) {
  return {
    apiKey,
    httpOptions: {
      apiVersion: GOOGLE_API_VERSION,
      timeout,
      retryOptions: { attempts: 1 },
    },
  };
}

export function openAIClientOptions(apiKey: string, baseURL?: string) {
  return {
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    timeout: GENERATION_TIMEOUT_MS,
    maxRetries: 0,
  };
}

export function anthropicClientOptions(apiKey: string, baseURL?: string) {
  return {
    apiKey,
    ...(baseURL
      ? {
          baseURL,
          defaultHeaders: { 'x-api-key': apiKey, Authorization: null },
        }
      : {}),
    timeout: GENERATION_TIMEOUT_MS,
    maxRetries: 0,
  };
}

export function isQwenBaseUrl(baseUrl?: string): boolean {
  if (!baseUrl) {
    return false;
  }
  const { hostname, pathname } = new URL(baseUrl);
  return (
    hostname.endsWith('.aliyuncs.com') &&
    pathname.replace(/\/$/, '') === '/compatible-mode/v1'
  );
}

export function usesResponsesApi(
  model: string,
  baseUrl?: string,
  apiFormat?: string,
): boolean {
  if (apiFormat) {
    return apiFormat === 'responses';
  }
  return !baseUrl && !/^gpt-(?:3\.5(?:-|$)|4(?:-|$))/i.test(model);
}
