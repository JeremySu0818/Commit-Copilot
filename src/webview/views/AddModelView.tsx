import React, { useCallback, useMemo } from 'react';

import { BackIcon } from '../components/BackIcon';
import { useMainViewContext } from '../main-view-context';

export function AddModelView() {
  const { state, dispatch, vscode } = useMainViewContext();
  const { currentPack: pack, addModelDraft: draft } = state;

  const saveDisabled = useMemo(() => {
    return !draft.modelName.trim();
  }, [draft.modelName]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_SCREEN', screen: 'main' });
    vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
  }, [dispatch, vscode]);

  const handleSave = useCallback(() => {
    const modelName = draft.modelName.trim();
    if (!modelName) {
      return;
    }
    vscode.postMessage({
      type: 'addCustomModel',
      provider: state.currentProvider,
      modelName,
    });
  }, [draft.modelName, state.currentProvider, vscode]);

  const handleDelete = useCallback(
    (modelId: string) => {
      vscode.postMessage({
        type: 'deleteCustomModel',
        provider: state.currentProvider,
        modelId,
      });
    },
    [state.currentProvider, vscode],
  );

  return (
    <div
      id="addModelView"
      className={`container${state.screen !== 'addModel' ? ' hidden' : ''}`}
    >
      <div className="settings-header">
        <button
          id="addModelBackBtn"
          className="icon-btn"
          title={pack.buttons.back}
          onClick={handleBack}
        >
          <BackIcon />
        </button>
      </div>
      <div className="config-section">
        <div className="section-title">{pack.sections.addModel}</div>
        <div className="input-group input-group-spaced">
          <label>{pack.labels.modelName}</label>
          <input
            type="text"
            id="addModelNameInput"
            placeholder={pack.placeholders.enterModelName}
            value={draft.modelName}
            onChange={(e) => {
              dispatch({
                type: 'UPDATE_ADD_MODEL_DRAFT',
                partial: { modelName: e.target.value, statusHtml: '' },
              });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !saveDisabled) {
                handleSave();
              }
            }}
          />
        </div>
        <span
          id="addModelStatus"
          className="status"
          dangerouslySetInnerHTML={{ __html: draft.statusHtml }}
        />
        <div className="panel-actions">
          <button
            id="saveModelBtn"
            disabled={saveDisabled}
            onClick={handleSave}
          >
            {pack.buttons.save}
          </button>
        </div>
      </div>

      {draft.customModels.length > 0 && (
        <div className="config-section">
          <div className="section-title">{pack.buttons.deleteModel}</div>
          <div className="custom-model-list">
            {draft.customModels.map((model) => (
              <div key={model.id} className="custom-model-item">
                <span className="custom-model-item-name">{model.alias}</span>
                <button
                  className="custom-model-delete-btn"
                  title={pack.buttons.deleteModel}
                  onClick={() => {
                    handleDelete(model.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
