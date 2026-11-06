import {
  APIProvider,
  getOpenAICompatibleBaseUrl,
} from '../llm/provider-registry';
import { ANTHROPIC_API_VERSION, GOOGLE_API_VERSION } from '../llm/sdk-options';

import {
  ANTHROPIC_MODELS,
  ModelConfig,
  OLLAMA_DEFAULT_HOST,
  fetchOpenRouterModels,
  fetchQwenModels,
} from './catalog';
import { getModelAlias } from './model-alias';

type RemoteModel = Record<string, unknown>;
const MODEL_FETCH_TIMEOUT_MS = 15000;

function isRecord(value: unknown): value is RemoteModel {
  return typeof value === 'object' && value !== null;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function supportsText(provider: APIProvider, model: RemoteModel): boolean {
  const id = String(model.id ?? model.name).toLowerCase();
  if (model.lifecycle === 'retired' || model.lifecycle === 'deprecated') {
    return false;
  }
  if (provider === 'google') {
    return (
      Array.isArray(model.supportedGenerationMethods) &&
      model.supportedGenerationMethods.includes('generateContent') &&
      !/image|tts|audio|robotics/.test(id)
    );
  }
  if (model.active === false) {
    return false;
  }
  if (Array.isArray(model.output_modalities)) {
    return model.output_modalities.includes('text');
  }
  if (
    /embedding|whisper|tts|audio|realtime|image|dall-e|moderation|transcri|sora|guard/.test(
      id,
    )
  ) {
    return false;
  }
  return provider !== 'openai' || /^(gpt-|chatgpt-|chat-|o\d|ft:)/.test(id);
}

function getRequest(
  provider: APIProvider,
  apiKey: string,
): {
  url: URL;
  headers: Record<string, string>;
} {
  if (provider === 'google') {
    return {
      url: new URL(
        `https://generativelanguage.googleapis.com/${GOOGLE_API_VERSION}/models`,
      ),
      headers: { 'x-goog-api-key': apiKey },
    };
  }
  if (provider === 'anthropic') {
    return {
      url: new URL('https://api.anthropic.com/v1/models'),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
    };
  }
  const base =
    getOpenAICompatibleBaseUrl(provider) ?? 'https://api.openai.com/v1';
  return {
    url: new URL(`${base}/models`),
    headers: { Authorization: `Bearer ${apiKey}` },
  };
}

function toModel(provider: APIProvider, item: unknown): ModelConfig | null {
  if (!isRecord(item) || !supportsText(provider, item)) {
    return null;
  }
  const rawId = provider === 'google' ? item.name : item.id;
  if (typeof rawId !== 'string' || !rawId.trim()) {
    return null;
  }
  const id = rawId.replace(/^models\//, '');
  const fallbackName = provider === 'google' ? undefined : item.name;
  const name = item.display_name ?? item.displayName ?? fallbackName;
  const maxTokens = positiveNumber(
    item.max_tokens ??
      item.max_output_tokens ??
      item.outputTokenLimit ??
      item.max_completion_tokens,
  );
  return {
    id,
    alias: getModelAlias(id, name),
    ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
  };
}

function nextCursor(
  provider: APIProvider,
  payload: RemoteModel,
): string | undefined {
  let cursor: unknown;
  if (provider === 'google') {
    cursor = payload.nextPageToken;
  } else if (provider === 'anthropic' && payload.has_more === true) {
    cursor = payload.last_id;
    if (typeof cursor !== 'string' || !cursor) {
      throw new Error('Anthropic returned an invalid pagination cursor');
    }
  }
  return typeof cursor === 'string' && cursor ? cursor : undefined;
}

async function fetchModelPage(
  provider: APIProvider,
  url: URL,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<{ models: ModelConfig[]; cursor?: string }> {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    throw new Error(
      `${provider} models request failed (${String(response.status)})`,
    );
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new Error(`${provider} returned an invalid model list`);
  }
  const items = payload[provider === 'google' ? 'models' : 'data'];
  if (!Array.isArray(items)) {
    throw new Error(`${provider} returned an invalid model list`);
  }
  return {
    models: items
      .map((item: unknown) => toModel(provider, item))
      .filter((model): model is ModelConfig => model !== null),
    cursor: nextCursor(provider, payload),
  };
}

async function fetchRemoteModels(
  provider: APIProvider,
  apiKey: string,
): Promise<ModelConfig[]> {
  const { url, headers } = getRequest(provider, apiKey);
  const models = new Map<string, ModelConfig>();
  const cursors = new Set<string>();
  const signal = AbortSignal.timeout(MODEL_FETCH_TIMEOUT_MS);
  let cursor: string | undefined;
  do {
    const page = await fetchModelPage(provider, url, headers, signal);
    for (const model of page.models) {
      models.set(model.id, model);
    }
    cursor = page.cursor;
    if (cursor) {
      if (cursors.has(cursor)) {
        throw new Error(`${provider} returned a repeated pagination cursor`);
      }
      cursors.add(cursor);
      url.searchParams.set(
        provider === 'google' ? 'pageToken' : 'after_id',
        cursor,
      );
    }
  } while (cursor);
  const result = [...models.values()].sort((a, b) =>
    a.alias.localeCompare(b.alias),
  );
  if (provider === 'anthropic') {
    ANTHROPIC_MODELS.splice(0, ANTHROPIC_MODELS.length, ...result);
  }
  return result;
}

async function fetchOllamaModels(
  host = OLLAMA_DEFAULT_HOST,
): Promise<ModelConfig[]> {
  const response = await fetch(`${host}/api/tags`, {
    signal: AbortSignal.timeout(MODEL_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `Ollama models request failed (${String(response.status)})`,
    );
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.models)) {
    throw new Error('Ollama returned an invalid model list');
  }
  return payload.models
    .filter(isRecord)
    .flatMap((item) => {
      const id = item.name ?? item.model;
      return typeof id === 'string' && id
        ? [{ id, alias: getModelAlias(id) }]
        : [];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function fetchProviderModels(
  provider: APIProvider,
  apiKey?: string,
): Promise<ModelConfig[]> {
  if (provider === 'openrouter') {
    return fetchOpenRouterModels(apiKey);
  }
  if (provider === 'qwen') {
    return fetchQwenModels(apiKey);
  }
  if (provider === 'ollama') {
    return fetchOllamaModels(
      apiKey?.trim() ? apiKey.trim() : OLLAMA_DEFAULT_HOST,
    );
  }
  return apiKey ? fetchRemoteModels(provider, apiKey) : [];
}
