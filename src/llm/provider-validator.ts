import { getMainViewText } from '../i18n';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import { OLLAMA_DEFAULT_HOST, fetchQwenModels } from '../models/catalog';
import type { CustomProviderApiFormat } from '../models/custom-provider';

import { APIProvider, getOpenAICompatibleBaseUrl } from './provider-registry';
import {
  anthropicClientOptions,
  googleClientOptions,
  isQwenBaseUrl,
  MODEL_REQUEST_TIMEOUT_MS,
} from './sdk-options';

const badRequestStatus = 400;
const unauthorizedStatus = 401;
const forbiddenStatus = 403;
const tooManyRequestsStatus = 429;

export interface ProviderValidationResult {
  valid: boolean;
  error?: string;
}

export class ProviderValidator {
  constructor(private readonly getLanguage: () => EffectiveDisplayLanguage) {}

  private mapError(
    error: unknown,
    rules: {
      invalidStatusCodes: number[];
      invalidMessagePatterns?: string[];
      quotaStatusCodes?: number[];
      quotaMessagePatterns?: string[];
    },
  ): { valid: false; error: string } {
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? (error as { status?: number }).status
        : undefined;
    const message =
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : String(error);
    const includes = (patterns?: string[]) => {
      const normalized = message.toLowerCase();
      return (
        patterns?.some((pattern) =>
          normalized.includes(pattern.toLowerCase()),
        ) ?? false
      );
    };
    const text = getMainViewText(this.getLanguage());

    if (
      (typeof status === 'number' &&
        rules.invalidStatusCodes.includes(status)) ||
      includes(rules.invalidMessagePatterns)
    ) {
      return { valid: false, error: text.invalidApiKeyPrefix };
    }

    if (
      (typeof status === 'number' &&
        (rules.quotaStatusCodes ?? [tooManyRequestsStatus]).includes(status)) ||
      includes(rules.quotaMessagePatterns)
    ) {
      return { valid: false, error: text.quotaExceededPrefix };
    }

    return {
      valid: false,
      error:
        typeof status === 'number'
          ? `${text.apiRequestFailedPrefix} (${String(status)})`
          : text.connectionErrorPrefix,
    };
  }

  async validateCustomProvider(
    apiKey: string,
    baseUrl: string,
    apiFormat: CustomProviderApiFormat = 'openai',
  ): Promise<ProviderValidationResult> {
    try {
      if (apiFormat !== 'anthropic' && isQwenBaseUrl(baseUrl)) {
        await fetchQwenModels(apiKey, baseUrl);
        return { valid: true };
      }
      if (apiFormat === 'anthropic') {
        const anthropicClientClass = (await import('@anthropic-ai/sdk'))
          .default;
        await new anthropicClientClass({
          ...anthropicClientOptions(apiKey, baseUrl),
          timeout: MODEL_REQUEST_TIMEOUT_MS,
        }).models.list({ limit: 1 });
        return { valid: true };
      }
      const openAIClientClass = (await import('openai')).default;
      const client = new openAIClientClass({
        apiKey,
        baseURL: baseUrl,
        timeout: MODEL_REQUEST_TIMEOUT_MS,
        maxRetries: 0,
      });
      await client.models.list();
      return { valid: true };
    } catch (error) {
      return this.mapError(error, {
        invalidStatusCodes: [unauthorizedStatus, forbiddenStatus],
        invalidMessagePatterns: ['Invalid API Key', 'Unauthorized'],
      });
    }
  }

