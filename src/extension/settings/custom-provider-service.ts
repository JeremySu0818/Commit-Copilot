import type * as vscode from 'vscode';

import {
  CUSTOM_PROVIDERS_STATE_KEY,
  CustomProviderConfig,
  getCustomProviderModelsStorageKey,
  getCustomProviderStorageKey,
  normalizeCustomProviders,
} from '../../models/custom-provider';

export class CustomProviderService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getProviders(): CustomProviderConfig[] {
    return normalizeCustomProviders(
      this.context.globalState.get<unknown>(CUSTOM_PROVIDERS_STATE_KEY),
    ).providers;
  }

  async migrateProviders(): Promise<CustomProviderConfig[]> {
    const { providers, changed } = normalizeCustomProviders(
      this.context.globalState.get<unknown>(CUSTOM_PROVIDERS_STATE_KEY),
    );
    if (changed) {
      await this.saveProviders(providers);
    }
    return providers;
  }

  saveProviders(providers: CustomProviderConfig[]): Thenable<void> {
    return this.context.globalState.update(
      CUSTOM_PROVIDERS_STATE_KEY,
      providers,
    );
  }

  getModelStorageKey(providerId: string): string {
    return `CUSTOM_${providerId}_MODEL`;
  }

  getSavedModel(providerId: string): string {
    return (
      this.context.globalState.get<string>(
        this.getModelStorageKey(providerId),
      ) ?? ''
    );
  }

  getApiKey(providerId: string): Thenable<string | undefined> {
    return this.context.secrets.get(getCustomProviderStorageKey(providerId));
  }

  storeApiKey(providerId: string, apiKey: string): Thenable<void> {
    return this.context.secrets.store(
      getCustomProviderStorageKey(providerId),
      apiKey,
    );
  }

  async delete(providerId: string): Promise<void> {
    await this.context.secrets.delete(getCustomProviderStorageKey(providerId));
    await this.context.globalState.update(
      this.getModelStorageKey(providerId),
      undefined,
    );
    await this.context.globalState.update(
      getCustomProviderModelsStorageKey(providerId),
      undefined,
    );
  }
}
