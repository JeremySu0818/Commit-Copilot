import type { ModelConfig } from '../models/catalog';
import type { CustomProviderConfig } from '../models/custom-provider';
import type {
  CommitOutputOptions,
  GenerateMode,
  HybridGenerationOptions,
} from '../models/options';

export type UnknownRecord = Record<string, unknown>;

export type WebviewToExtensionMessageType =
  | 'addCustomModel'
  | 'cancelGenerate'
  | 'checkGenerationStatus'
  | 'checkGit'
  | 'checkKey'
  | 'checkValidationStatus'
  | 'deleteCustomModel'
  | 'deleteCustomProvider'
  | 'generate'
  | 'getAllKeys'
  | 'getCommitMessageLanguage'
  | 'getCommitOutputOptions'
  | 'getCustomModels'
  | 'getCustomProviders'
  | 'getDisplayLanguage'
  | 'getGenerateMode'
  | 'getHybridGenerationOptions'
  | 'getMaxAgentSteps'
  | 'getModels'
  | 'getProvider'
  | 'saveCommitMessageLanguage'
  | 'saveCommitOutputOptions'
  | 'saveCustomProvider'
  | 'saveCustomProviderMaxTokens'
  | 'saveDisplayLanguage'
  | 'saveGenerateMode'
  | 'saveHybridGenerationOptions'
  | 'saveKey'
  | 'saveMaxAgentSteps'
  | 'saveModel'
  | 'saveProvider'
  | 'setCurrentScreen'
  | 'showUpdateNotes'
  | 'showWarning';

export interface IncomingMessage extends UnknownRecord {
  type: WebviewToExtensionMessageType;
}

export interface ProviderMessage extends IncomingMessage {
  provider?: unknown;
}

export interface ValueMessage extends IncomingMessage {
  value?: unknown;
}

export interface SaveKeyMessage extends ProviderMessage {
  type: 'saveKey';
  value?: unknown;
  baseUrl?: unknown;
}

export interface SaveCustomProviderMessage extends IncomingMessage {
  type: 'saveCustomProvider';
  id?: unknown;
  name?: unknown;
  baseUrl?: unknown;
  apiFormat?: unknown;
  maxTokens?: unknown;
  apiKey?: unknown;
}

export interface SaveCustomProviderMaxTokensMessage extends ProviderMessage {
  type: 'saveCustomProviderMaxTokens';
  maxTokens?: unknown;
}

export interface DeleteCustomProviderMessage extends ProviderMessage {
  type: 'deleteCustomProvider';
}

export interface CustomModelMessage extends ProviderMessage {
  modelId?: unknown;
  modelName?: unknown;
}

export interface GenerateMessage extends IncomingMessage {
  type: 'generate';
  generateMode?: GenerateMode;
  commitOutputOptions?: CommitOutputOptions;
  hybridGenerationOptions?: HybridGenerationOptions;
}

export type ExtensionToWebviewMessageType =
  | 'allKeyStatuses'
  | 'commitMessageLanguageUpdated'
  | 'currentCommitOutputOptions'
  | 'currentGenerateMode'
  | 'currentHybridGenerationOptions'
  | 'currentMaxAgentSteps'
  | 'currentProvider'
  | 'customModelAddFailed'
  | 'customModelAdded'
  | 'customModelDeleted'
  | 'customModelsList'
  | 'customProviderDeleted'
  | 'customProviderSaveFailed'
  | 'customProviderSaved'
  | 'customProvidersLoaded'
  | 'displayLanguageUpdated'
  | 'generationDone'
  | 'generationStatusUpdate'
  | 'keyStatus'
  | 'modelsList'
  | 'openAboutView'
  | 'openSettingsView'
  | 'repoUpdate'
  | 'validating'
  | 'validationResult'
  | 'validationStatusUpdate';

export interface ExtensionToWebviewMessage extends UnknownRecord {
  type: ExtensionToWebviewMessageType;
}

export interface ModelsListMessage extends ExtensionToWebviewMessage {
  type: 'modelsList';
  models: ModelConfig[];
  currentModel: string;
  provider: string;
  allowCustomModel?: boolean;
}

export interface CustomProvidersLoadedMessage extends ExtensionToWebviewMessage {
  type: 'customProvidersLoaded';
  customProviders: CustomProviderConfig[];
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

export function asIncomingMessage(data: unknown): IncomingMessage | null {
  if (!isRecord(data) || typeof data.type !== 'string') {
    return null;
  }
  return data as IncomingMessage;
}

export function asExtensionMessage(
  data: unknown,
): ExtensionToWebviewMessage | null {
  if (!isRecord(data) || typeof data.type !== 'string') {
    return null;
  }
  return data as ExtensionToWebviewMessage;
}
