import type { WebviewLanguagePack } from '../../i18n';
import { fillTemplate } from '../utils';

export function getApiKeyPlaceholder({
  isOllama,
  isCustom,
  currentProvider,
  pack,
  ollamaDefaultHost,
}: Readonly<{
  isOllama: boolean;
  isCustom: boolean;
  currentProvider: string;
  pack: WebviewLanguagePack;
  ollamaDefaultHost: string;
}>) {
  if (isOllama) return ollamaDefaultHost;
  if (isCustom) return pack.placeholders.enterCustomApiKey;

  const providerPlaceholders: Record<string, string> = {
    google: pack.placeholders.enterGeminiApiKey,
    openai: pack.placeholders.enterOpenAIApiKey,
    anthropic: pack.placeholders.enterAnthropicApiKey,
  };
  return providerPlaceholders[currentProvider] ?? pack.placeholders.enterApiKey;
}

export function getProviderInfoHtml({
  isOllama,
  isCustom,
  currentProvider,
  pack,
  ollamaDefaultHost,
}: Readonly<{
  isOllama: boolean;
  isCustom: boolean;
  currentProvider: string;
  pack: WebviewLanguagePack;
  ollamaDefaultHost: string;
}>) {
  if (isOllama) {
    return fillTemplate(pack.descriptions.ollamaInfo, {
      host: ollamaDefaultHost,
    });
  }
  if (isCustom) return '';

  const providerDescriptions: Record<string, string> = {
    google: pack.descriptions.googleInfo,
    openai: pack.descriptions.openaiInfo,
    anthropic: pack.descriptions.anthropicInfo,
  };
  return providerDescriptions[currentProvider] ?? '';
}

export function getGenerateBtnTitle({
  isGenerating,
  pendingStatusCheck,
  hasChanges,
  pack,
}: Readonly<{
  isGenerating: boolean;
  pendingStatusCheck: boolean;
  hasChanges: boolean;
  pack: WebviewLanguagePack;
}>) {
  if (isGenerating) return pack.statuses.cancelCurrentGeneration;
  if (!pendingStatusCheck && !hasChanges)
    return pack.statuses.noChangesDetected;
  return '';
}

export function getRewriteBtnTitle({
  isGenerating,
  isApiKeyMissing,
  apiKeyPlaceholder,
  isCustomModelMissing,
  pack,
}: Readonly<{
  isGenerating: boolean;
  isApiKeyMissing: boolean;
  apiKeyPlaceholder: string;
  isCustomModelMissing: boolean;
  pack: WebviewLanguagePack;
}>) {
  if (isGenerating) return pack.statuses.cancelCurrentGeneration;
  if (isApiKeyMissing) return apiKeyPlaceholder;
  if (isCustomModelMissing) return pack.statuses.modelNameRequired;
  return '';
}
