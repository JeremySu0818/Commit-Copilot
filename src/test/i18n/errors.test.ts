import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getLocalizedCommitCopilotErrorMessage } from '../../i18n';
import { LOCALES } from '../../i18n/ui';
import {
  APIRequestError,
  CommitCopilotError,
  createGenerationRequestError,
  EXIT_CODES,
} from '../../shared/errors';
import { TEST_MODELS as DEFAULT_MODELS } from '../helpers/model-fixtures';

void test('generation HTTP 400 has actionable translated guidance and retains diagnostic details', () => {
  const badRequestStatus = 400;
  const details = 'Unsupported tool configuration: private upstream diagnostic';
  for (const shape of [
    { status: badRequestStatus },
    { statusCode: String(badRequestStatus) },
    { response: { status: badRequestStatus } },
    { code: badRequestStatus },
  ]) {
    const error = createGenerationRequestError({ ...shape, message: details });
    assert.equal(error.messageKey, 'api.modelCompatibility');
    assert.match(error.message, /private upstream diagnostic/);
    for (const language of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
      const message = getLocalizedCommitCopilotErrorMessage(language, error);
      assert.ok(message);
      assert.doesNotMatch(
        message,
        /private upstream diagnostic|api\.modelCompatibility/,
      );
    }
    assert.equal(
      getLocalizedCommitCopilotErrorMessage('zh-TW', error),
      '所選模型可能不支援目前的生成模式或請求設定。請嘗試其他模型。',
    );
  }
});

void test('non-400 errors and existing structured errors retain their semantics', () => {
  const forbidden = 403;
  assert.equal(
    createGenerationRequestError({ status: forbidden, message: 'forbidden' })
      .messageKey,
    'api.requestFailed',
  );
  assert.equal(
    createGenerationRequestError(new Error('file 400.txt missing')).messageKey,
    'api.requestFailed',
  );
  const existing = new APIRequestError('truncated', {
    messageKey: 'api.responseTruncated',
  });
  assert.equal(createGenerationRequestError(existing), existing);
});

void test('getLocalizedCommitCopilotErrorMessage localizes structured API errors', () => {
  const error = new CommitCopilotError(
    `Unknown Anthropic model "${DEFAULT_MODELS.anthropic}".`,
    'API_ERROR',
    EXIT_CODES.API_ERROR,
    {
      messageKey: 'api.unknownAnthropicModel',
      messageArgs: { model: DEFAULT_MODELS.anthropic },
    },
  );

  const message = getLocalizedCommitCopilotErrorMessage('zh-TW', error);

  assert.equal(
    message,
    `未知的 Anthropic 模型「${DEFAULT_MODELS.anthropic}」。請將它加入 ANTHROPIC_MODELS 並設定 max_tokens。`,
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
