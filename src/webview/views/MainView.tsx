import React, { useCallback, useMemo } from 'react';

import { useSidePanel } from '../side-panel-context';
import {
  fillTemplate,
  normalizeGenerateMode,
  normalizeOllamaHostValue,
  renderStatusHtml,
} from '../utils';

export function MainView() {
  const { state, dispatch, vscode, bootstrap } = useSidePanel();
  const {
    currentPack: pack,
    currentProvider,
    currentGenerateMode,
    commitOutputOptions,
    modelState,
    isGenerating,
    isForcePushing,
    pendingStatusCheck,
    hasChanges,
    forcePushStatusHtml,
  } = state;

  const isCustom = currentProvider.startsWith(bootstrap.customProviderPrefix);
  const customProviderConfig = isCustom
    ? (state.customProviders.find(
        (cp) =>
          cp.id ===
          currentProvider.slice(bootstrap.customProviderPrefix.length),
      ) ?? null)
    : null;

  const isOllama = currentProvider === 'ollama';

  const generateModeDisabled = isOllama;
  const effectiveGenerateMode = isOllama
    ? ('direct-diff' as const)
    : currentGenerateMode;

  const generateModeStatusText = useMemo(() => {
    if (isOllama) return pack.descriptions.ollamaFixedToDirectDiff;
    if (effectiveGenerateMode === 'agentic')
      return pack.descriptions.agenticModeDescription;
    return pack.descriptions.directDiffDescription;
  }, [isOllama, effectiveGenerateMode, pack]);

  const apiKeyLabel = isOllama ? pack.labels.ollamaHostUrl : pack.labels.apiKey;
  const apiKeyPlaceholder = useMemo(() => {
    if (isOllama) return bootstrap.ollamaDefaultHost;
    if (isCustom) return pack.placeholders.enterCustomApiKey;
    if (currentProvider === 'google')
      return pack.placeholders.enterGeminiApiKey;
    if (currentProvider === 'openai')
      return pack.placeholders.enterOpenAIApiKey;
    if (currentProvider === 'anthropic')
      return pack.placeholders.enterAnthropicApiKey;
    return pack.placeholders.enterApiKey;
  }, [isOllama, isCustom, currentProvider, pack, bootstrap.ollamaDefaultHost]);

  const configTitle = isOllama
    ? pack.sections.ollamaConfiguration
    : pack.sections.configuration;

  const providerInfoHtml = useMemo(() => {
    if (isOllama)
      return fillTemplate(pack.descriptions.ollamaInfo, {
        host: bootstrap.ollamaDefaultHost,
      });
    if (isCustom) return '';
    if (currentProvider === 'google') return pack.descriptions.googleInfo;
    if (currentProvider === 'openai') return pack.descriptions.openaiInfo;
    if (currentProvider === 'anthropic') return pack.descriptions.anthropicInfo;
    return '';
  }, [isOllama, isCustom, currentProvider, pack, bootstrap.ollamaDefaultHost]);

  const generateBtnDisabled = isGenerating
    ? isForcePushing
    : isForcePushing || pendingStatusCheck || !hasChanges;
  const generateBtnText = isGenerating
    ? pack.buttons.cancelGenerating
    : pack.buttons.generateCommitMessage;
  let generateBtnTitle = '';
  if (isGenerating) {
    generateBtnTitle = pack.statuses.cancelCurrentGeneration;
  } else if (!pendingStatusCheck && !hasChanges) {
    generateBtnTitle = pack.statuses.noChangesDetected;
  }

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
        type: 'SET_KEY_STATUS_HTML',
        html: renderStatusHtml('warning', pack.statuses.checkingStatus),
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
      type: 'SET_KEY_STATUS_HTML',
      html: renderStatusHtml('warning', pack.statuses.validating),
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
        message: pack.statuses.modelNameRequired,
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
    pack,
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
    (field: 'includeScope' | 'includeBody' | 'includeFooter') => {
      const updated = {
        ...commitOutputOptions,
        [field]: !commitOutputOptions[field],
      };
      dispatch({ type: 'SET_COMMIT_OUTPUT_OPTIONS', options: updated });
      vscode.postMessage({ type: 'saveCommitOutputOptions', value: updated });
    },
    [commitOutputOptions, dispatch, vscode],
  );

  return (
    <div
      id="mainView"
      className={`container${state.screen !== 'main' ? ' hidden' : ''}`}
    >
      <div className="config-section">
        <div className="section-title">{pack.sections.apiProvider}</div>
        <div className="input-group" style={{ marginTop: '10px' }}>
          <label>{pack.labels.provider}</label>
          <select
            id="providerSelect"
            value={currentProvider}
            onChange={handleProviderChange}
          >
            <option value="" disabled>
              {pack.placeholders.selectProvider}
            </option>
            {Object.entries(bootstrap.providers).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            {state.customProviders.map((cp) => (
              <option
                key={bootstrap.customProviderPrefix + cp.id}
                value={bootstrap.customProviderPrefix + cp.id}
              >
                {cp.name}
              </option>
            ))}
            <option value="__add_provider__">{pack.buttons.addProvider}</option>
          </select>
        </div>
      </div>

      <div className="config-section">
        <div className="section-title">{configTitle}</div>
        <div className="input-group" style={{ marginTop: '10px' }}>
          <label>{apiKeyLabel}</label>
          <input
            type={state.apiKeyType}
            id="apiKey"
            placeholder={apiKeyPlaceholder}
            value={state.apiKeyValue}
            onChange={handleApiKeyInput}
          />
          <button
            id="saveBtn"
            disabled={state.saveBtnDisabled}
            onClick={handleSave}
          >
            {state.saveBtnText}
          </button>
          <span
            id="keyStatus"
            className="status"
            dangerouslySetInnerHTML={{ __html: state.keyStatusHtml }}
          />
        </div>
        <div
          className="provider-info"
          dangerouslySetInnerHTML={{ __html: providerInfoHtml }}
        />
        <div style={{ marginTop: '8px' }}>
          <button
            id="editProviderBtn"
            className={`secondary${!customProviderConfig ? ' hidden' : ''}`}
            onClick={handleEditProvider}
          >
            {pack.buttons.editProvider}
          </button>
        </div>
      </div>

      <div className="config-section">
        <div className="section-title">{pack.sections.model}</div>
        <div className="input-group" style={{ marginTop: '10px' }}>
          <label>{pack.labels.model}</label>
          {modelState.allowCustomModel ? (
            <input
              type="text"
              id="customModelInput"
              value={modelState.customModelValue}
              onChange={handleCustomModelChange}
              onBlur={handleCustomModelBlur}
            />
          ) : (
            <select
              id="modelSelect"
              disabled={modelState.disabled}
              value={modelState.currentModel}
              onChange={handleModelChange}
            >
              {modelState.models.length === 0 && (
                <option value="" disabled>
                  {pack.placeholders.selectModel}
                </option>
              )}
              {modelState.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.alias}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="config-section">
        <div className="section-title">
          {pack.sections.generateConfiguration}
        </div>
        <div className="input-group" style={{ marginTop: '10px' }}>
          <label>{pack.labels.mode}</label>
          <select
            id="generateModeSelect"
            disabled={generateModeDisabled}
            value={effectiveGenerateMode}
            onChange={handleGenerateModeChange}
          >
            <option value="" disabled>
              {pack.placeholders.selectGenerateMode}
            </option>
            {Object.keys(bootstrap.generateModes).map((mode) => (
              <option key={mode} value={mode}>
                {mode === 'agentic'
                  ? pack.options.agentic ||
                    bootstrap.generateModes[
                      mode as keyof typeof bootstrap.generateModes
                    ]
                  : pack.options.directDiff ||
                    bootstrap.generateModes[
                      mode as keyof typeof bootstrap.generateModes
                    ]}
              </option>
            ))}
          </select>
          <span className="status">{generateModeStatusText}</span>
        </div>
        <div className="input-group" style={{ marginTop: '10px' }}>
          <label>{pack.labels.conventionalCommitSections}</label>
          <div className="checkbox-group">
            <label className="checkbox-item" htmlFor="includeScopeCheckbox">
              <input
                type="checkbox"
                id="includeScopeCheckbox"
                checked={commitOutputOptions.includeScope}
                onChange={() => {
                  handleCheckboxChange('includeScope');
                }}
              />
              <span>{pack.labels.includeScope}</span>
            </label>
            <label className="checkbox-item" htmlFor="includeBodyCheckbox">
              <input
                type="checkbox"
                id="includeBodyCheckbox"
                checked={commitOutputOptions.includeBody}
                onChange={() => {
                  handleCheckboxChange('includeBody');
                }}
              />
              <span>{pack.labels.includeBody}</span>
            </label>
            <label className="checkbox-item" htmlFor="includeFooterCheckbox">
              <input
                type="checkbox"
                id="includeFooterCheckbox"
                checked={commitOutputOptions.includeFooter}
                onChange={() => {
                  handleCheckboxChange('includeFooter');
                }}
              />
              <span>{pack.labels.includeFooter}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="input-group">
        <button
          id="generateBtn"
          disabled={generateBtnDisabled}
          title={generateBtnTitle}
          onClick={handleGenerate}
        >
          {generateBtnText}
        </button>
        <button
          id="rewriteCommitMessageBtn"
          className="secondary"
          disabled={isGenerating || isForcePushing}
          onClick={handleRewriteCommitMessage}
        >
          Rewrite Commit Message
        </button>
        <span
          id="forcePushStatus"
          className={`status${!forcePushStatusHtml ? ' hidden' : ''}`}
          dangerouslySetInnerHTML={{ __html: forcePushStatusHtml }}
        />
      </div>
    </div>
  );
}
