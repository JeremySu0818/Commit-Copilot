import React, { useCallback } from 'react';

import { BackIcon } from '../components/BackIcon';
import { useMainViewContext } from '../main-view-context';

export function AboutView() {
  const { state, dispatch, vscode, bootstrap } = useMainViewContext();
  const { currentPack: pack } = state;

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_SCREEN', screen: 'main' });
    vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
  }, [dispatch, vscode]);

  const handleShowUpdateNotes = useCallback(() => {
    vscode.postMessage({ type: 'showUpdateNotes' });
  }, [vscode]);

  const version = bootstrap.extensionVersion;
  const author = bootstrap.extensionAuthor;

  return (
    <div
      id="aboutView"
      className={`container${state.screen !== 'about' ? ' hidden' : ''}`}
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
        <div className="section-title">{pack.sections.about}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
          <div>
            <div style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)', marginBottom: '4px' }}>{pack.labels.version}</div>
            <div style={{ fontSize: '1.1em', fontWeight: 'bold' }}>{version}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)', marginBottom: '4px' }}>{pack.labels.author}</div>
            <div style={{ fontSize: '1.1em', fontWeight: 'bold' }}>{author}</div>
          </div>
          <div style={{ marginTop: '15px' }}>
            <button
              style={{ width: '100%' }}
              onClick={handleShowUpdateNotes}
            >
              {pack.buttons.showUpdateNotes}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
