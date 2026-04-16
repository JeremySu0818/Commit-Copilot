import React, { useCallback, useMemo } from 'react';
import { useSidePanel } from '../side-panel-context';
import { BackIcon } from '../components/BackIcon';
import { renderStatusHtml } from '../utils';

export function AddProviderView() {
  const { state, dispatch, vscode, bootstrap } = useSidePanel();
  const { currentPack: pack, addProviderDraft: draft } = state;
  const isEditing = !!draft.editingId;

  const saveDisabled = useMemo(() => {
    const name = draft.name.trim();
    const url = draft.baseUrl.trim();
    const hasName = !!name;
    const hasUrl = !!url;
    const hasKey = !!draft.apiKey.trim() || !!draft.editingId;
    const hasChanges =
      !draft.editingId ||
      name !== draft.originalName ||
      url !== draft.originalBaseUrl;
    return !(hasName && hasUrl && hasKey && hasChanges);
  }, [draft]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_SCREEN', screen: 'main' });
    vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
  }, [dispatch, vscode]);

  const handleSave = useCallback(() => {
    const name = draft.name.trim();
    const baseUrl = draft.baseUrl.trim();
    const apiKey = draft.apiKey.trim();

    if (!name) {
      dispatch({
        type: 'UPDATE_ADD_PROVIDER_DRAFT',
        partial: {
          statusHtml: renderStatusHtml(
            'error',
            pack.statuses.providerNameRequired,
          ),
        },
      });
      return;
    }
    if (!baseUrl) {
      dispatch({
        type: 'UPDATE_ADD_PROVIDER_DRAFT',
        partial: {
          statusHtml: renderStatusHtml('error', pack.statuses.baseUrlRequired),
        },
      });
      return;
    }

    const allNames = Object.values(bootstrap.providers).map((n) =>
      n.toLowerCase(),
    );
    state.customProviders.forEach((cp) => {
      if (cp.id !== draft.editingId) {
        allNames.push(cp.name.toLowerCase());
      }
    });
    if (allNames.includes(name.toLowerCase())) {
      dispatch({
        type: 'UPDATE_ADD_PROVIDER_DRAFT',
        partial: {
          statusHtml: renderStatusHtml(
            'error',
            pack.statuses.providerNameConflict,
          ),
        },
      });
      return;
    }

    dispatch({
      type: 'UPDATE_ADD_PROVIDER_DRAFT',
      partial: {
        statusHtml: renderStatusHtml('warning', pack.statuses.validating),
      },
    });
    vscode.postMessage({
      type: 'saveCustomProvider',
      name,
      baseUrl,
      apiKey,
      editId: draft.editingId ?? null,
    });
  }, [
    draft,
    pack,
    bootstrap.providers,
    state.customProviders,
    dispatch,
    vscode,
  ]);

  const handleDelete = useCallback(() => {
    if (draft.editingId) {
      vscode.postMessage({ type: 'deleteCustomProvider', id: draft.editingId });
    }
  }, [draft.editingId, vscode]);

  return (
    <div
      id="addProviderView"
      className={`container${state.screen !== 'addProvider' ? ' hidden' : ''}`}
    >
      <div className="settings-header">
        <button
          id="addProviderBackBtn"
          className="icon-btn"
          title={pack.buttons.back}
          onClick={handleBack}
        >
          <BackIcon />
        </button>
      </div>
      <div className="config-section">
        <div className="section-title">
          {isEditing ? pack.sections.editProvider : pack.sections.addProvider}
        </div>
        <div
          className="provider-info"
          dangerouslySetInnerHTML={{
            __html: pack.descriptions.customProviderInfo,
          }}
        />
        <div className="input-group" style={{ marginTop: '10px' }}>
          <label>{pack.labels.providerName}</label>
          <input
            type="text"
            id="providerNameInput"
            value={draft.name}
            onChange={(e) => {
              dispatch({
                type: 'UPDATE_ADD_PROVIDER_DRAFT',
                partial: { name: e.target.value },
              });
            }}
          />
        </div>
        <div className="input-group" style={{ marginTop: '10px' }}>
          <label>{pack.labels.apiBaseUrl}</label>
          <input
            type="text"
            id="apiBaseUrlInput"
            value={draft.baseUrl}
            onChange={(e) => {
              dispatch({
                type: 'UPDATE_ADD_PROVIDER_DRAFT',
                partial: { baseUrl: e.target.value },
              });
            }}
          />
        </div>
        <div
          className="input-group"
          id="customApiKeyGroup"
          style={{ marginTop: '10px', display: isEditing ? 'none' : undefined }}
        >
          <label>{pack.labels.apiKey}</label>
          <input
            type="password"
            id="customApiKeyInput"
            value={draft.apiKey}
            onChange={(e) => {
              dispatch({
                type: 'UPDATE_ADD_PROVIDER_DRAFT',
                partial: { apiKey: e.target.value },
              });
            }}
          />
        </div>
        <span
          id="addProviderStatus"
          className="status"
          dangerouslySetInnerHTML={{ __html: draft.statusHtml }}
        />
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <button
            id="saveProviderBtn"
            disabled={saveDisabled}
            onClick={handleSave}
          >
            {pack.buttons.save}
          </button>
          <button
            id="deleteProviderBtn"
            className={`secondary${!isEditing ? ' hidden' : ''}`}
            onClick={handleDelete}
          >
            {pack.buttons.deleteProvider}
          </button>
        </div>
      </div>
    </div>
  );
}