  async validate(
    provider: APIProvider,
    apiKey: string,
  ): Promise<ProviderValidationResult> {
    if (provider === 'ollama') {
      return this.validateOllama(apiKey);
    }
    if (provider === 'openrouter') {
      return this.validateOpenRouter(apiKey);
    }
    if (provider === 'qwen') {
      try {
        await fetchQwenModels(apiKey);
        return { valid: true };
      } catch (error) {
        return this.mapError(error, {
          invalidStatusCodes: [unauthorizedStatus, forbiddenStatus],
        });
      }
    }
    const compatibleBaseUrl = getOpenAICompatibleBaseUrl(provider);
    if (compatibleBaseUrl) {
      return this.validateCustomProvider(apiKey, compatibleBaseUrl, 'openai');
    }

    switch (provider) {
      case 'google':
        return this.validateGoogle(apiKey);
      case 'openai':
        return this.validateOpenAI(apiKey);
      case 'anthropic':
        return this.validateAnthropic(apiKey);
      default:
        return {
          valid: false,
          error: getMainViewText(this.getLanguage()).unknownProvider,
        };
    }
  }

  private async validateOllama(
    host: string,
  ): Promise<ProviderValidationResult> {
    const text = getMainViewText(this.getLanguage());
    const hostUrl = host || OLLAMA_DEFAULT_HOST;
    try {
      const response = await fetch(`${hostUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS),
      });
      return response.ok
        ? { valid: true }
        : { valid: false, error: text.cannotConnectOllamaAt(hostUrl) };
    } catch (error) {
      return {
        valid: false,
        error: text.cannotConnectOllama(
          error instanceof Error ? error.message : String(error),
        ),
      };
    }
  }

  private async validateOpenRouter(
    apiKey: string,
  ): Promise<ProviderValidationResult> {
    const rules = {
      invalidStatusCodes: [unauthorizedStatus, forbiddenStatus],
      invalidMessagePatterns: ['invalid', 'unauthorized', 'forbidden'],
    };
    try {
      const response = await fetch('https://openrouter.ai/api/v1/key', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS),
      });
      if (response.ok) {
        return { valid: true };
      }
      let message = '';
      try {
        message = await response.text();
      } catch {
        message = response.statusText;
      }
      return this.mapError({ status: response.status, message }, rules);
    } catch (error) {
      return this.mapError(error, rules);
    }
  }

  private async validateGoogle(
    apiKey: string,
  ): Promise<ProviderValidationResult> {
    try {
      const { GoogleGenAI: googleGenAIClientClass } =
        await import('@google/genai');
      const client = new googleGenAIClientClass(
        googleClientOptions(apiKey, MODEL_REQUEST_TIMEOUT_MS),
      );
      await client.models.list({ config: { pageSize: 1 } });
      return { valid: true };
    } catch (error) {
      return this.mapError(error, {
        invalidStatusCodes: [
          badRequestStatus,
          unauthorizedStatus,
          forbiddenStatus,
        ],
        invalidMessagePatterns: ['API key not valid', 'PERMISSION_DENIED'],
        quotaMessagePatterns: ['RESOURCE_EXHAUSTED', 'quota'],
      });
    }
  }

  private async validateOpenAI(
    apiKey: string,
  ): Promise<ProviderValidationResult> {
    try {
      const openAIClientClass = (await import('openai')).default;
      await new openAIClientClass({
        apiKey,
        timeout: MODEL_REQUEST_TIMEOUT_MS,
        maxRetries: 0,
      }).models.list();
      return { valid: true };
    } catch (error) {
      return this.mapError(error, {
        invalidStatusCodes: [unauthorizedStatus, forbiddenStatus],
        invalidMessagePatterns: ['Invalid API Key'],
      });
    }
  }

  private async validateAnthropic(
    apiKey: string,
  ): Promise<ProviderValidationResult> {
    try {
      const anthropicClientClass = (await import('@anthropic-ai/sdk')).default;
      await new anthropicClientClass({
        ...anthropicClientOptions(apiKey),
        timeout: MODEL_REQUEST_TIMEOUT_MS,
      }).models.list({ limit: 1 });
      return { valid: true };
    } catch (error) {
      return this.mapError(error, {
        invalidStatusCodes: [unauthorizedStatus, forbiddenStatus],
        invalidMessagePatterns: ['invalid_api_key'],
        quotaMessagePatterns: ['rate_limit'],
      });
    }
  }
}
