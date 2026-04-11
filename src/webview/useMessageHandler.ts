import { useEffect } from 'react';
import type { WebviewBootstrapData } from '../side-panel-webview-bootstrap';
import type { SidePanelAction, SidePanelState } from './SidePanelContext';
import {
  renderStatusHtml,
  normalizeGenerateMode,
  normalizeMaxAgentStepsValue,
  normalizeOllamaHostValue,
} from './utils';

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
    // Sync the actual screen shown by this webview instance back to the host.
    // When the webview JS is destroyed (e.g. switching side panels) and later
    // reloaded, the host's context key (_currentScreen) may still hold the
    // previous screen ('settings' or 'addProvider'), causing the settings
    // button to remain hidden even though the UI has reset to 'main'.
    const effectiveScreen = bootstrap.initialScreen === 'settings' ? 'settings' : 'main';
    vscode.postMessage({ type: 'setCurrentScreen', value: effectiveScreen });
  }, [vscode, bootstrap]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'currentProvider':
          dispatch({ type: 'SET_PROVIDER', provider: message.provider });
          vscode.postMessage({ type: 'checkKey', provider: message.provider });
          vscode.postMessage({ type: 'getModels', provider: message.provider });
          break;

        case 'repoUpdate':
          dispatch({ type: 'SET_HAS_CHANGES', value: message.hasChanges });
          break;

        case 'keyStatus': {
          if (
            message.provider === 'ollama' &&
            state.currentProvider === 'ollama' &&
            typeof message.value === 'string'
          ) {
            const host = normalizeOllamaHostValue(
              message.value,
              bootstrap.ollamaDefaultHost,
            );
            dispatch({ type: 'SET_OLLAMA_HOST', host });
            dispatch({ type: 'SET_API_KEY_VALUE', value: host });
          }
          dispatch({
            type: 'SET_KEY_STATUS',
            provider: message.provider,
            hasKey: message.hasKey,
          });
          if (message.provider === state.currentProvider) {
            if (message.hasKey) {
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
            } else {
              dispatch({
                type: 'SET_KEY_STATUS_HTML',
                html: renderStatusHtml(
                  'error',
                  state.currentPack.statuses.notConfigured,
                ),
              });
              if (message.provider !== 'ollama') {
                dispatch({
                  type: 'SET_MODEL_STATE',
                  state: { ...state.modelState, disabled: true },
                });
              }
            }
          }
          break;
        }

        case 'allKeyStatuses': {
          const statuses =
            message.statuses && typeof message.statuses === 'object'
              ? message.statuses
              : {};
          const normalized: Record<string, boolean> = {};
          Object.keys(statuses).forEach((provider) => {
            normalized[provider] = !!statuses[provider];
          });
          dispatch({ type: 'SET_ALL_KEY_STATUSES', statuses: normalized });
          if (typeof normalized[state.currentProvider] === 'boolean') {
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
          }
          break;
        }

        case 'currentGenerateMode': {
          const mode = normalizeGenerateMode(message.generateMode);
          dispatch({ type: 'SET_PREFERRED_GENERATE_MODE', mode });
          dispatch({ type: 'SET_GENERATE_MODE', mode });
          break;
        }

        case 'currentCommitOutputOptions':
          dispatch({
            type: 'SET_COMMIT_OUTPUT_OPTIONS',
            options: {
              includeScope:
                typeof message.commitOutputOptions?.includeScope === 'boolean'
                  ? message.commitOutputOptions.includeScope
                  : bootstrap.defaultCommitOutputOptions.includeScope,
              includeBody:
                typeof message.commitOutputOptions?.includeBody === 'boolean'
                  ? message.commitOutputOptions.includeBody
                  : bootstrap.defaultCommitOutputOptions.includeBody,
              includeFooter:
                typeof message.commitOutputOptions?.includeFooter === 'boolean'
                  ? message.commitOutputOptions.includeFooter
                  : bootstrap.defaultCommitOutputOptions.includeFooter,
            },
          });
          break;

        case 'modelsList': {
          if (message.provider && message.provider !== state.currentProvider) {
            break;
          }
          const activeProvider = message.provider || state.currentProvider;
          if (message.allowCustomModel) {
            dispatch({
              type: 'SET_MODEL_STATE',
              state: {
                models: [],
                currentModel: message.currentModel || '',
                allowCustomModel: true,
                customModelValue: message.currentModel || '',
                disabled: false,
              },
            });
          } else {
            const models = Array.isArray(message.models) ? message.models : [];
            let selectedModel = message.currentModel || '';
            const foundCurrent = models.some(
              (m: { id: string }) => m.id === selectedModel,
            );
            if (!foundCurrent && models.length > 0) {
              const preferredDefaultId =
                bootstrap.defaultModels[
                  activeProvider as keyof typeof bootstrap.defaultModels
                ];
              const preferred =
                models.find(
                  (m: { id: string }) => m.id === preferredDefaultId,
                ) || models[0];
              selectedModel = preferred.id;
              vscode.postMessage({
                type: 'saveModel',
                value: preferred.id,
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
          }
          break;
        }

        case 'validating':
          if (message.provider && message.provider !== state.currentProvider) {
            break;
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
          break;

        case 'validationResult': {
          if (message.provider && message.provider !== state.currentProvider) {
            break;
          }
          if (message.success) {
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
            if (Array.isArray(message.models) || message.allowCustomModel) {
              const activeProvider = message.provider || state.currentProvider;
              if (message.allowCustomModel) {
                dispatch({
                  type: 'SET_MODEL_STATE',
                  state: {
                    models: [],
                    currentModel: message.currentModel || '',
                    allowCustomModel: true,
                    customModelValue: message.currentModel || '',
                    disabled: false,
                  },
                });
              } else {
                const models = message.models || [];
                let selectedModel = message.currentModel || '';
                const foundCurrent = models.some(
                  (m: { id: string }) => m.id === selectedModel,
                );
                if (!foundCurrent && models.length > 0) {
                  const preferredDefaultId =
                    bootstrap.defaultModels[
                      activeProvider as keyof typeof bootstrap.defaultModels
                    ];
                  const preferred =
                    models.find(
                      (m: { id: string }) => m.id === preferredDefaultId,
                    ) || models[0];
                  selectedModel = preferred.id;
                  vscode.postMessage({
                    type: 'saveModel',
                    value: preferred.id,
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
              }
            } else {
              dispatch({
                type: 'SET_MODEL_STATE',
                state: { ...state.modelState, disabled: false },
              });
            }
          } else {
            dispatch({
              type: 'SET_KEY_STATUS_HTML',
              html: renderStatusHtml(
                'error',
                message.error || state.currentPack.statuses.notConfigured,
              ),
            });
            dispatch({
              type: 'SET_SAVE_BTN',
              disabled:
                state.currentProvider === 'ollama'
                  ? false
                  : !state.apiKeyValue.trim(),
              text: state.currentPack.buttons.save,
            });
          }
          break;
        }

        case 'generationDone':
          dispatch({ type: 'SET_IS_GENERATING', value: false });
          break;

        case 'generationStatusUpdate':
          dispatch({ type: 'SET_IS_GENERATING', value: message.isGenerating });
          dispatch({ type: 'SET_PENDING_STATUS_CHECK', value: false });
          break;

        case 'validationStatusUpdate':
          if (
            message.isValidating &&
            message.provider === state.currentProvider
          ) {
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
          }
          break;

        case 'displayLanguageUpdated': {
          const nextEffective = message.effectiveLanguage || 'en';
          const nextPack =
            bootstrap.languagePacks[
              nextEffective as keyof typeof bootstrap.languagePacks
            ] || bootstrap.languagePacks.en;
          dispatch({
            type: 'SET_LANGUAGE',
            displayLanguage: message.displayLanguage,
            effectiveLanguage: nextEffective,
            pack: nextPack,
          });
          dispatch({
            type: 'SET_LANGUAGE_STATUS_HTML',
            html: renderStatusHtml('success', nextPack.statuses.languageSaved),
          });
          break;
        }

        case 'currentMaxAgentSteps': {
          const steps = normalizeMaxAgentStepsValue(message.maxAgentSteps);
          dispatch({ type: 'SET_MAX_AGENT_STEPS', value: steps });
          break;
        }

        case 'openSettingsView':
          dispatch({ type: 'SET_SCREEN', screen: 'settings' });
          break;

        case 'customProviderSaved': {
          dispatch({
            type: 'SET_CUSTOM_PROVIDERS',
            providers: message.customProviders || [],
          });
          const savedKey = bootstrap.customProviderPrefix + message.savedId;
          dispatch({ type: 'SET_PROVIDER', provider: savedKey });
          vscode.postMessage({ type: 'saveProvider', value: savedKey });
          vscode.postMessage({ type: 'checkKey', provider: savedKey });
          vscode.postMessage({ type: 'getModels', provider: savedKey });
          dispatch({ type: 'SET_SCREEN', screen: 'main' });
          vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
          break;
        }

        case 'customProviderDeleted': {
          dispatch({
            type: 'SET_CUSTOM_PROVIDERS',
            providers: message.customProviders || [],
          });
          dispatch({
            type: 'SET_PROVIDER',
            provider: bootstrap.defaultProvider,
          });
          vscode.postMessage({
            type: 'saveProvider',
            value: bootstrap.defaultProvider,
          });
          vscode.postMessage({
            type: 'checkKey',
            provider: bootstrap.defaultProvider,
          });
          vscode.postMessage({
            type: 'getModels',
            provider: bootstrap.defaultProvider,
          });
          dispatch({ type: 'SET_SCREEN', screen: 'main' });
          vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
          break;
        }

        case 'customProviderSaveFailed':
          dispatch({
            type: 'SET_SAVE_BTN',
            disabled: false,
            text: state.currentPack.buttons.save,
          });
          dispatch({
            type: 'UPDATE_ADD_PROVIDER_DRAFT',
            partial: {
              statusHtml: renderStatusHtml(
                'error',
                message.error || state.currentPack.statuses.notConfigured,
              ),
            },
          });
          break;

        case 'customProvidersLoaded':
          dispatch({
            type: 'SET_CUSTOM_PROVIDERS',
            providers: message.customProviders || [],
          });
          break;

        case 'openAddProviderView':
          dispatch({ type: 'SET_SCREEN', screen: 'addProvider' });
          vscode.postMessage({
            type: 'setCurrentScreen',
            value: 'addProvider',
          });
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [
    vscode,
    bootstrap,
    state.currentProvider,
    state.currentPack,
    state.modelState,
    state.apiKeyValue,
    dispatch,
  ]);
}
