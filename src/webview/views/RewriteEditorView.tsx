import React, { useCallback } from 'react';

import { BackIcon } from '../components/BackIcon';
import { StatusMessageView } from '../components/StatusMessageView';
import { useMainViewContext } from '../main-view-context';

export function RewriteEditorView() {
  const { state, dispatch, vscode } = useMainViewContext();
  const { currentPack: pack, rewriteEditorDraft } = state;
  const rewriteEditorStatus = rewriteEditorDraft.status
    ? {
        type: rewriteEditorDraft.status,
        text: rewriteEditorDraft.statusText,
      }
    : null;

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
          status: 'error',
          statusText: pack.statuses.commitMessageCannotBeEmpty,
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
    pack.statuses.commitMessageCannotBeEmpty,
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
          {pack.sections.rewriteEditor}{' '}
          {rewriteEditorDraft.targetCommitShortHash ||
            pack.labels.selectedCommitMessage}
        </div>
        <div className="provider-info">
          {pack.descriptions.rewriteEditorDescription}
        </div>
        <div className="input-group input-group-spaced">
          <label>{pack.labels.commitMessage}</label>
          <textarea
            id="rewriteEditorTextarea"
            className="rewrite-editor-textarea"
            value={rewriteEditorDraft.message}
            wrap="soft"
            onChange={(event) => {
              dispatch({
                type: 'UPDATE_REWRITE_EDITOR_DRAFT',
                partial: {
                  message: event.target.value,
                  status: null,
                  statusText: '',
                },
              });
            }}
            spellCheck={false}
          />
          <StatusMessageView
            id="rewriteEditorStatus"
            status={rewriteEditorStatus}
            hideWhenEmpty
          />
        </div>
        <div className="panel-actions">
          <button id="confirmRewriteEditorBtn" onClick={handleConfirm}>
            {pack.buttons.confirmRewrite}
          </button>
          <button
            id="cancelRewriteEditorBtn"
            className="secondary"
            onClick={handleCancel}
          >
            {pack.buttons.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
