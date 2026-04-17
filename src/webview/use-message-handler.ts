import { useEffect } from 'react';

import type { DisplayLanguage, EffectiveDisplayLanguage } from '../i18n';
import type {
  CommitOutputOptions,
  CustomProviderConfig,
  ModelConfig,
} from '../models';
import type { WebviewBootstrapData } from '../side-panel-webview-bootstrap';

import type { SidePanelAction, SidePanelState } from './side-panel-context';
import {
  renderStatusHtml,
  normalizeGenerateMode,
  normalizeMaxAgentStepsValue,
  normalizeOllamaHostValue,
} from './utils';

type UnknownRecord = Record<string, unknown>;

interface MessagePayload extends UnknownRecord {
  type: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toMessagePayload(value: unknown): MessagePayload | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }
  return value as MessagePayload;
}

function toString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function toBooleanRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: Record<string, boolean> = {};
  for (const [provider, hasKey] of Object.entries(value)) {
    normalized[provider] = Boolean(hasKey);
  }
  return normalized;
}

function isModelConfig(value: unknown): value is ModelConfig {
  if (!isRecord(value)) {
    return false;
  }

  const maxTokens = value.max_tokens;
  return (
    typeof value.id === 'string' &&
    typeof value.alias === 'string' &&
    (maxTokens === undefined || typeof maxTokens === 'number')
  );
}

function toModelConfigArray(value: unknown): ModelConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is ModelConfig => isModelConfig(item));
}

function isCustomProviderConfig(value: unknown): value is CustomProviderConfig {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.baseUrl === 'string'
  );
}

function toCustomProviderArray(value: unknown): CustomProviderConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is CustomProviderConfig =>
    isCustomProviderConfig(item),
  );
}

function isDefaultModelProvider(
  provider: string,
  bootstrap: WebviewBootstrapData,
): provider is keyof WebviewBootstrapData['defaultModels'] {
  return provider in bootstrap.defaultModels;
}

function chooseModel(
  models: ModelConfig[],
  currentModel: string,
  activeProvider: string,
  bootstrap: WebviewBootstrapData,
): string {
  if (models.some((model) => model.id === currentModel)) {
    return currentModel;
  }
  if (models.length === 0) {
    return currentModel;
  }

  const fallbackModel = models[0];

  const preferredDefaultId = isDefaultModelProvider(activeProvider, bootstrap)
    ? bootstrap.defaultModels[activeProvider]
    : undefined;
  const preferredModel =
    models.find((model) => model.id === preferredDefaultId) ?? fallbackModel;
  return preferredModel.id;
}

function isDisplayLanguage(
  value: string,
  bootstrap: WebviewBootstrapData,
): value is DisplayLanguage {
  return bootstrap.displayLanguageOptions.some(
    (option) => option.value === value,
  );
}

function isEffectiveDisplayLanguage(
  value: string,
  bootstrap: WebviewBootstrapData,
): value is EffectiveDisplayLanguage {
  return value in bootstrap.languagePacks;
}

function normalizeCommitOutputOptions(
  value: unknown,
  defaults: CommitOutputOptions,
): CommitOutputOptions {
  const options = isRecord(value) ? value : {};
  return {
    includeScope:
      typeof options.includeScope === 'boolean'
        ? options.includeScope
        : defaults.includeScope,
    includeBody:
      typeof options.includeBody === 'boolean'
        ? options.includeBody
        : defaults.includeBody,
    includeFooter:
      typeof options.includeFooter === 'boolean'
        ? options.includeFooter
        : defaults.includeFooter,
  };
}

