import React, { useCallback, useMemo } from 'react';

import { BackIcon } from '../components/BackIcon';
import { useMainViewContext } from '../main-view-context';

import {
  getApiKeyPlaceholder,
  getRewriteBtnTitle,
} from './MainViewDerivedState';

export function AdvancedView() {
  const { state, dispatch, vscode, bootstrap } = useMainViewContext();
  const {
    currentPack: pack,
    isGenerating,
    currentProvider,
    modelState,
  } = state;
  const isCustom = currentProvider.startsWith(bootstrap.customProviderPrefix);
  const isOllama = currentProvider === 'ollama';
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

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_SCREEN', screen: 'main' });
    vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
  }, [dispatch, vscode]);

  const handleRewrite = useCallback(() => {
    vscode.postMessage({ type: 'rewriteCommitMessage' });
  }, [vscode]);

  return (
    <div
      id="advancedView"
      className={`container${state.screen !== 'advanced' ? ' hidden' : ''}`}
    >
      <div className="settings-header">
        <button
          id="advancedBackBtn"
          className="icon-btn"
          title={pack.buttons.back}
          onClick={handleBack}
        >
          <BackIcon />
        </button>
      </div>

      <div className="config-section">
        <div className="section-title">{pack.sections.rewriteEditor}</div>
        <div className="provider-info">
          {pack.descriptions.rewriteWorkflowDescription}
        </div>
        <div className="input-group input-group-spaced">
          <button
            id="rewriteCommitMessageBtn"
            disabled={rewriteBtnDisabled}
            title={rewriteBtnTitle}
            onClick={handleRewrite}
          >
            {pack.buttons.rewriteCommitMessage}
          </button>
        </div>
      </div>
    </div>
  );
}
