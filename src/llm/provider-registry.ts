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
  google: 'gemini-3.5-flash',
  openai: 'gpt-5.5',
  anthropic: 'claude-sonnet-5',
  ollama: '',
  grok: 'grok-4.3',
  groq: 'openai/gpt-oss-120b',
  openrouter: 'google/gemini-3.5-flash',
  deepseek: 'deepseek-v4-flash',
  qwen: 'qwen3.7-plus',
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

export function getOpenAICompatibleBaseUrl(
  provider: APIProvider,
): string | undefined {
  return OPENAI_COMPATIBLE_BASE_URLS[provider];
}

export function isAPIProvider(value: string): value is APIProvider {
  return value in API_KEY_STORAGE_KEYS;
}
