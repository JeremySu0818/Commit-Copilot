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

export function getCustomProviderModelsStorageKey(providerId: string): string {
  return `CUSTOM_${providerId}_MODELS`;
}
export type GenerateMode = 'agentic' | 'direct-diff';
export interface CommitOutputOptions {
  includeScope: boolean;
  includeBody: boolean;
  includeFooter: boolean;
  includeGitmoji: boolean;
}
export interface HybridGenerationOptions {
  enabled: boolean;
}
export const GENERATE_MODE_DISPLAY_NAMES: Record<GenerateMode, string> = {
  agentic: 'Agentic Generate',
  'direct-diff': 'Direct Diff',
};
export const DEFAULT_HYBRID_GENERATION_OPTIONS: HybridGenerationOptions = {
  enabled: false,
};
export const HYBRID_GENERATION_OPTIONS_STATE_KEY = 'HYBRID_GENERATION_OPTIONS';
export const PROVIDER_DISPLAY_NAMES: Record<APIProvider, string> = {
  google: 'Google (Gemini)',
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
  ollama: 'Ollama (Local)',
  grok: 'xAI (Grok)',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
};
export interface ModelConfig {
  id: string;
  alias: string;
  max_tokens?: number;
}

interface OpenRouterModelResponse {
  data?: unknown[];
}

interface OpenAICompatibleModelResponse {
  data?: unknown[];
}

interface OpenRouterModelObject {
  id?: unknown;
  name?: unknown;
  architecture?: unknown;
  supported_parameters?: unknown;
  top_provider?: unknown;
}

interface OpenAICompatibleModelObject {
  id?: unknown;
  name?: unknown;
}

const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_REQUIRED_OUTPUT_MODALITY = 'text';
const OPENROUTER_REQUIRED_SUPPORTED_PARAMETER = 'tools';
const QWEN_MODELS_ENDPOINT =
  'https://dashscope.aliyuncs.com/compatible-mode/v1/models';
const QWEN_TEXT_GENERATION_MODEL_PATTERN =
  /^qwen(?:\d|[-.]max|[-.]plus|[-.]flash|[-.]turbo|[-.]coder|[-.]long|[-.]mt|[-.]math)/i;
const QWEN_EXCLUDED_MODEL_PARTS = [
  'embedding',
  'rerank',
  'vl',
  'qvq',
  'omni',
  'audio',
  'asr',
  'tts',
  'image',
  'wan',
  'cosyvoice',
  'paraformer',
  'sambert',
];

export const GEMINI_MODELS: ModelConfig[] = [
  { id: 'gemini-2.5-flash-lite', alias: 'Gemini 2.5 Flash-Lite' },
  { id: 'gemini-2.5-flash', alias: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', alias: 'Gemini 2.5 Pro' },
  { id: 'gemini-3-flash-preview', alias: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-flash-lite-preview', alias: 'Gemini 3.1 Flash-Lite' },
  { id: 'gemini-3.1-pro-preview', alias: 'Gemini 3.1 Pro' },
  { id: 'gemini-3.5-flash', alias: 'Gemini 3.5 Flash' },
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
  { id: 'gpt-5.5', alias: 'GPT-5.5' },
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
  {
    id: 'claude-opus-4-8',
    alias: 'Claude Opus 4.8',
    max_tokens: 128000,
  },
];

export const OLLAMA_MODELS: ModelConfig[] = [];

export const GROK_MODELS: ModelConfig[] = [
  { id: 'grok-4.20-0309-non-reasoning', alias: 'Grok 4.20 (non-reasoning)' },
  { id: 'grok-4.20-0309-reasoning', alias: 'Grok 4.20 (reasoning)' },
  { id: 'grok-4.3', alias: 'Grok 4.3' },
];

export const GROQ_MODELS: ModelConfig[] = [
  { id: 'llama-3.1-8b-instant', alias: 'Llama 3.1 8B (Instant)' },
  { id: 'llama-3.3-70b-versatile', alias: 'Llama 3.3 70B (Versatile)' },
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    alias: 'Llama 4 Scout 17B 16e (Instruct)',
  },
  { id: 'openai/gpt-oss-20b', alias: 'gpt-oss-20B' },
  { id: 'openai/gpt-oss-120b', alias: 'gpt-oss-120B' },
  { id: 'openai/gpt-oss-safeguard-20b', alias: 'gpt-oss-safeguard-20B' },
  { id: 'qwen/qwen3-32b', alias: 'Qwen 3 32b' },
];

export const OPENROUTER_MODELS: ModelConfig[] = [];

function isOpenRouterModelObject(
  value: unknown,
): value is OpenRouterModelObject {
  return typeof value === 'object' && value !== null;
}

function getStringArrayProperty(value: unknown, property: string): string[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const record = value as Record<string, unknown>;
  const raw = record[property];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is string => typeof item === 'string');
}

