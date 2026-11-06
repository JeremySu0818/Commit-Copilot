import {
  APIProvider,
  DEFAULT_MODELS,
  getOpenAICompatibleBaseUrl,
} from '../llm/provider-registry';
import {
  DEFAULT_ANTHROPIC_MAX_TOKENS,
  MODEL_REQUEST_TIMEOUT_MS,
} from '../llm/sdk-options';

import { getModelAlias } from './model-alias';

export interface ModelConfig {
  id: string;
  alias: string;
  max_tokens?: number;
}

interface OpenRouterModelResponse {
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
const QWEN_MODEL_PAGE_SIZE = 100;
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

export const GEMINI_MODELS: ModelConfig[] = [];

export const OPENAI_MODELS: ModelConfig[] = [];

export const ANTHROPIC_MODELS: ModelConfig[] = [];

export const OLLAMA_MODELS: ModelConfig[] = [];

export const GROK_MODELS: ModelConfig[] = [];

export const GROQ_MODELS: ModelConfig[] = [];

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
  const alias = getModelAlias(id, model.name);
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

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS),
  });
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
    alias: getModelAlias(id, model.name),
  };
}

function isSupportedQwenTextToolModel(model: ModelConfig): boolean {
  const normalizedId = model.id.toLowerCase();
  return (
    QWEN_TEXT_GENERATION_MODEL_PATTERN.test(normalizedId) &&
    !QWEN_EXCLUDED_MODEL_PARTS.some((part) => normalizedId.includes(part))
  );
}

interface QwenModelPage {
  models: unknown[];
  total: number;
}

function parseQwenModelPage(value: unknown): QwenModelPage {
  const output =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>).output
      : undefined;
  if (typeof output !== 'object' || output === null) {
    throw new Error('Qwen returned an invalid model list');
  }
  const { models, total } = output as Record<string, unknown>;
  if (
    !Array.isArray(models) ||
    typeof total !== 'number' ||
    !Number.isSafeInteger(total) ||
    total < 0
  ) {
    throw new Error('Qwen returned an invalid model list');
  }
  return { models, total };
}

function appendQwenModels(
  items: unknown[],
  seenIds: Set<string>,
  models: ModelConfig[],
): void {
  for (const item of items) {
    if (!isOpenAICompatibleModelObject(item)) {
      continue;
    }
    const raw = item as Record<string, unknown>;
    if (typeof raw.model !== 'string' || !raw.model || seenIds.has(raw.model)) {
      continue;
    }
    seenIds.add(raw.model);
    const model = toOpenAICompatibleModelConfig({
      id: raw.model,
      name: item.name,
    });
    if (isSupportedQwenTextToolModel(model)) {
      models.push(model);
    }
  }
}

export async function fetchQwenModels(
  apiKey?: string,
  baseUrl = getOpenAICompatibleBaseUrl('qwen'),
): Promise<ModelConfig[]> {
  const headers: Record<string, string> = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {};
  const url = new URL('/api/v1/models', baseUrl);
  url.searchParams.set('page_size', String(QWEN_MODEL_PAGE_SIZE));
  url.searchParams.set('capabilities', 'TG');
  const signal = AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS);
  const models: ModelConfig[] = [];
  const seenIds = new Set<string>();
  let page = 1;
  let total = Infinity;
  while (seenIds.size < total) {
    url.searchParams.set('page_no', String(page));
    const response = await fetch(url, { headers, signal });
    if (!response.ok) {
      throw Object.assign(
        new Error(`Qwen models request failed (${String(response.status)})`),
        { status: response.status },
      );
    }
    const result = parseQwenModelPage(await response.json());
    total = result.total;
    const previousCount = seenIds.size;
    appendQwenModels(result.models, seenIds, models);
    if (seenIds.size < total && seenIds.size === previousCount) {
      throw new Error('Qwen returned an empty or repeated model page');
    }
    page += 1;
  }
  models.sort((a, b) => a.alias.localeCompare(b.alias));
  return models;
}

export const DEEPSEEK_MODELS: ModelConfig[] = [];

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

export function getAnthropicModelMaxTokens(
  modelId?: string,
): number | undefined {
  const resolvedModelId =
    modelId && modelId.length > 0 ? modelId : DEFAULT_MODELS.anthropic;
  return (
    ANTHROPIC_MODELS.find(({ id }) => id === resolvedModelId)?.max_tokens ??
    DEFAULT_ANTHROPIC_MAX_TOKENS
  );
}
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

export const OLLAMA_DEFAULT_HOST = 'http://127.0.0.1:11434';
