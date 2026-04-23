import type {
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages/messages';

import {
  executeToolCall,
  buildInitialContext,
  toAnthropicTools,
} from '../agent-tools';
import {
  CancellationSignal,
  throwIfCancellationRequested,
} from '../cancellation';
import { GitOperations } from '../commit-copilot';
import {
  APIKeyMissingError,
  APIKeyInvalidError,
  APIQuotaExceededError,
  APIRequestError,
  GenerationCancelledError,
  NoChangesError,
  createEmptyFinalResponseError,
  createEmptyResponseError,
  createTruncatedFinalResponseError,
  createTruncatedResponseError,
  createUnknownAnthropicModelError,
} from '../errors';
import { LOCALES } from '../i18n/locales';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import { ProgressCallback } from '../llm-clients';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_MODELS,
  getAnthropicModelMaxTokens,
  normalizeCommitOutputOptions,
} from '../models';
import { DEFAULT_RETRY_OPTIONS, RetryInfo, withRetry } from '../retry';

import {
  buildAgentSystemPrompt,
  buildFinalOutputReminder,
  extractCommitMessage,
  formatBatchProgressMessage,
} from './shared';

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

const millisecondsPerSecond = 1000;
const unauthorizedStatus = 401;
const forbiddenStatus = 403;
const tooManyRequestsStatus = 429;

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
    isRecord(block) && block.type === 'text' && typeof block.text === 'string'
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

function resolveStepLimit(maxAgentSteps: number | undefined): number {
  return maxAgentSteps && maxAgentSteps > 0
    ? maxAgentSteps
    : Number.POSITIVE_INFINITY;
}

function splitResponseBlocks(response: { content: unknown }): {
  textBlocks: AnthropicTextBlock[];
  toolUseBlocks: AnthropicToolUseBlock[];
} {
  const responseContent = Array.isArray(response.content)
    ? response.content
    : [];
  return {
    textBlocks: responseContent.filter((block) => isAnthropicTextBlock(block)),
    toolUseBlocks: responseContent.filter((block) =>
      isAnthropicToolUseBlock(block),
    ),
  };
}

async function executeToolUseBlocks(params: {
  toolUseBlocks: AnthropicToolUseBlock[];
  repoRoot: string;
  diff: string;
  isStaged: boolean;
  gitOps?: GitOperations;
  cancellationToken?: CancellationSignal;
}): Promise<ToolResultBlockParam[]> {
  const toolResults: ToolResultBlockParam[] = [];
  for (const block of params.toolUseBlocks) {
    throwIfCancellationRequested(params.cancellationToken);
    const result = await executeToolCall(
      { name: block.name, arguments: block.input },
      params.repoRoot,
      params.diff,
      params.isStaged,
      params.gitOps,
    );
    toolResults.push({
      type: 'tool_result',
      tool_use_id: block.id,
      content: result.content,
    });
  }
  return toolResults;
}

async function executeAnthropicInvestigationLoop(params: {
  messages: MessageParam[];
  stepLimit: number;
  requestResponse: (messages: MessageParam[]) => Promise<{
    content: unknown;
    stop_reason: string | null;
  }>;
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
  repoRoot: string;
  diff: string;
  isStaged: boolean;
  gitOps?: GitOperations;
  cancellationToken?: CancellationSignal;
}): Promise<string | null> {
  let step = 0;
  while (step < params.stepLimit) {
    throwIfCancellationRequested(params.cancellationToken);
    const response = await params.requestResponse(params.messages);
    const { textBlocks, toolUseBlocks } = splitResponseBlocks(response);

    const isCompleteTextResponse =
      toolUseBlocks.length === 0 &&
      (response.stop_reason === 'end_turn' ||
        response.stop_reason === 'stop_sequence');
    if (isCompleteTextResponse) {
      const text = textBlocks.map((block) => block.text).join('');
      if (!text) {
        throw createEmptyResponseError('Anthropic API');
      }
      return extractCommitMessage(text);
    }

    if (toolUseBlocks.length === 0 && response.stop_reason === 'max_tokens') {
      throw createTruncatedResponseError(
        'Anthropic API',
        'stop_reason=max_tokens',
      );
    }

    params.messages.push({
      role: 'assistant',
      content: response.content as MessageParam['content'],
    });
    if (params.onProgress && toolUseBlocks.length > 0) {
      params.onProgress(
        formatBatchProgressMessage(
          step + 1,
          toolUseBlocks.map((block) => ({
            name: block.name,
            args: block.input,
          })),
          params.language,
        ),
      );
    }

    const toolResults = await executeToolUseBlocks({
      toolUseBlocks,
      repoRoot: params.repoRoot,
      diff: params.diff,
      isStaged: params.isStaged,
      gitOps: params.gitOps,
      cancellationToken: params.cancellationToken,
    });
    params.messages.push({ role: 'user', content: toolResults });
    step += 1;
  }

  return null;
}

function throwMappedAnthropicError(error: unknown): never {
  const message = getAnthropicErrorMessage(error);
  const status = getAnthropicErrorStatus(error);
  if (
    status === unauthorizedStatus ||
    status === forbiddenStatus ||
    message.includes('invalid_api_key')
  ) {
    throw new APIKeyInvalidError(message);
  }
  if (status === tooManyRequestsStatus || message.includes('rate_limit')) {
    throw new APIQuotaExceededError(message);
  }
  throw new APIRequestError(message);
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
    const anthropicClientClass = (await import('@anthropic-ai/sdk')).default;
    const client = new anthropicClientClass({ apiKey });
    const modelName = pickNonEmpty(model, DEFAULT_MODELS.anthropic);
    const maxTokens = getAnthropicModelMaxTokens(modelName);
    if (maxTokens === undefined) {
      throw createUnknownAnthropicModelError(modelName);
    }
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

    const messages: MessageParam[] = [
      { role: 'user', content: initialContext },
    ];

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
              Math.ceil(delayMs / millisecondsPerSecond),
            ),
          );
        }
      },
    };

    const requestResponse = (currentMessages: MessageParam[]) =>
      withRetry(
        () =>
          client.messages
            .stream({
              model: modelName,
              max_tokens: maxTokens,
              system: systemPrompt,
              messages: currentMessages,
              tools: toAnthropicTools(isStaged) as unknown as Tool[],
            })
            .finalMessage(),
        retryOptions,
      );
    const loopResult = await executeAnthropicInvestigationLoop({
      messages,
      stepLimit: resolveStepLimit(maxAgentSteps),
      requestResponse,
      onProgress,
      language,
      repoRoot,
      diff,
      isStaged,
      gitOps,
      cancellationToken,
    });
    if (loopResult) {
      return loopResult;
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
      throw createTruncatedFinalResponseError(
        'Anthropic API',
        'stop_reason=max_tokens',
      );
    }

    if (!text) {
      throw createEmptyFinalResponseError('Anthropic API');
    }
    return extractCommitMessage(text);
  } catch (error: unknown) {
    if (
      error instanceof NoChangesError ||
      error instanceof APIKeyMissingError ||
      error instanceof GenerationCancelledError
    ) {
      throw error;
    }
    throwMappedAnthropicError(error);
  }
}

export { runAnthropicAgentLoop };
