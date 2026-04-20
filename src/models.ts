export type APIProvider = 'google' | 'openai' | 'anthropic' | 'ollama';

export interface CustomProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
}

export const CUSTOM_PROVIDERS_STATE_KEY = 'CUSTOM_PROVIDERS';
export const CUSTOM_PROVIDER_PREFIX = 'custom:';

export function isCustomProvider(provider: string): boolean {
  return provider.startsWith(CUSTOM_PROVIDER_PREFIX);
}

export function getCustomProviderId(provider: string): string {
  return provider.slice(CUSTOM_PROVIDER_PREFIX.length);
}

export function makeCustomProviderKey(id: string): string {
  return `${CUSTOM_PROVIDER_PREFIX}${id}`;
}

export function getCustomProviderStorageKey(providerId: string): string {
  return `CUSTOM_${providerId}_API_KEY`;
}
export type GenerateMode = 'agentic' | 'direct-diff';
export interface CommitOutputOptions {
  includeScope: boolean;
  includeBody: boolean;
  includeFooter: boolean;
}
export const GENERATE_MODE_DISPLAY_NAMES: Record<GenerateMode, string> = {
  agentic: 'Agentic Generate',
  'direct-diff': 'Direct Diff',
};
export const PROVIDER_DISPLAY_NAMES: Record<APIProvider, string> = {
  google: 'Google (Gemini)',
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
  ollama: 'Ollama (Local)',
};
export interface ModelConfig {
  id: string;
  alias: string;
  max_tokens?: number;
}

