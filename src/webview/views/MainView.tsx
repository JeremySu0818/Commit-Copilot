import React, { useMemo } from 'react';

import { useMainViewContext } from '../main-view-context';

import {
  getApiKeyPlaceholder,
  getGenerateBtnTitle,
  getProviderInfoHtml,
} from './MainViewDerivedState';
import {
  ApiProviderSection,
  GenerateConfigurationSection,
  MainActionButtons,
  ModelSection,
  ProviderConfigurationSection,
} from './MainViewSections';
import { useMainViewHandlers } from './useMainViewHandlers';

export function MainView() {
  const { state, bootstrap } = useMainViewContext();
  const {
    currentPack: pack,
    currentProvider,
    currentGenerateMode,
    commitOutputOptions,
    modelState,
    isGenerating,
    pendingStatusCheck,
    hasChanges,
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
  const generateModeDisabled = false;
  const effectiveGenerateMode = currentGenerateMode;

  const {
    handleProviderChange,
    handleApiKeyInput,
    handleSave,
    handleEditProvider,
    handleGenerate,
    handleModelChange,
    handleCustomModelChange,
    handleCustomModelBlur,
    handleGenerateModeChange,
    handleCheckboxChange,
  } = useMainViewHandlers({
    isCustom,
    customProviderConfig,
    isOllama,
    effectiveGenerateMode,
  });

  const generateModeStatusText = useMemo(() => {
    if (effectiveGenerateMode === 'agentic')
      return pack.descriptions.agenticModeDescription;
    return pack.descriptions.directDiffDescription;
  }, [effectiveGenerateMode, pack]);

  const apiKeyLabel = isOllama ? pack.labels.ollamaHostUrl : pack.labels.apiKey;
  const apiKeyPlaceholder = useMemo(
    () =>
      getApiKeyPlaceholder({
        isOllama,
        isCustom,
        currentProvider,
        pack,
        ollamaDefaultHost: bootstrap.ollamaDefaultHost,
      }),
    [isOllama, isCustom, currentProvider, pack, bootstrap.ollamaDefaultHost],
  );

  const configTitle = isOllama
    ? pack.sections.ollamaConfiguration
    : pack.sections.configuration;

  const providerInfoHtml = useMemo(
    () =>
      getProviderInfoHtml({
        isOllama,
        isCustom,
        currentProvider,
        pack,
        ollamaDefaultHost: bootstrap.ollamaDefaultHost,
      }),
    [isOllama, isCustom, currentProvider, pack, bootstrap.ollamaDefaultHost],
  );

  const generateBtnDisabled =
    !isGenerating && (pendingStatusCheck || !hasChanges);
  const generateBtnText = isGenerating
    ? pack.buttons.cancelGenerating
    : pack.buttons.generateCommitMessage;
  const generateBtnTitle = getGenerateBtnTitle({
    isGenerating,
    pendingStatusCheck,
    hasChanges,
    pack,
  });

  return (
    <div
      id="mainView"
      className={`container${state.screen !== 'main' ? ' hidden' : ''}`}
    >
      <ApiProviderSection
        pack={pack}
        bootstrap={bootstrap}
        currentProvider={currentProvider}
        customProviders={state.customProviders}
        onProviderChange={handleProviderChange}
      />

      <ProviderConfigurationSection
        pack={pack}
        title={configTitle}
        apiKeyLabel={apiKeyLabel}
        apiKeyType={state.apiKeyType}
        apiKeyPlaceholder={apiKeyPlaceholder}
        apiKeyValue={state.apiKeyValue}
        saveBtnDisabled={state.saveBtnDisabled}
        saveBtnText={state.saveBtnText}
        keyStatusMessage={state.keyStatusMessage}
        providerInfoHtml={providerInfoHtml}
        customProviderConfig={customProviderConfig}
        onApiKeyInput={handleApiKeyInput}
        onSave={handleSave}
        onEditProvider={handleEditProvider}
      />

      <ModelSection
        pack={pack}
        modelState={modelState}
        isManagedModelProvider={isCustom || isOllama}
        onModelChange={handleModelChange}
        onCustomModelChange={handleCustomModelChange}
        onCustomModelBlur={handleCustomModelBlur}
      />

      <GenerateConfigurationSection
        pack={pack}
        bootstrap={bootstrap}
        commitOutputOptions={commitOutputOptions}
        generateModeDisabled={generateModeDisabled}
        effectiveGenerateMode={effectiveGenerateMode}
        generateModeStatusText={generateModeStatusText}
        onGenerateModeChange={handleGenerateModeChange}
        onCheckboxChange={handleCheckboxChange}
      />

      <MainActionButtons
        generateBtnDisabled={generateBtnDisabled}
        generateBtnTitle={generateBtnTitle}
        generateBtnText={generateBtnText}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
