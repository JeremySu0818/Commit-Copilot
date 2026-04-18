import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CommitCopilotError, EXIT_CODES } from '../errors';
import {
  getLocalizedCommitCopilotErrorMessage,
  getExtensionText,
} from '../i18n';

void test('getLocalizedCommitCopilotErrorMessage localizes rewrite commit not found', () => {
  const error = new CommitCopilotError(
    'Commit "abc123" was not found.',
    'REWRITE_COMMIT_NOT_FOUND',
    EXIT_CODES.UNKNOWN_ERROR,
    {
      messageKey: 'rewrite.commitNotFound',
      messageArgs: { commitHash: 'abc123' },
    },
  );

  const message = getLocalizedCommitCopilotErrorMessage('zh-TW', error);

  assert.equal(message, '找不到 commit "abc123"。');
  assert.doesNotMatch(message, /was not found/i);
});

void test('getLocalizedCommitCopilotErrorMessage reuses existing localized notification text', () => {
  const error = new CommitCopilotError(
    'Cannot rewrite commit history while modified (unstaged) changes are present. Please commit or stash them first.',
    'REWRITE_WORKSPACE_NOT_CLEAN',
    EXIT_CODES.UNKNOWN_ERROR,
    { messageKey: 'rewrite.workspaceNotCleanUnstaged' },
  );

  assert.equal(
    getLocalizedCommitCopilotErrorMessage('zh-TW', error),
    getExtensionText('zh-TW').notification.rewriteWorkspaceDirtyUnstaged,
  );
});

void test('getLocalizedCommitCopilotErrorMessage returns undefined for raw external errors', () => {
  const error = new CommitCopilotError(
    'Provider request failed.',
    'API_ERROR',
    EXIT_CODES.API_ERROR,
  );

  assert.equal(
    getLocalizedCommitCopilotErrorMessage('zh-TW', error),
    undefined,
  );
});
