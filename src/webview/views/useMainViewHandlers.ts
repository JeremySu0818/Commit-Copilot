import { useCallback } from 'react';

import type {
  CommitOutputOptions,
  CustomProviderConfig,
  GenerateMode,
} from '../../models';
import { useMainViewContext } from '../main-view-context';
import {
  createStatusMessage,
  normalizeGenerateMode,
  normalizeOllamaHostValue,
} from '../utils';

export function useMainViewHandlers({
  isCustom,
  customProviderConfig,
  isOllama,
  effectiveGenerateMode,
}: Readonly<{
  isCustom: boolean;
  customProviderConfig: CustomProviderConfig | null;
  isOllama: boolean;
  effectiveGenerateMode: GenerateMode;
}>) {
  const { state, dispatch, vscode, bootstrap } = useMainViewContext();
  const {
    currentPack: pack,
    currentProvider,
    commitOutputOptions,
    modelState,
    isGenerating,
  } = state;

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const provider = e.target.value;
      if (provider === '__add_provider__') {
        e.target.value = currentProvider;
        dispatch({
          type: 'SET_ADD_PROVIDER_DRAFT',
          draft: {
            editingId: null,
            originalName: '',
            originalBaseUrl: '',
            name: '',
            baseUrl: '',
            apiKey: '',
            statusHtml: '',
          },
        });
        dispatch({ type: 'SET_SCREEN', screen: 'addProvider' });
        vscode.postMessage({ type: 'setCurrentScreen', value: 'addProvider' });
        return;
      }
      dispatch({ type: 'SET_PROVIDER', provider });
      const nextApiValue =
        provider === 'ollama'
          ? normalizeOllamaHostValue(
              state.ollamaStoredHost,
              bootstrap.ollamaDefaultHost,
            )
          : '';
      dispatch({
        type: 'SET_API_KEY_VALUE',
        value: nextApiValue,
      });
      dispatch({
        type: 'SET_API_KEY_TYPE',
        inputType: provider === 'ollama' ? 'text' : 'password',
      });
      dispatch({
        type: 'SET_SAVE_BTN',
        disabled: provider !== 'ollama',
        text: pack.buttons.save,
      });
      dispatch({
        type: 'SET_KEY_STATUS_MESSAGE',
        status: createStatusMessage('warning', pack.statuses.checkingStatus),
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
      vscode.postMessage({ type: 'saveProvider', value: provider });
      vscode.postMessage({ type: 'checkKey', provider });
      vscode.postMessage({ type: 'getModels', provider });
    },
    [
      currentProvider,
      state.ollamaStoredHost,
      bootstrap,
      pack,
      dispatch,
      vscode,
    ],
  );

  const handleApiKeyInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      dispatch({ type: 'SET_API_KEY_VALUE', value: val });
      if (isOllama) {
        dispatch({ type: 'SET_OLLAMA_HOST', host: val });
        dispatch({
          type: 'SET_SAVE_BTN',
          disabled: false,
          text: pack.buttons.save,
        });
      } else {
        dispatch({
          type: 'SET_SAVE_BTN',
          disabled: !val.trim(),
          text: pack.buttons.save,
        });
      }
    },
    [isOllama, pack, dispatch],
  );

  const handleSave = useCallback(() => {
    let key = '';
    if (state.apiKeyValue.length > 0) {
      key = state.apiKeyValue;
    } else if (isOllama) {
      key = bootstrap.ollamaDefaultHost;
    }
    if (isOllama) {
      dispatch({
        type: 'SET_OLLAMA_HOST',
        host: normalizeOllamaHostValue(key, bootstrap.ollamaDefaultHost),
      });
    }
    dispatch({
      type: 'SET_SAVE_BTN',
      disabled: true,
      text: pack.buttons.validating,
    });
    dispatch({
      type: 'SET_KEY_STATUS_MESSAGE',
      status: createStatusMessage('warning', pack.statuses.validating),
    });
    vscode.postMessage({
      type: 'saveKey',
      value: key,
      provider: currentProvider,
    });
  }, [
    state.apiKeyValue,
    isOllama,
    bootstrap.ollamaDefaultHost,
    currentProvider,
    pack,
    dispatch,
    vscode,
  ]);

  const handleEditProvider = useCallback(() => {
    if (!isCustom || !customProviderConfig) return;
    dispatch({
      type: 'SET_ADD_PROVIDER_DRAFT',
      draft: {
        editingId: customProviderConfig.id,
        originalName: customProviderConfig.name,
        originalBaseUrl: customProviderConfig.baseUrl,
        name: customProviderConfig.name,
        baseUrl: customProviderConfig.baseUrl,
        apiKey: '',
        statusHtml: '',
      },
    });
    dispatch({ type: 'SET_SCREEN', screen: 'addProvider' });
    vscode.postMessage({ type: 'setCurrentScreen', value: 'addProvider' });
  }, [isCustom, customProviderConfig, dispatch, vscode]);

  const handleGenerate = useCallback(() => {
    if (isGenerating) {
      vscode.postMessage({ type: 'cancelGenerate' });
      return;
    }
    if (modelState.allowCustomModel && !modelState.customModelValue.trim()) {
      vscode.postMessage({
        type: 'showWarning',
        key: 'modelNameRequired',
      });
      return;
    }
    dispatch({ type: 'SET_IS_GENERATING', value: true });
    vscode.postMessage({
      type: 'generate',
      generateMode: effectiveGenerateMode,
      commitOutputOptions,
    });
  }, [
    isGenerating,
    modelState,
    effectiveGenerateMode,
    commitOutputOptions,
    dispatch,
    vscode,
  ]);

  const handleRewriteCommitMessage = useCallback(() => {
    vscode.postMessage({ type: 'rewriteCommitMessage' });
  }, [vscode]);

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      vscode.postMessage({
        type: 'saveModel',
        value: e.target.value,
        provider: currentProvider,
      });
      dispatch({
        type: 'SET_MODEL_STATE',
        state: { ...modelState, currentModel: e.target.value },
      });
    },
    [currentProvider, modelState, dispatch, vscode],
  );

  const handleCustomModelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'SET_MODEL_STATE',
        state: { ...modelState, customModelValue: e.target.value },
      });
    },
    [modelState, dispatch],
  );

  const handleCustomModelBlur = useCallback(() => {
    vscode.postMessage({
      type: 'saveModel',
      value: modelState.customModelValue.trim(),
      provider: currentProvider,
    });
  }, [modelState.customModelValue, currentProvider, vscode]);

  const handleGenerateModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (isOllama) return;
      const mode = normalizeGenerateMode(e.target.value);
      dispatch({ type: 'SET_PREFERRED_GENERATE_MODE', mode });
      dispatch({ type: 'SET_GENERATE_MODE', mode });
      vscode.postMessage({ type: 'saveGenerateMode', value: mode });
    },
    [isOllama, dispatch, vscode],
  );

  const handleCheckboxChange = useCallback(
    (field: keyof CommitOutputOptions) => {
      const updated = {
        ...commitOutputOptions,
        [field]: !commitOutputOptions[field],
      };
      dispatch({ type: 'SET_COMMIT_OUTPUT_OPTIONS', options: updated });
      vscode.postMessage({ type: 'saveCommitOutputOptions', value: updated });
    },
    [commitOutputOptions, dispatch, vscode],
  );

  return {
    handleProviderChange,
    handleApiKeyInput,
    handleSave,
    handleEditProvider,
    handleGenerate,
    handleRewriteCommitMessage,
    handleModelChange,
    handleCustomModelChange,
    handleCustomModelBlur,
    handleGenerateModeChange,
    handleCheckboxChange,
  };
}
