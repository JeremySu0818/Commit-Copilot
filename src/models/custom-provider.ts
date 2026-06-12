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
