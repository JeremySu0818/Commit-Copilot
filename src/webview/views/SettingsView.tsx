import React, { useCallback, useState } from 'react';
import { useSidePanel } from '../SidePanelContext';
import { BackIcon } from '../components/BackIcon';
import { normalizeMaxAgentStepsValue, renderStatusHtml } from '../utils';
import type { EffectiveDisplayLanguage } from '../../i18n';

export function SettingsView() {
  const { state, dispatch, vscode, bootstrap } = useSidePanel();
  const { currentPack: pack, displayLanguage, currentMaxAgentSteps } = state;
  const [maxStepsInput, setMaxStepsInput] = useState(currentMaxAgentSteps > 0 ? String(currentMaxAgentSteps) : '');

  const maxStepsInputValue = normalizeMaxAgentStepsValue(maxStepsInput);
  const saveMaxStepsDisabled = maxStepsInputValue === currentMaxAgentSteps;

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_SCREEN', screen: 'main' });
    vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
  }, [dispatch, vscode]);

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({ type: 'SET_LANGUAGE_STATUS_HTML', html: renderStatusHtml('warning', pack.statuses.loadingConfiguration) });
    vscode.postMessage({ type: 'saveDisplayLanguage', value: e.target.value });
  }, [pack, dispatch, vscode]);

  const handleMaxStepsInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxStepsInput(e.target.value);
  }, []);

  const handleSaveMaxSteps = useCallback(() => {
    const value = normalizeMaxAgentStepsValue(maxStepsInput);
    setMaxStepsInput(value > 0 ? String(value) : '');
    dispatch({ type: 'SET_MAX_AGENT_STEPS', value });
    vscode.postMessage({ type: 'saveMaxAgentSteps', value });
  }, [maxStepsInput, dispatch, vscode]);

  return (
    <div id="settingsView" className={`container${state.screen !== 'settings' ? ' hidden' : ''}`}>
      <div className="settings-header">
        <button id="backBtn" className="icon-btn" title={pack.buttons.back} onClick={handleBack}>
          <BackIcon />
        </button>
      </div>
      <div className="config-section">
        <div className="section-title">{pack.sections.settings}</div>
        <div className="input-group" style={{ marginTop: '10px' }}>
          <label>{pack.labels.language}</label>
          <select id="languageSelect" value={displayLanguage} onChange={handleLanguageChange}>
            {bootstrap.displayLanguageOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label || (option.labels && option.labels[state.effectiveLanguage as EffectiveDisplayLanguage]) || option.value}
              </option>
            ))}
          </select>
          <span id="languageStatus" className="status" dangerouslySetInnerHTML={{ __html: state.languageStatusHtml }} />
        </div>
        <div className="input-group" style={{ marginTop: '10px' }}>
          <label>{pack.labels.maxAgentSteps}</label>
          <input
            type="text"
            id="maxAgentStepsInput"
            inputMode="numeric"
            pattern="[0-9]*"
            value={maxStepsInput}
            onChange={handleMaxStepsInput}
          />
          <button id="saveMaxAgentStepsBtn" disabled={saveMaxStepsDisabled} onClick={handleSaveMaxSteps}>{pack.buttons.save}</button>
          <span className="status">{pack.descriptions.maxAgentStepsDescription}</span>
        </div>
      </div>
    </div>
  );
}
