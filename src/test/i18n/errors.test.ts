import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getLocalizedCommitCopilotErrorMessage } from '../../i18n';
import { CommitCopilotError, EXIT_CODES } from '../../shared/errors';

void test('getLocalizedCommitCopilotErrorMessage localizes structured API errors', () => {
  const error = new CommitCopilotError(
    'Unknown Anthropic model "claude-test".',
    'API_ERROR',
    EXIT_CODES.API_ERROR,
    {
      messageKey: 'api.unknownAnthropicModel',
      messageArgs: { model: 'claude-test' },
    },
  );

  const message = getLocalizedCommitCopilotErrorMessage('zh-TW', error);

  assert.equal(
    message,
    '未知的 Anthropic 模型「claude-test」。請將它加入 ANTHROPIC_MODELS 並設定 max_tokens。',
  );
  assert.doesNotMatch(message, /Unknown Anthropic model/i);
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
