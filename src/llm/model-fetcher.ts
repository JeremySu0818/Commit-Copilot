import type * as vscode from 'vscode';

import {
  MODELS_BY_PROVIDER,
  ModelConfig,
  OLLAMA_DEFAULT_HOST,
  fetchOpenRouterModels,
  fetchQwenModels,
} from '../models/catalog';
import {
  CUSTOM_PROVIDER_PREFIX,
  CustomProviderConfig,
  getCustomProviderModelsStorageKey,
} from '../models/custom-provider';

import type { APIProvider } from './provider-registry';

const LEGACY_OLLAMA_BUILTIN_MODEL_IDS = new Set([
  'gemma3:1b',
  'gemma3:4b',
  'gemma3:12b',
  'gemma3:27b',
  'gpt-oss:20b',
  'gpt-oss:120b',
  'llama3.3:8b',
  'llama3.3:70b',
  'phi4:14b',
  'mistral:7b',
]);

type PostMessage = (message: Record<string, unknown>) => void;

interface CustomProviderReader {
  getProviders(): CustomProviderConfig[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toOllamaModelConfig(value: unknown): ModelConfig | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = asString(value.name);
  const model = asString(value.model);
  const id = name && name.length > 0 ? name : model;
  return id ? { id, alias: id } : null;
}

export class ModelFetcher {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly customProviders: CustomProviderReader,
    private readonly postMessage: PostMessage,
  ) {}

  getBuiltInProviderModelStorageKey(provider: APIProvider): string {
    return `${provider.toUpperCase()}_MODEL`;
  }

  getBuiltInProviderModelsStorageKey(provider: APIProvider): string {
    return `${provider.toUpperCase()}_MODELS`;
  }

  async getSanitizedOllamaManualModels(): Promise<ModelConfig[]> {
    const storageKey = this.getBuiltInProviderModelsStorageKey('ollama');
    const raw = this.context.globalState.get<unknown>(storageKey);
    const source = Array.isArray(raw) ? raw : [];
    const seenIds = new Set<string>();
    const sanitized: ModelConfig[] = [];

    for (const item of source) {
      if (!isRecord(item)) {
        continue;
      }
      const id = asString(item.id)?.trim();
      if (!id || seenIds.has(id) || LEGACY_OLLAMA_BUILTIN_MODEL_IDS.has(id)) {
        continue;
      }
      sanitized.push({ id, alias: asString(item.alias)?.trim() ?? id });
      seenIds.add(id);
    }

    if (
      !Array.isArray(raw) ||
      source.length !== sanitized.length ||
      source.some((item, index) => {
        const model = sanitized[index];
        return (
          !isRecord(item) || item.id !== model.id || item.alias !== model.alias
        );
      })
    ) {
      await this.context.globalState.update(storageKey, sanitized);
    }
    return sanitized;
  }

  includeModelIfMissing(models: ModelConfig[], modelId: string): ModelConfig[] {
    if (!modelId || models.some((model) => model.id === modelId)) {
      return models;
    }
    return [...models, { id: modelId, alias: modelId }];
  }

  async fetchCustomProviderModels(
    apiKey: string,
    baseUrl: string | undefined,
    customId: string,
  ): Promise<ModelConfig[]> {
    const provider = this.customProviders
      .getProviders()
      .find((candidate) => candidate.id === customId);
    const resolvedBaseUrl = baseUrl ?? provider?.baseUrl ?? '';
    const storageKey = getCustomProviderModelsStorageKey(customId);
    const manualModels =
      this.context.globalState.get<ModelConfig[]>(storageKey) ?? [];

    const apiModels: ModelConfig[] = [];
    let fetchSuccess = false;
    try {
      const openAIClientClass = (await import('openai')).default;
      const response = await new openAIClientClass({
        apiKey,
        baseURL: resolvedBaseUrl,
      }).models.list();
      for await (const model of response) {
        if (model.id) {
          apiModels.push({ id: model.id, alias: model.id });
        }
      }
      apiModels.sort((a, b) => a.id.localeCompare(b.id));
      fetchSuccess = true;
    } catch (error) {
      console.error('Error fetching OpenAI-compatible provider models:', error);
    }

    if (!fetchSuccess) {
      return [...apiModels, ...manualModels];
    }

    const apiIds = new Set(apiModels.map((model) => model.id));
    const remainingManualModels = manualModels.filter(
      (model) => !apiIds.has(model.id),
    );
    if (remainingManualModels.length !== manualModels.length) {
      await this.context.globalState.update(storageKey, remainingManualModels);
      this.postMessage({
        type: 'customModelsList',
        customModels: remainingManualModels,
        provider: `${CUSTOM_PROVIDER_PREFIX}${customId}`,
      });
    }
    return [...apiModels, ...remainingManualModels];
  }

  async fetchOllamaModels(host: string | undefined): Promise<ModelConfig[]> {
    const manualModels = await this.getSanitizedOllamaManualModels();
    const resolvedHost =
      host && host.length > 0 ? host.trim() : OLLAMA_DEFAULT_HOST;
    let apiModels: ModelConfig[] = [];
    let fetchSuccess = false;
    try {
      const response = await fetch(`${resolvedHost}/api/tags`, {
        method: 'GET',
      });
      if (response.ok) {
        const payload = (await response.json()) as { models?: unknown[] };
        apiModels = (Array.isArray(payload.models) ? payload.models : [])
          .map(toOllamaModelConfig)
          .filter((model): model is ModelConfig => model !== null)
          .sort((a, b) => a.id.localeCompare(b.id));
        fetchSuccess = true;
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
    }

    if (!fetchSuccess) {
      return [...apiModels, ...manualModels];
    }

    const apiIds = new Set(apiModels.map((model) => model.id));
    const remainingManualModels = manualModels.filter(
      (model) => !apiIds.has(model.id),
    );
    if (remainingManualModels.length !== manualModels.length) {
      await this.context.globalState.update(
        this.getBuiltInProviderModelsStorageKey('ollama'),
        remainingManualModels,
      );
      this.postMessage({
        type: 'customModelsList',
        customModels: remainingManualModels,
        provider: 'ollama',
      });
    }
    return [...apiModels, ...remainingManualModels];
  }

  async getBuiltInProviderModels(
    provider: APIProvider,
    apiKey?: string,
  ): Promise<ModelConfig[]> {
    if (provider === 'openrouter') {
      try {
        return await fetchOpenRouterModels(apiKey);
      } catch {
        return [];
      }
    }
    if (provider === 'qwen') {
      try {
        return await fetchQwenModels(apiKey);
      } catch {
        return [];
      }
    }
    if (provider === 'ollama') {
      return this.fetchOllamaModels(apiKey);
    }
    return MODELS_BY_PROVIDER[provider];
  }

  includeBuiltInModelIfMissing(
    provider: APIProvider,
    models: ModelConfig[],
    modelId: string,
  ): ModelConfig[] {
    return provider === 'openrouter' || provider === 'qwen'
      ? models
      : this.includeModelIfMissing(models, modelId);
  }
}
