import React, { useMemo } from 'react';

import { useMainViewContext } from '../main-view-context';

import {
  getApiKeyPlaceholder,
  getGenerateBtnTitle,
  getProviderInfoHtml,
  getRewriteBtnTitle,
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
  const generateModeDisabled = isOllama;
  const effectiveGenerateMode = isOllama
    ? ('direct-diff' as const)
    : currentGenerateMode;

  const {
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
  } = useMainViewHandlers({
    isCustom,
    customProviderConfig,
    isOllama,
    effectiveGenerateMode,
  });

  const generateModeStatusText = useMemo(() => {
    if (isOllama) return pack.descriptions.ollamaFixedToDirectDiff;
    if (effectiveGenerateMode === 'agentic')
      return pack.descriptions.agenticModeDescription;
    return pack.descriptions.directDiffDescription;
  }, [isOllama, effectiveGenerateMode, pack]);

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

  const hasConfiguredKey = state.providerKeyStatuses[currentProvider];
  const isApiKeyMissing = !hasConfiguredKey && !state.apiKeyValue.trim();
  const isCustomModelMissing =
    modelState.allowCustomModel && !modelState.customModelValue.trim();
  const rewriteBtnDisabled = isGenerating;
  const rewriteBtnTitle = getRewriteBtnTitle({
    isGenerating,
    isApiKeyMissing,
    apiKeyPlaceholder,
    isCustomModelMissing,
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
        pack={pack}
        generateBtnDisabled={generateBtnDisabled}
        generateBtnTitle={generateBtnTitle}
        generateBtnText={generateBtnText}
        rewriteBtnDisabled={rewriteBtnDisabled}
        rewriteBtnTitle={rewriteBtnTitle}
        onGenerate={handleGenerate}
        onRewriteCommitMessage={handleRewriteCommitMessage}
      />
    </div>
  );
}
