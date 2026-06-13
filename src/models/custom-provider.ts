export type CustomProviderApiFormat = 'openai' | 'anthropic';

export interface CustomProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiFormat: CustomProviderApiFormat;
  maxTokens?: number;
}

export const CUSTOM_PROVIDERS_STATE_KEY = 'CUSTOM_PROVIDERS';
export const CUSTOM_PROVIDER_PREFIX = 'custom:';
export const DEFAULT_CUSTOM_PROVIDER_API_FORMAT: CustomProviderApiFormat =
  'openai';

export function normalizeCustomProviderApiFormat(
  value: unknown,
): CustomProviderApiFormat {
  return value === 'anthropic' ? 'anthropic' : 'openai';
}

export function normalizeCustomProviderConfig(
  value: Omit<CustomProviderConfig, 'apiFormat'> & {
    apiFormat?: unknown;
  },
): CustomProviderConfig {
  const apiFormat = normalizeCustomProviderApiFormat(value.apiFormat);
  const maxTokens =
    apiFormat === 'anthropic' &&
    typeof value.maxTokens === 'number' &&
    Number.isInteger(value.maxTokens) &&
    value.maxTokens > 0
      ? value.maxTokens
      : undefined;
  return {
    id: value.id,
    name: value.name,
    baseUrl: value.baseUrl,
    apiFormat,
    ...(maxTokens === undefined ? {} : { maxTokens }),
  };
}

export function normalizeCustomProviders(value: unknown): {
  providers: CustomProviderConfig[];
  changed: boolean;
} {
  if (!Array.isArray(value)) {
    return { providers: [], changed: value !== undefined };
  }

  let changed = false;
  const providers = value
    .filter(
      (
        item,
      ): item is Omit<CustomProviderConfig, 'apiFormat'> & {
        apiFormat?: unknown;
      } => typeof item === 'object' && item !== null,
    )
    .map((item) => {
      const normalized = normalizeCustomProviderConfig(item);
      if (
        normalized.apiFormat !== item.apiFormat ||
        normalized.maxTokens !== item.maxTokens
      ) {
        changed = true;
      }
      return normalized;
    });

  if (providers.length !== value.length) {
    changed = true;
  }

  return { providers, changed };
}

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