function getOpenRouterMaxTokens(
  model: OpenRouterModelObject,
): number | undefined {
  if (typeof model.top_provider !== 'object' || model.top_provider === null) {
    return undefined;
  }
  const raw = (model.top_provider as Record<string, unknown>)
    .max_completion_tokens;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

function isSupportedOpenRouterModel(model: OpenRouterModelObject): boolean {
  if (typeof model.id !== 'string' || model.id.length === 0) {
    return false;
  }

  const outputModalities = getStringArrayProperty(
    model.architecture,
    'output_modalities',
  );
  const supportedParameters = getStringArrayProperty(
    model,
    'supported_parameters',
  );
  return (
    outputModalities.includes(OPENROUTER_REQUIRED_OUTPUT_MODALITY) &&
    supportedParameters.includes(OPENROUTER_REQUIRED_SUPPORTED_PARAMETER)
  );
}

function toOpenRouterModelConfig(model: OpenRouterModelObject): ModelConfig {
  const id = String(model.id);
  const alias =
    typeof model.name === 'string' && model.name.length > 0 ? model.name : id;
  const maxTokens = getOpenRouterMaxTokens(model);
  return {
    id,
    alias,
    ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
  };
}

export async function fetchOpenRouterModels(
  apiKey?: string,
): Promise<ModelConfig[]> {
  const url = new URL(OPENROUTER_MODELS_ENDPOINT);
  url.searchParams.set(
    'output_modalities',
    OPENROUTER_REQUIRED_OUTPUT_MODALITY,
  );
  url.searchParams.set(
    'supported_parameters',
    OPENROUTER_REQUIRED_SUPPORTED_PARAMETER,
  );

  const headers: Record<string, string> = {};
  if (apiKey && apiKey.length > 0) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `OpenRouter models request failed (${String(response.status)})`,
    );
  }

  const payload = (await response.json()) as OpenRouterModelResponse;
  const models = (payload.data ?? [])
    .filter(isOpenRouterModelObject)
    .filter(isSupportedOpenRouterModel)
    .map(toOpenRouterModelConfig);
  models.sort((a, b) => a.alias.localeCompare(b.alias));
  return models;
}

function isOpenAICompatibleModelObject(
  value: unknown,
): value is OpenAICompatibleModelObject {
  return typeof value === 'object' && value !== null;
}

function toOpenAICompatibleModelConfig(
  model: OpenAICompatibleModelObject,
): ModelConfig {
  const id = String(model.id);
  return {
    id,
    alias:
      typeof model.name === 'string' && model.name.length > 0 ? model.name : id,
  };
}

function isSupportedQwenTextToolModel(model: ModelConfig): boolean {
  const normalizedId = model.id.toLowerCase();
  return (
    QWEN_TEXT_GENERATION_MODEL_PATTERN.test(normalizedId) &&
    !QWEN_EXCLUDED_MODEL_PARTS.some((part) => normalizedId.includes(part))
  );
}

