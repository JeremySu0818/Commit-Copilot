import {
  executeToolCall,
  buildInitialContext,
  toAnthropicTools,
} from '../agent-tools';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_MODELS,
  getAnthropicModelMaxTokens,
  normalizeCommitOutputOptions,
} from '../models';
import {
  APIKeyMissingError,
  APIKeyInvalidError,
  APIQuotaExceededError,
  APIRequestError,
  GenerationCancelledError,
  NoChangesError,
} from '../errors';
import { ProgressCallback } from '../llm-clients';
import { GitOperations } from '../commit-copilot';
import {
  CancellationSignal,
  throwIfCancellationRequested,
} from '../cancellation';
import {
  buildAgentSystemPrompt,
  buildFinalOutputReminder,
  extractCommitMessage,
  formatBatchProgressMessage,
} from './shared';
import { DEFAULT_RETRY_OPTIONS, RetryInfo, withRetry } from '../retry';
import { LOCALES } from '../i18n/locales';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import type {
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages/messages';

type UnknownRecord = Record<string, unknown>;

interface ErrorLike {
  status?: unknown;
  message?: unknown;
}

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function pickNonEmpty(primary: string | undefined, fallback: string): string {
  return primary && primary.length > 0 ? primary : fallback;
}

function toErrorLike(error: unknown): ErrorLike {
  return isRecord(error) ? (error as ErrorLike) : {};
}

function isAnthropicTextBlock(block: unknown): block is AnthropicTextBlock {
  return (
    isRecord(block) &&
    block.type === 'text' &&
    typeof block.text === 'string'
  );
}

function isAnthropicToolUseBlock(
  block: unknown,
): block is AnthropicToolUseBlock {
  return (
    isRecord(block) &&
    block.type === 'tool_use' &&
    typeof block.id === 'string' &&
    typeof block.name === 'string' &&
    isRecord(block.input)
  );
}

function getAnthropicErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  const candidate = toErrorLike(error);
  return asString(candidate.message) ?? String(error);
}

function getAnthropicErrorStatus(error: unknown): number | null {
  const status = toErrorLike(error).status;
  return typeof status === 'number' ? status : null;
}

async function runAnthropicAgentLoop(
  apiKey: string,
  model: string | undefined,
  diff: string,
  repoRoot: string,
  onProgress?: ProgressCallback,
  isStaged = true,
  gitOps?: GitOperations,
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  cancellationToken?: CancellationSignal,
  maxAgentSteps?: number,
  language: EffectiveDisplayLanguage = 'en',
): Promise<string> {
  throwIfCancellationRequested(cancellationToken);
  if (!apiKey) {
    throw new APIKeyMissingError();
  }
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const modelName = pickNonEmpty(model, DEFAULT_MODELS.anthropic);
    const maxTokens = getAnthropicModelMaxTokens(modelName) ?? 16384;
    const resolvedCommitOutputOptions =
      normalizeCommitOutputOptions(commitOutputOptions);

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
      true,
      resolvedCommitOutputOptions,
    );
    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
      commitOutputOptions: resolvedCommitOutputOptions,
      maxAgentSteps,
    });

    const messages: MessageParam[] = [{ role: 'user', content: initialContext }];

    if (onProgress) {
      onProgress(LOCALES[language].progressMessages.analyzingChanges);
    }

    const retryOptions = {
      ...DEFAULT_RETRY_OPTIONS,
      checkAbort: () => {
        throwIfCancellationRequested(cancellationToken);
      },
      onRetry: ({ attempt, maxAttempts, delayMs }: RetryInfo) => {
        if (onProgress) {
          const nextAttempt = attempt + 1;
          onProgress(
            LOCALES[language].progressMessages.transientApiError(
              nextAttempt,
              maxAttempts,
              Math.ceil(delayMs / 1000),
            ),
          );
        }
      },
    };

    let step = 0;
    const stepLimit =
      maxAgentSteps && maxAgentSteps > 0 ? maxAgentSteps : Number.POSITIVE_INFINITY;

    while (step < stepLimit) {
      throwIfCancellationRequested(cancellationToken);
      const response = await withRetry(
        () =>
          client.messages
            .stream({
              model: modelName,
              max_tokens: maxTokens,
              system: systemPrompt,
              messages,
              tools: toAnthropicTools(isStaged) as unknown as Tool[],
            })
            .finalMessage(),
        retryOptions,
      );

      const responseContent = Array.isArray(response.content)
        ? response.content
        : [];
      const textBlocks = responseContent.filter((block) =>
        isAnthropicTextBlock(block),
      );
      const toolUseBlocks = responseContent.filter((block) =>
        isAnthropicToolUseBlock(block),
      );

      const stopReason = response.stop_reason;
      const hasNoToolCalls = toolUseBlocks.length === 0;
      const isCompleteTextResponse =
        hasNoToolCalls &&
        (stopReason === 'end_turn' || stopReason === 'stop_sequence');

      if (isCompleteTextResponse) {
        const text = textBlocks.map((block) => block.text).join('');
        if (!text) {
          throw new APIRequestError('Empty response from Anthropic API');
        }
        return extractCommitMessage(text);
      }

      if (hasNoToolCalls && stopReason === 'max_tokens') {
        throw new APIRequestError(
          'Anthropic response was truncated (stop_reason=max_tokens)',
        );
      }

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: ToolResultBlockParam[] = [];
      if (onProgress && toolUseBlocks.length > 0) {
        const calls = toolUseBlocks.map((block) => ({
          name: block.name,
          args: block.input,
        }));
        onProgress(formatBatchProgressMessage(step + 1, calls, language));
      }

      for (const block of toolUseBlocks) {
        throwIfCancellationRequested(cancellationToken);
        const result = await executeToolCall(
          { name: block.name, arguments: block.input },
          repoRoot,
          diff,
          isStaged,
          gitOps,
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result.content,
        });
      }

      messages.push({ role: 'user', content: toolResults });
      step++;
    }

    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: buildFinalOutputReminder(resolvedCommitOutputOptions),
        },
      ],
    });
    throwIfCancellationRequested(cancellationToken);

    const finalResponse = await withRetry(
      () =>
        client.messages
          .stream({
            model: modelName,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
          })
          .finalMessage(),
      retryOptions,
    );
    const finalResponseContent = Array.isArray(finalResponse.content)
      ? finalResponse.content
      : [];
    const text = finalResponseContent
      .filter((block) => isAnthropicTextBlock(block))
      .map((block) => block.text)
      .join('');

    if (finalResponse.stop_reason === 'max_tokens') {
      throw new APIRequestError(
        'Anthropic final response was truncated (stop_reason=max_tokens)',
      );
    }

    return text ? extractCommitMessage(text) : 'chore(project): update files';
  } catch (error: unknown) {
    if (
      error instanceof NoChangesError ||
      error instanceof APIKeyMissingError ||
      error instanceof GenerationCancelledError
    ) {
      throw error;
    }
    const message = getAnthropicErrorMessage(error);
    const status = getAnthropicErrorStatus(error);
    if (
      status === 401 ||
      status === 403 ||
      message.includes('invalid_api_key')
    ) {
      throw new APIKeyInvalidError(message);
    } else if (status === 429 || message.includes('rate_limit')) {
      throw new APIQuotaExceededError(message);
    }
    throw new APIRequestError(message);
  }
}

export { runAnthropicAgentLoop };
