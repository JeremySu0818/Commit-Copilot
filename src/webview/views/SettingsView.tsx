import React, { useCallback, useMemo, useState } from 'react';

import { BackIcon } from '../components/BackIcon';
import { StatusMessageView } from '../components/StatusMessageView';
import { useMainViewContext } from '../main-view-context';
import { createStatusMessage, normalizeMaxAgentStepsValue } from '../utils';

export function SettingsView() {
  const { state, dispatch, vscode, bootstrap } = useMainViewContext();
  const { currentPack: pack, displayLanguage, currentMaxAgentSteps } = state;
  const [maxStepsInput, setMaxStepsInput] = useState('');
  const [isEditingMaxSteps, setIsEditingMaxSteps] = useState(false);
  const externalMaxStepsInput = useMemo(
    () => (currentMaxAgentSteps > 0 ? String(currentMaxAgentSteps) : ''),
    [currentMaxAgentSteps],
  );
  const displayedMaxStepsInput = isEditingMaxSteps
    ? maxStepsInput
    : externalMaxStepsInput;
  const maxStepsInputValue = normalizeMaxAgentStepsValue(
    displayedMaxStepsInput,
  );
  const saveMaxStepsDisabled = maxStepsInputValue === currentMaxAgentSteps;

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_SCREEN', screen: 'main' });
    vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
  }, [dispatch, vscode]);

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch({
        type: 'SET_LANGUAGE_STATUS_MESSAGE',
        status: createStatusMessage(
          'warning',
          pack.statuses.loadingConfiguration,
        ),
      });
      vscode.postMessage({
        type: 'saveDisplayLanguage',
        value: e.target.value,
      });
    },
    [pack, dispatch, vscode],
  );

  const handleMaxStepsInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsEditingMaxSteps(true);
      setMaxStepsInput(e.target.value);
    },
    [],
  );

  const handleSaveMaxSteps = useCallback(() => {
    const value = normalizeMaxAgentStepsValue(displayedMaxStepsInput);
    setMaxStepsInput(value > 0 ? String(value) : '');
    setIsEditingMaxSteps(false);
    dispatch({ type: 'SET_MAX_AGENT_STEPS', value });
    vscode.postMessage({ type: 'saveMaxAgentSteps', value });
  }, [displayedMaxStepsInput, dispatch, vscode]);

  return (
    <div
      id="settingsView"
      className={`container${state.screen !== 'settings' ? ' hidden' : ''}`}
    >
      <div className="settings-header">
        <button
          id="backBtn"
          className="icon-btn"
          title={pack.buttons.back}
          onClick={handleBack}
        >
          <BackIcon />
        </button>
      </div>
      <div className="config-section">
        <div className="section-title">{pack.sections.settings}</div>
        <div className="input-group input-group-spaced">
          <label>{pack.labels.language}</label>
          <select
            id="languageSelect"
            value={displayLanguage}
            onChange={handleLanguageChange}
          >
            {bootstrap.displayLanguageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label ??
                  option.labels?.[state.effectiveLanguage] ??
                  option.value}
              </option>
            ))}
          </select>
          <StatusMessageView
            id="languageStatus"
            status={state.languageStatusMessage}
          />
        </div>
        <div className="input-group input-group-spaced">
          <label>{pack.labels.maxAgentSteps}</label>
          <input
            type="text"
            id="maxAgentStepsInput"
            inputMode="numeric"
            pattern="[0-9]*"
            value={displayedMaxStepsInput}
            onChange={handleMaxStepsInput}
          />
          <button
            id="saveMaxAgentStepsBtn"
            disabled={saveMaxStepsDisabled}
            onClick={handleSaveMaxSteps}
          >
            {pack.buttons.save}
          </button>
          <span className="status">
            {pack.descriptions.maxAgentStepsDescription}
          </span>
        </div>
      </div>
    </div>
  );
}
