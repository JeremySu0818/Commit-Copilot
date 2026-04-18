import React, { useCallback } from 'react';

import { BackIcon } from '../components/BackIcon';
import { useSidePanel } from '../side-panel-context';
import { renderStatusHtml } from '../utils';

export function RewriteEditorView() {
  const { state, dispatch, vscode } = useSidePanel();
  const { currentPack: pack, rewriteEditorDraft } = state;

  const returnToMain = useCallback(() => {
    dispatch({ type: 'SET_SCREEN', screen: 'main' });
    dispatch({ type: 'RESET_REWRITE_EDITOR_DRAFT' });
    vscode.postMessage({ type: 'setCurrentScreen', value: 'main' });
  }, [dispatch, vscode]);

  const handleCancel = useCallback(() => {
    if (rewriteEditorDraft.requestId) {
      vscode.postMessage({
        type: 'cancelRewriteEditor',
        requestId: rewriteEditorDraft.requestId,
      });
    }
    returnToMain();
  }, [rewriteEditorDraft.requestId, returnToMain, vscode]);

  const handleConfirm = useCallback(() => {
    if (!rewriteEditorDraft.requestId) {
      returnToMain();
      return;
    }
    if (!rewriteEditorDraft.message.trim()) {
      dispatch({
        type: 'UPDATE_REWRITE_EDITOR_DRAFT',
        partial: {
          statusHtml: renderStatusHtml(
            'error',
            'Commit message cannot be empty.',
          ),
        },
      });
      return;
    }
    vscode.postMessage({
      type: 'submitRewriteEditor',
      requestId: rewriteEditorDraft.requestId,
      value: rewriteEditorDraft.message,
    });
    returnToMain();
  }, [
    rewriteEditorDraft.requestId,
    rewriteEditorDraft.message,
    returnToMain,
    dispatch,
    vscode,
  ]);

  return (
    <div
      id="rewriteEditorView"
      className={`container${state.screen !== 'rewriteEditor' ? ' hidden' : ''}`}
    >
      <div className="settings-header">
        <button
          id="rewriteEditorBackBtn"
          className="icon-btn"
          title={pack.buttons.back}
          onClick={handleCancel}
        >
          <BackIcon />
        </button>
      </div>

      <div className="config-section">
        <div className="section-title">
          Rewrite{' '}
          {rewriteEditorDraft.targetCommitShortHash ||
            'Selected Commit Message'}
        </div>
        <div className="provider-info">
          Review and confirm the new commit message.
        </div>
        <div className="input-group" style={{ marginTop: '10px' }}>
          <label>Commit Message</label>
          <textarea
            id="rewriteEditorTextarea"
            className="rewrite-editor-textarea"
            value={rewriteEditorDraft.message}
            onChange={(event) => {
              dispatch({
                type: 'UPDATE_REWRITE_EDITOR_DRAFT',
                partial: {
                  message: event.target.value,
                  statusHtml: '',
                },
              });
            }}
            spellCheck={false}
          />
          <span
            id="rewriteEditorStatus"
            className={`status${!rewriteEditorDraft.statusHtml ? ' hidden' : ''}`}
            dangerouslySetInnerHTML={{ __html: rewriteEditorDraft.statusHtml }}
          />
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <button id="confirmRewriteEditorBtn" onClick={handleConfirm}>
            Confirm Rewrite
          </button>
          <button
            id="cancelRewriteEditorBtn"
            className="secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
