export type APIProvider =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'grok'
  | 'groq'
  | 'openrouter'
  | 'deepseek'
  | 'qwen';

export const PROVIDER_DISPLAY_NAMES: Record<APIProvider, string> = {
  google: 'Google Gemini',
  openai: 'OpenAI ChatGPT',
  anthropic: 'Anthropic Claude',
  deepseek: 'DeepSeek',
  qwen: 'Alibaba Qwen',
  ollama: 'Ollama',
  grok: 'xAI Grok',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

export const DEFAULT_MODELS: Record<APIProvider, string> = {
  google: '',
  openai: '',
  anthropic: '',
  ollama: '',
  grok: '',
  groq: '',
  openrouter: '',
  deepseek: '',
  qwen: '',
};

export const DEFAULT_PROVIDER: APIProvider = 'google';
export const DEFAULT_MODEL = DEFAULT_MODELS[DEFAULT_PROVIDER];

export const API_KEY_STORAGE_KEYS: Record<APIProvider, string> = {
  google: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  ollama: 'OLLAMA_HOST',
  grok: 'GROK_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  qwen: 'QWEN_API_KEY',
};

export const OPENAI_COMPATIBLE_BASE_URLS: Partial<Record<APIProvider, string>> =
  {
    grok: 'https://api.x.ai/v1',
    groq: 'https://api.groq.com/openai/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    deepseek: 'https://api.deepseek.com',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  };

let qwenBaseUrl: string | undefined;

export function configureQwenBaseUrl(value?: string): void {
  const trimmed = value?.trim();
  qwenBaseUrl = trimmed === '' ? undefined : trimmed;
}

export function getOpenAICompatibleBaseUrl(
  provider: APIProvider,
): string | undefined {
  if (provider === 'qwen' && qwenBaseUrl) {
    const url = new URL(qwenBaseUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('Invalid Qwen base URL');
    }
    return url.toString().replace(/\/$/, '');
  }
  return OPENAI_COMPATIBLE_BASE_URLS[provider];
}

export function isAPIProvider(value: string): value is APIProvider {
  return value in API_KEY_STORAGE_KEYS;
}