export async function fetchQwenModels(apiKey?: string): Promise<ModelConfig[]> {
  const headers: Record<string, string> = {};
  if (apiKey && apiKey.length > 0) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(QWEN_MODELS_ENDPOINT, { headers });
  if (!response.ok) {
    throw new Error(`Qwen models request failed (${String(response.status)})`);
  }

  const payload = (await response.json()) as OpenAICompatibleModelResponse;
  const models = (payload.data ?? [])
    .filter(isOpenAICompatibleModelObject)
    .filter((model) => typeof model.id === 'string' && model.id.length > 0)
    .map(toOpenAICompatibleModelConfig)
    .filter(isSupportedQwenTextToolModel);
  models.sort((a, b) => a.alias.localeCompare(b.alias));
  return models;
}

export const DEEPSEEK_MODELS: ModelConfig[] = [
  { id: 'deepseek-chat', alias: 'DeepSeek Chat' },
  { id: 'deepseek-reasoner', alias: 'DeepSeek R1 (Reasoner)' },
  { id: 'deepseek-v4-flash', alias: 'DeepSeek V4 Flash' },
  { id: 'deepseek-v4-pro', alias: 'DeepSeek V4 Pro' },
];

export const QWEN_MODELS: ModelConfig[] = [];

export const MODELS_BY_PROVIDER: Record<APIProvider, ModelConfig[]> = {
  google: GEMINI_MODELS,
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  ollama: OLLAMA_MODELS,
  grok: GROK_MODELS,
  groq: GROQ_MODELS,
  openrouter: OPENROUTER_MODELS,
  deepseek: DEEPSEEK_MODELS,
  qwen: QWEN_MODELS,
};

export const DEFAULT_MODELS: Record<APIProvider, string> = {
  google: 'gemini-3.5-flash',
  openai: 'gpt-5.5',
  anthropic: 'claude-sonnet-4-6',
  ollama: '',
  grok: 'grok-4.3',
  groq: 'openai/gpt-oss-120b',
  openrouter: 'google/gemini-3.5-flash',
  deepseek: 'deepseek-v4-flash',
  qwen: 'qwen3.7-plus',
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

export function resolveDefaultModel(
  provider: APIProvider,
  models: ModelConfig[],
  savedModel?: string,
): string {
  const modelIds = new Set(models.map((model) => model.id));

  if (savedModel && modelIds.has(savedModel)) {
    return savedModel;
  }

  const defaultModel = DEFAULT_MODELS[provider];
  if (defaultModel && modelIds.has(defaultModel)) {
    return defaultModel;
  }

  return models[0]?.id ?? '';
}

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
export const OLLAMA_DEFAULT_HOST = 'http://127.0.0.1:11434';
export const DEFAULT_GENERATE_MODE: GenerateMode = 'agentic';
export const MAX_AGENT_STEPS_STATE_KEY = 'MAX_AGENT_STEPS';
export const DEFAULT_MAX_AGENT_STEPS = 0;
export const DEFAULT_COMMIT_OUTPUT_OPTIONS: CommitOutputOptions = {
  includeScope: true,
  includeBody: true,
  includeFooter: false,
  includeGitmoji: false,
};

export function resolveGenerateMode(
  savedGenerateMode: GenerateMode | undefined,
  requestedGenerateMode: GenerateMode | undefined,
): GenerateMode {
  return requestedGenerateMode ?? savedGenerateMode ?? DEFAULT_GENERATE_MODE;
}

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
    includeGitmoji:
      typeof candidate.includeGitmoji === 'boolean'
        ? candidate.includeGitmoji
        : DEFAULT_COMMIT_OUTPUT_OPTIONS.includeGitmoji,
  };
}

export function normalizeHybridGenerationOptions(
  options: unknown,
): HybridGenerationOptions {
  const candidate =
    options && typeof options === 'object'
      ? (options as Partial<HybridGenerationOptions>)
      : {};

  return {
    enabled:
      typeof candidate.enabled === 'boolean'
        ? candidate.enabled
        : DEFAULT_HYBRID_GENERATION_OPTIONS.enabled,
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
