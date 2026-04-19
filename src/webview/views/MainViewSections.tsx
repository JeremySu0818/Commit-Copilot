import React from 'react';

import { SafeRichText } from '../components/SafeRichText';
import { StatusMessageView } from '../components/StatusMessageView';
import { useMainViewContext } from '../main-view-context';

type MainViewContextValue = ReturnType<typeof useMainViewContext>;
type MainViewState = MainViewContextValue['state'];
type Bootstrap = MainViewContextValue['bootstrap'];
type LanguagePack = MainViewState['currentPack'];
type ModelState = MainViewState['modelState'];
type CommitOutputOptions = MainViewState['commitOutputOptions'];
type CustomProviderConfig = MainViewState['customProviders'][number] | null;

export function ApiProviderSection({
  pack,
  bootstrap,
  currentProvider,
  customProviders,
  onProviderChange,
}: Readonly<{
  pack: LanguagePack;
  bootstrap: Bootstrap;
  currentProvider: string;
  customProviders: MainViewState['customProviders'];
  onProviderChange: React.ChangeEventHandler<HTMLSelectElement>;
}>) {
  return (
    <div className="config-section">
      <div className="section-title">{pack.sections.apiProvider}</div>
      <div className="input-group input-group-spaced">
        <label>{pack.labels.provider}</label>
        <select
          id="providerSelect"
          value={currentProvider}
          onChange={onProviderChange}
        >
          <option value="" disabled>
            {pack.placeholders.selectProvider}
          </option>
          {Object.entries(bootstrap.providers).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          {customProviders.map((cp) => (
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
  );
}

export function ProviderConfigurationSection({
  pack,
  title,
  apiKeyLabel,
  apiKeyType,
  apiKeyPlaceholder,
  apiKeyValue,
  saveBtnDisabled,
  saveBtnText,
  keyStatusMessage,
  providerInfoHtml,
  customProviderConfig,
  onApiKeyInput,
  onSave,
  onEditProvider,
}: Readonly<{
  pack: LanguagePack;
  title: string;
  apiKeyLabel: string;
  apiKeyType: MainViewState['apiKeyType'];
  apiKeyPlaceholder: string;
  apiKeyValue: string;
  saveBtnDisabled: boolean;
  saveBtnText: string;
  keyStatusMessage: MainViewState['keyStatusMessage'];
  providerInfoHtml: string;
  customProviderConfig: CustomProviderConfig;
  onApiKeyInput: React.ChangeEventHandler<HTMLInputElement>;
  onSave: React.MouseEventHandler<HTMLButtonElement>;
  onEditProvider: React.MouseEventHandler<HTMLButtonElement>;
}>) {
  return (
    <div className="config-section">
      <div className="section-title">{title}</div>
      <div className="input-group input-group-spaced">
        <label>{apiKeyLabel}</label>
        <input
          type={apiKeyType}
          id="apiKey"
          placeholder={apiKeyPlaceholder}
          value={apiKeyValue}
          onChange={onApiKeyInput}
        />
        <button id="saveBtn" disabled={saveBtnDisabled} onClick={onSave}>
          {saveBtnText}
        </button>
        <StatusMessageView id="keyStatus" status={keyStatusMessage} />
      </div>
      <SafeRichText className="provider-info" content={providerInfoHtml} />
      <div className="spacer-top-sm">
        <button
          id="editProviderBtn"
          className={`secondary provider-action-btn${
            !customProviderConfig ? ' hidden' : ''
          }`}
          onClick={onEditProvider}
        >
          {pack.buttons.editProvider}
        </button>
      </div>
    </div>
  );
}

export function ModelSection({
  pack,
  modelState,
  onModelChange,
  onCustomModelChange,
  onCustomModelBlur,
}: Readonly<{
  pack: LanguagePack;
  modelState: ModelState;
  onModelChange: React.ChangeEventHandler<HTMLSelectElement>;
  onCustomModelChange: React.ChangeEventHandler<HTMLInputElement>;
  onCustomModelBlur: React.FocusEventHandler<HTMLInputElement>;
}>) {
  return (
    <div className="config-section">
      <div className="section-title">{pack.sections.model}</div>
      <div className="input-group input-group-spaced">
        <label>{pack.labels.model}</label>
        {modelState.allowCustomModel ? (
          <input
            type="text"
            id="customModelInput"
            value={modelState.customModelValue}
            onChange={onCustomModelChange}
            onBlur={onCustomModelBlur}
          />
        ) : (
          <select
            id="modelSelect"
            disabled={modelState.disabled}
            value={modelState.currentModel}
            onChange={onModelChange}
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
  );
}

export function GenerateConfigurationSection({
  pack,
  bootstrap,
  commitOutputOptions,
  generateModeDisabled,
  effectiveGenerateMode,
  generateModeStatusText,
  onGenerateModeChange,
  onCheckboxChange,
}: Readonly<{
  pack: LanguagePack;
  bootstrap: Bootstrap;
  commitOutputOptions: CommitOutputOptions;
  generateModeDisabled: boolean;
  effectiveGenerateMode: string;
  generateModeStatusText: string;
  onGenerateModeChange: React.ChangeEventHandler<HTMLSelectElement>;
  onCheckboxChange: (field: keyof CommitOutputOptions) => void;
}>) {
  return (
    <div className="config-section">
      <div className="section-title">{pack.sections.generateConfiguration}</div>
      <div className="input-group input-group-spaced">
        <label>{pack.labels.mode}</label>
        <select
          id="generateModeSelect"
          disabled={generateModeDisabled}
          value={effectiveGenerateMode}
          onChange={onGenerateModeChange}
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
      <div className="input-group input-group-spaced">
        <label>{pack.labels.conventionalCommitSections}</label>
        <div className="checkbox-group">
          <label className="checkbox-item" htmlFor="includeScopeCheckbox">
            <input
              type="checkbox"
              id="includeScopeCheckbox"
              checked={commitOutputOptions.includeScope}
              onChange={() => {
                onCheckboxChange('includeScope');
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
                onCheckboxChange('includeBody');
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
                onCheckboxChange('includeFooter');
              }}
            />
            <span>{pack.labels.includeFooter}</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export function MainActionButtons({
  generateBtnDisabled,
  generateBtnTitle,
  generateBtnText,
  onGenerate,
}: Readonly<{
  generateBtnDisabled: boolean;
  generateBtnTitle: string;
  generateBtnText: string;
  onGenerate: React.MouseEventHandler<HTMLButtonElement>;
}>) {
  return (
    <div className="input-group">
      <button
        id="generateBtn"
        disabled={generateBtnDisabled}
        title={generateBtnTitle}
        onClick={onGenerate}
      >
        {generateBtnText}
      </button>
    </div>
  );
}

export function AdvancedFeaturesSection({
  pack,
  rewriteBtnDisabled,
  rewriteBtnTitle,
  onOpenAdvancedView,
}: Readonly<{
  pack: LanguagePack;
  rewriteBtnDisabled: boolean;
  rewriteBtnTitle: string;
  onOpenAdvancedView: React.MouseEventHandler<HTMLButtonElement>;
}>) {
  return (
    <div className="config-section">
      <div className="section-title">{pack.sections.advancedFeatures}</div>
      <div className="provider-info">
        {pack.descriptions.advancedFeaturesDescription}
      </div>
      <div className="input-group input-group-spaced">
        <button
          id="openAdvancedViewBtn"
          className="nav-link-btn"
          disabled={rewriteBtnDisabled}
          title={rewriteBtnTitle}
          onClick={onOpenAdvancedView}
        >
          <span>{pack.buttons.openAdvancedFeatures}</span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