export function useMessageHandler(
  vscode: VSCodeWebviewApi,
  bootstrap: WebviewBootstrapData,
  state: SidePanelState,
  dispatch: React.Dispatch<SidePanelAction>,
): void {
  useEffect(() => {
    vscode.postMessage({ type: 'getProvider' });
    vscode.postMessage({ type: 'getCustomProviders' });
    vscode.postMessage({ type: 'getGenerateMode' });
    vscode.postMessage({ type: 'getCommitOutputOptions' });
    vscode.postMessage({ type: 'getMaxAgentSteps' });
    vscode.postMessage({ type: 'checkGit' });
    vscode.postMessage({ type: 'getAllKeys' });
    vscode.postMessage({ type: 'checkGenerationStatus' });
    vscode.postMessage({ type: 'checkValidationStatus' });
    vscode.postMessage({ type: 'getDisplayLanguage' });
    const effectiveScreen =
      bootstrap.initialScreen === 'settings' ? 'settings' : 'main';
    vscode.postMessage({ type: 'setCurrentScreen', value: effectiveScreen });
  }, [vscode, bootstrap]);

  useEffect(() => {
    const setModelStateToLocked = (saveButtonDisabled: boolean) => {
      dispatch({
        type: 'SET_SAVE_BTN',
        disabled: saveButtonDisabled,
        text: state.currentPack.buttons.save,
      });
      dispatch({
        type: 'SET_KEY_STATUS_HTML',
        html: renderStatusHtml(
          'warning',
          state.currentPack.statuses.checkingStatus,
        ),
      });
      dispatch({
        type: 'SET_MODEL_STATE',
        state: {
          models: [],
          currentModel: '',
          allowCustomModel: false,
          customModelValue: '',
          disabled: true,
        },
      });
    };

    const handlers: Partial<Record<string, (message: MessagePayload) => void>> =
      {
        currentProvider: (message) => {
          const provider = toString(message.provider) ?? state.currentProvider;
          dispatch({ type: 'SET_PROVIDER', provider });
          vscode.postMessage({ type: 'checkKey', provider });
          vscode.postMessage({ type: 'getModels', provider });
        },
        repoUpdate: (message) => {
          dispatch({
            type: 'SET_HAS_CHANGES',
            value: toBoolean(message.hasChanges) ?? false,
          });
        },
        keyStatus: (message) => {
          const provider = toString(message.provider) ?? state.currentProvider;
          const hasKey = toBoolean(message.hasKey) ?? false;
          const rawValue = toString(message.value);

          if (
            provider === 'ollama' &&
            state.currentProvider === 'ollama' &&
            typeof rawValue === 'string'
          ) {
            const host = normalizeOllamaHostValue(
              rawValue,
              bootstrap.ollamaDefaultHost,
            );
            dispatch({ type: 'SET_OLLAMA_HOST', host });
            dispatch({ type: 'SET_API_KEY_VALUE', value: host });
          }

          dispatch({ type: 'SET_KEY_STATUS', provider, hasKey });
          if (provider !== state.currentProvider) {
            return;
          }

          if (hasKey) {
            dispatch({
              type: 'SET_KEY_STATUS_HTML',
              html: renderStatusHtml(
                'success',
                state.currentPack.statuses.configured,
              ),
            });
            dispatch({
              type: 'SET_MODEL_STATE',
              state: { ...state.modelState, disabled: false },
            });
            return;
          }

          dispatch({
            type: 'SET_KEY_STATUS_HTML',
            html: renderStatusHtml(
              'error',
              state.currentPack.statuses.notConfigured,
            ),
          });
          if (provider !== 'ollama') {
            dispatch({
              type: 'SET_MODEL_STATE',
              state: { ...state.modelState, disabled: true },
            });
          }
        },
        allKeyStatuses: (message) => {
          const normalized = toBooleanRecord(message.statuses);
          dispatch({ type: 'SET_ALL_KEY_STATUSES', statuses: normalized });
          if (typeof normalized[state.currentProvider] !== 'boolean') {
            return;
          }
          const hasKey = normalized[state.currentProvider];
          dispatch({
            type: 'SET_KEY_STATUS_HTML',
            html: hasKey
              ? renderStatusHtml(
                  'success',
                  state.currentPack.statuses.configured,
                )
              : renderStatusHtml(
                  'error',
                  state.currentPack.statuses.notConfigured,
                ),
          });
        },
        currentGenerateMode: (message) => {
          const mode = normalizeGenerateMode(message.generateMode);
          dispatch({ type: 'SET_PREFERRED_GENERATE_MODE', mode });
          dispatch({ type: 'SET_GENERATE_MODE', mode });
        },
        currentCommitOutputOptions: (message) => {
          dispatch({
            type: 'SET_COMMIT_OUTPUT_OPTIONS',
            options: normalizeCommitOutputOptions(
              message.commitOutputOptions,
              bootstrap.defaultCommitOutputOptions,
            ),
          });
        },
        modelsList: (message) => {
          const messageProvider = toString(message.provider);
          if (messageProvider && messageProvider !== state.currentProvider) {
            return;
          }

          const activeProvider = messageProvider ?? state.currentProvider;
          const currentModel = toString(message.currentModel) ?? '';
          const allowCustomModel = toBoolean(message.allowCustomModel) ?? false;
          if (allowCustomModel) {
            dispatch({
              type: 'SET_MODEL_STATE',
              state: {
                models: [],
                currentModel,
                allowCustomModel: true,
                customModelValue: currentModel,
                disabled: false,
              },
            });
            return;
          }

          const models = toModelConfigArray(message.models);
          const selectedModel = chooseModel(
            models,
            currentModel,
            activeProvider,
            bootstrap,
          );
          if (selectedModel !== currentModel && selectedModel) {
            vscode.postMessage({
              type: 'saveModel',
              value: selectedModel,
              provider: activeProvider,
            });
          }
          dispatch({
            type: 'SET_MODEL_STATE',
            state: {
              models,
              currentModel: selectedModel,
              allowCustomModel: false,
              customModelValue: '',
              disabled: false,
            },
          });
        },
        validating: (message) => {
          const provider = toString(message.provider);
          if (provider && provider !== state.currentProvider) {
            return;
          }
          dispatch({
            type: 'SET_SAVE_BTN',
            disabled: true,
            text: state.currentPack.buttons.validating,
          });
          dispatch({
            type: 'SET_KEY_STATUS_HTML',
            html: renderStatusHtml(
              'warning',
              state.currentPack.statuses.validating,
            ),
          });
        },
        validationResult: (message) => {
          const provider = toString(message.provider);
          if (provider && provider !== state.currentProvider) {
            return;
          }

          const success = toBoolean(message.success) ?? false;
          if (!success) {
            const errorMessage =
              toString(message.error) ??
              state.currentPack.statuses.notConfigured;
            dispatch({
              type: 'SET_KEY_STATUS_HTML',
              html: renderStatusHtml('error', errorMessage),
            });
            dispatch({
              type: 'SET_SAVE_BTN',
              disabled:
                state.currentProvider === 'ollama'
                  ? false
                  : !state.apiKeyValue.trim(),
              text: state.currentPack.buttons.save,
            });
            return;
          }

          dispatch({
            type: 'SET_KEY_STATUS_HTML',
            html: renderStatusHtml(
              'success',
              state.currentPack.statuses.configured,
            ),
          });
          if (state.currentProvider !== 'ollama') {
            dispatch({ type: 'SET_API_KEY_VALUE', value: '' });
          }
          dispatch({
            type: 'SET_SAVE_BTN',
            disabled: state.currentProvider !== 'ollama',
            text: state.currentPack.buttons.save,
          });

          const allowCustomModel = toBoolean(message.allowCustomModel) ?? false;
          const models = toModelConfigArray(message.models);
          if (!Array.isArray(message.models) && !allowCustomModel) {
            dispatch({
              type: 'SET_MODEL_STATE',
              state: { ...state.modelState, disabled: false },
            });
            return;
          }

          const activeProvider = provider ?? state.currentProvider;
          const currentModel = toString(message.currentModel) ?? '';
          if (allowCustomModel) {
            dispatch({
              type: 'SET_MODEL_STATE',
              state: {
                models: [],
                currentModel,
                allowCustomModel: true,
                customModelValue: currentModel,
                disabled: false,
              },
            });
            return;
          }

          const selectedModel = chooseModel(
            models,
            currentModel,
            activeProvider,
            bootstrap,
          );
          if (selectedModel !== currentModel && selectedModel) {
            vscode.postMessage({
              type: 'saveModel',
              value: selectedModel,
              provider: activeProvider,
            });
          }
          dispatch({
            type: 'SET_MODEL_STATE',
            state: {
              models,
              currentModel: selectedModel,
              allowCustomModel: false,
              customModelValue: '',
              disabled: false,
            },
          });
        },
        generationDone: () => {
          dispatch({ type: 'SET_IS_GENERATING', value: false });
        },
        generationStatusUpdate: (message) => {
          dispatch({
            type: 'SET_IS_GENERATING',
            value: toBoolean(message.isGenerating) ?? false,
          });
          dispatch({ type: 'SET_PENDING_STATUS_CHECK', value: false });
        },
        validationStatusUpdate: (message) => {
          const isValidating = toBoolean(message.isValidating) ?? false;
          const provider = toString(message.provider);
          if (!isValidating || provider !== state.currentProvider) {
            return;
          }
          dispatch({
            type: 'SET_SAVE_BTN',
            disabled: true,
            text: state.currentPack.buttons.validating,
          });
          dispatch({
            type: 'SET_KEY_STATUS_HTML',
            html: renderStatusHtml(
              'warning',
              state.currentPack.statuses.validating,
            ),
          });
        },
        displayLanguageUpdated: (message) => {
          const nextEffectiveRaw = toString(message.effectiveLanguage);
          const nextEffective =
            nextEffectiveRaw &&
            isEffectiveDisplayLanguage(nextEffectiveRaw, bootstrap)
              ? nextEffectiveRaw
              : 'en';
          const nextPack = bootstrap.languagePacks[nextEffective];
          const nextDisplayRaw = toString(message.displayLanguage);
          const nextDisplay =
            nextDisplayRaw && isDisplayLanguage(nextDisplayRaw, bootstrap)
              ? nextDisplayRaw
              : state.displayLanguage;

          dispatch({
            type: 'SET_LANGUAGE',
            displayLanguage: nextDisplay,
            effectiveLanguage: nextEffective,
            pack: nextPack,
          });
          dispatch({
            type: 'SET_LANGUAGE_STATUS_HTML',
            html: renderStatusHtml('success', nextPack.statuses.languageSaved),
          });
        },
        currentMaxAgentSteps: (message) => {
          const steps = normalizeMaxAgentStepsValue(message.maxAgentSteps);
          dispatch({ type: 'SET_MAX_AGENT_STEPS', value: steps });
        },
        openSettingsView: () => {
          dispatch({ type: 'SET_SCREEN', screen: 'settings' });
        },
        customProviderSaved: (message) => {
          const customProviders = toCustomProviderArray(
            message.customProviders,
          );
          dispatch({
            type: 'SET_CUSTOM_PROVIDERS',
            providers: customProviders,
          });
          const savedId = toString(message.savedId) ?? '';
          const savedKey = bootstrap.customProviderPrefix + savedId;
          dispatch({ type: 'SET_PROVIDER', provider: savedKey });
          dispatch({ type: 'SET_API_KEY_VALUE', value: '' });
          dispatch({ type: 'SET_API_KEY_TYPE', inputType: 'password' });
          setModelStateToLocked(true);
          vscode.postMessage({ type: 'saveProvider', value: savedKey });
          vscode.postMessage({ type: 'checkKey', provider: savedKey });
          vscode.postMessage({ type: 'getModels', provider: savedKey });
          dispatch({ type: 'SET_SCREEN', screen: 'main' });
          vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
        },
        customProviderDeleted: (message) => {
          const customProviders = toCustomProviderArray(
            message.customProviders,
          );
          dispatch({
            type: 'SET_CUSTOM_PROVIDERS',
            providers: customProviders,
          });
          const deletedFallback = bootstrap.defaultProvider;
          const deletedIsOllama = deletedFallback === 'ollama';
          dispatch({ type: 'SET_PROVIDER', provider: deletedFallback });
          dispatch({
            type: 'SET_API_KEY_VALUE',
            value: deletedIsOllama
              ? normalizeOllamaHostValue(
                  state.ollamaStoredHost,
                  bootstrap.ollamaDefaultHost,
                )
              : '',
          });
          dispatch({
            type: 'SET_API_KEY_TYPE',
            inputType: deletedIsOllama ? 'text' : 'password',
          });
          setModelStateToLocked(!deletedIsOllama);
          vscode.postMessage({ type: 'saveProvider', value: deletedFallback });
          vscode.postMessage({ type: 'checkKey', provider: deletedFallback });
          vscode.postMessage({ type: 'getModels', provider: deletedFallback });
          dispatch({ type: 'SET_SCREEN', screen: 'main' });
          vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
        },
        customProviderSaveFailed: (message) => {
          const errorMessage =
            toString(message.error) ?? state.currentPack.statuses.notConfigured;
          dispatch({
            type: 'SET_SAVE_BTN',
            disabled: false,
            text: state.currentPack.buttons.save,
          });
          dispatch({
            type: 'UPDATE_ADD_PROVIDER_DRAFT',
            partial: { statusHtml: renderStatusHtml('error', errorMessage) },
          });
        },
        customProvidersLoaded: (message) => {
          dispatch({
            type: 'SET_CUSTOM_PROVIDERS',
            providers: toCustomProviderArray(message.customProviders),
          });
        },
        openAddProviderView: () => {
          dispatch({ type: 'SET_SCREEN', screen: 'addProvider' });
          vscode.postMessage({
            type: 'setCurrentScreen',
            value: 'addProvider',
          });
        },
      };

    const handler = (event: MessageEvent<unknown>) => {
      const message = toMessagePayload(event.data);
      if (!message) {
        return;
      }

      const process = handlers[message.type];
      if (typeof process === 'function') {
        process(message);
      }
    };

    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
    };
  }, [
    vscode,
    bootstrap,
    state.currentProvider,
    state.currentPack,
    state.modelState,
    state.apiKeyValue,
    state.ollamaStoredHost,
    state.displayLanguage,
    dispatch,
  ]);
}