export const GEMINI_MODELS: ModelConfig[] = [
  { id: 'gemini-2.5-flash-lite', alias: 'Gemini 2.5 Flash-Lite' },
  { id: 'gemini-2.5-flash', alias: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', alias: 'Gemini 2.5 Pro' },
  { id: 'gemini-3-flash-preview', alias: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-flash-lite-preview', alias: 'Gemini 3.1 Flash-Lite' },
  { id: 'gemini-3.1-pro-preview', alias: 'Gemini 3.1 Pro' },
];

export const OPENAI_MODELS: ModelConfig[] = [
  { id: 'o3', alias: 'o3' },
  { id: 'o3-mini', alias: 'o3-mini' },
  { id: 'o4-mini', alias: 'o4-mini' },
  { id: 'gpt-4o-mini', alias: 'GPT-4o mini' },
  { id: 'gpt-4o', alias: 'GPT-4o' },
  { id: 'gpt-4.1-nano', alias: 'GPT-4.1 nano' },
  { id: 'gpt-4.1-mini', alias: 'GPT-4.1 mini' },
  { id: 'gpt-4.1', alias: 'GPT-4.1' },
  { id: 'gpt-5-nano', alias: 'GPT-5 nano' },
  { id: 'gpt-5-mini', alias: 'GPT-5 mini' },
  { id: 'gpt-5', alias: 'GPT-5' },
  { id: 'gpt-5.1', alias: 'GPT-5.1' },
  { id: 'gpt-5.2', alias: 'GPT-5.2' },
  { id: 'gpt-5.4-nano', alias: 'GPT-5.4 nano' },
  { id: 'gpt-5.4-mini', alias: 'GPT-5.4 mini' },
  { id: 'gpt-5.4', alias: 'GPT-5.4' },
];

export const ANTHROPIC_MODELS: ModelConfig[] = [
  {
    id: 'claude-sonnet-4-20250514',
    alias: 'Claude Sonnet 4',
    max_tokens: 64000,
  },
  {
    id: 'claude-opus-4-20250514',
    alias: 'Claude Opus 4',
    max_tokens: 32000,
  },
  {
    id: 'claude-opus-4-1-20250805',
    alias: 'Claude Opus 4.1',
    max_tokens: 32000,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    alias: 'Claude Haiku 4.5',
    max_tokens: 64000,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    alias: 'Claude Sonnet 4.5',
    max_tokens: 64000,
  },
  {
    id: 'claude-opus-4-5-20251101',
    alias: 'Claude Opus 4.5',
    max_tokens: 64000,
  },
  {
    id: 'claude-sonnet-4-6',
    alias: 'Claude Sonnet 4.6',
    max_tokens: 128000,
  },
  {
    id: 'claude-opus-4-6',
    alias: 'Claude Opus 4.6',
    max_tokens: 128000,
  },
  {
    id: 'claude-opus-4-7',
    alias: 'Claude Opus 4.7',
    max_tokens: 128000,
  },
];

export const OLLAMA_MODELS: ModelConfig[] = [
  { id: 'gemma3:1b', alias: 'Gemma 3 1B' },
  { id: 'gemma3:4b', alias: 'Gemma 3 4B' },
  { id: 'gemma3:12b', alias: 'Gemma 3 12B' },
  { id: 'gemma3:27b', alias: 'Gemma 3 27B' },
  { id: 'gpt-oss:20b', alias: 'gpt-oss-20B' },
  { id: 'gpt-oss:120b', alias: 'gpt-oss-120B' },
  { id: 'llama3.3:8b', alias: 'Llama 3.3 8B' },
  { id: 'llama3.3:70b', alias: 'Llama 3.3 70B' },
  { id: 'phi4:14b', alias: 'Phi-4 14B' },
  { id: 'mistral:7b', alias: 'Mistral 7B' },
];

export const MODELS_BY_PROVIDER: Record<APIProvider, ModelConfig[]> = {
  google: GEMINI_MODELS,
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  ollama: OLLAMA_MODELS,
};

export const DEFAULT_MODELS: Record<APIProvider, string> = {
  google: 'gemini-3-flash-preview',
  openai: 'gpt-5.4',
  anthropic: 'claude-sonnet-4-6',
  ollama: 'gemma3:12b',
};
export function getAnthropicModelMaxTokens(
  modelId?: string,
): number | undefined {
  const resolvedModelId =
    modelId && modelId.length > 0 ? modelId : DEFAULT_MODELS.anthropic;
  return ANTHROPIC_MODELS.find(({ id }) => id === resolvedModelId)?.max_tokens;
}
export const DEFAULT_PROVIDER: APIProvider = 'google';
export const DEFAULT_MODEL = DEFAULT_MODELS[DEFAULT_PROVIDER];
export const API_KEY_STORAGE_KEYS: Record<APIProvider, string> = {
  google: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  ollama: 'OLLAMA_HOST',
};
export const OLLAMA_DEFAULT_HOST = 'http://127.0.0.1:11434';
export const DEFAULT_GENERATE_MODE: GenerateMode = 'agentic';
export const MAX_AGENT_STEPS_STATE_KEY = 'MAX_AGENT_STEPS';
export const DEFAULT_MAX_AGENT_STEPS = 0;
export const DEFAULT_COMMIT_OUTPUT_OPTIONS: CommitOutputOptions = {
  includeScope: true,
  includeBody: true,
  includeFooter: false,
};

export function normalizeCommitOutputOptions(
  options: unknown,
): CommitOutputOptions {
  const candidate =
    options && typeof options === 'object'
      ? (options as Partial<CommitOutputOptions>)
      : {};

  return {
    includeScope:
      typeof candidate.includeScope === 'boolean'
        ? candidate.includeScope
        : DEFAULT_COMMIT_OUTPUT_OPTIONS.includeScope,
    includeBody:
      typeof candidate.includeBody === 'boolean'
        ? candidate.includeBody
        : DEFAULT_COMMIT_OUTPUT_OPTIONS.includeBody,
    includeFooter:
      typeof candidate.includeFooter === 'boolean'
        ? candidate.includeFooter
        : DEFAULT_COMMIT_OUTPUT_OPTIONS.includeFooter,
  };
}

export function normalizeMaxAgentStepsValue(value: unknown): number {
  let raw = '';
  if (typeof value === 'string') {
    raw = value.trim();
  } else if (typeof value === 'number') {
    raw = String(value);
  }
  if (!raw || !/^\d+$/.test(raw)) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}
