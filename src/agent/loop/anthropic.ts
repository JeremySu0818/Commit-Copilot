import type {
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages/messages';

import type { GitOperations } from '../../git/git-operations';
import type { EffectiveDisplayLanguage } from '../../i18n/types';
import { LOCALES } from '../../i18n/ui';
import { DEFAULT_MODELS } from '../../llm/provider-registry';
import { getAnthropicModelMaxTokens } from '../../models/catalog';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  normalizeCommitOutputOptions,
} from '../../models/options';
import {
  CancellationSignal,
  throwIfCancellationRequested,
} from '../../shared/cancellation';
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
} from '../../shared/errors';
import type { ProgressCallback } from '../../shared/progress';
import {
  DEFAULT_RETRY_OPTIONS,
  RetryInfo,
  RetryOptions,
  withRetry,
} from '../../shared/retry';
import { buildInitialContext } from '../tools/context';
import { toAnthropicTools } from '../tools/definitions';
import { executeToolCall } from '../tools/executors/execute-tool-call';

import {
  buildAgentSystemPrompt,
  buildFinalOutputReminder,
  buildFinalToolRequiredReminder,
  extractCommitMessage,
  extractFinalCommitMessageFromArgs,
  FINAL_COMMIT_MESSAGE_TOOL_NAME,
  formatBatchProgressMessage,
} from './shared';
import type { AgentLoopOptions } from './types';

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

interface AnthropicAgentResponse {
  content: unknown;
  stop_reason: string | null;
}

type AnthropicMessageRequester = (
  messages: MessageParam[],
) => Promise<AnthropicAgentResponse>;

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
  return isRecord(error) ? error : {};
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

function handleAnthropicTextResponse(params: {
  response: AnthropicAgentResponse;
  textBlocks: AnthropicTextBlock[];
  messages: MessageParam[];
  commitOutputOptions: CommitOutputOptions;
  commitMessageLanguage: EffectiveDisplayLanguage;
  finalToolReminderSent: boolean;
}): { finalMessage?: string; remindFinalTool: boolean } {
  const text = params.textBlocks.map((block) => block.text).join('');
  if (!text) {
    throw createEmptyResponseError('Anthropic API');
  }
  if (params.finalToolReminderSent) {
    return { finalMessage: extractCommitMessage(text), remindFinalTool: false };
  }
  params.messages.push({
    role: 'assistant',
    content: params.response.content as MessageParam['content'],
  });
  params.messages.push({
    role: 'user',
    content: [
      {
        type: 'text',
        text: buildFinalToolRequiredReminder(
          params.commitOutputOptions,
          params.commitMessageLanguage,
        ),
      },
    ],
  });
  return { remindFinalTool: true };
}

async function handleAnthropicToolUseBatch(params: {
  response: AnthropicAgentResponse;
  toolUseBlocks: AnthropicToolUseBlock[];
  messages: MessageParam[];
  step: number;
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
  repoRoot: string;
  diff: string;
  isStaged: boolean;
  gitOps?: GitOperations;
  cancellationToken?: CancellationSignal;
}): Promise<string | null> {
  params.onProgress?.(
    formatBatchProgressMessage(
      params.step,
      params.toolUseBlocks.map((block) => ({
        name: block.name,
        args: block.input,
      })),
      params.language,
    ),
  );

  const finalToolUseBlock = params.toolUseBlocks.find(
    (block) => block.name === FINAL_COMMIT_MESSAGE_TOOL_NAME,
  );
  if (finalToolUseBlock) {
    const finalMessage = extractFinalCommitMessageFromArgs(
      finalToolUseBlock.input,
    );
    if (finalMessage) {
      return finalMessage;
    }
  }

  params.messages.push({
    role: 'assistant',
    content: params.response.content as MessageParam['content'],
  });
  const toolResults = await executeToolUseBlocks({
    toolUseBlocks: params.toolUseBlocks,
    repoRoot: params.repoRoot,
    diff: params.diff,
    isStaged: params.isStaged,
    gitOps: params.gitOps,
    cancellationToken: params.cancellationToken,
  });
  params.messages.push({ role: 'user', content: toolResults });
  return null;
}

async function executeAnthropicInvestigationLoop(params: {
  messages: MessageParam[];
  stepLimit: number;
  requestResponse: (
    messages: MessageParam[],
  ) => Promise<AnthropicAgentResponse>;
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
  repoRoot: string;
  diff: string;
  isStaged: boolean;
  gitOps?: GitOperations;
  cancellationToken?: CancellationSignal;
  commitOutputOptions: CommitOutputOptions;
  commitMessageLanguage: EffectiveDisplayLanguage;
  progressState: { nextStep: number };
}): Promise<string | null> {
  let step = 0;
  let finalToolReminderSent = false;
  while (step < params.stepLimit) {
    throwIfCancellationRequested(params.cancellationToken);
    const response = await params.requestResponse([...params.messages]);
    const { textBlocks, toolUseBlocks } = splitResponseBlocks(response);

    const isCompleteTextResponse =
      toolUseBlocks.length === 0 &&
      (response.stop_reason === 'end_turn' ||
        response.stop_reason === 'stop_sequence');
    if (isCompleteTextResponse) {
      const textResult = handleAnthropicTextResponse({
        response,
        textBlocks,
        messages: params.messages,
        commitOutputOptions: params.commitOutputOptions,
        commitMessageLanguage: params.commitMessageLanguage,
        finalToolReminderSent,
      });
      if (textResult.finalMessage) {
        return textResult.finalMessage;
      }
      if (textResult.remindFinalTool) {
        finalToolReminderSent = true;
        step += 1;
        continue;
      }
    }

    if (toolUseBlocks.length === 0 && response.stop_reason === 'max_tokens') {
      throw createTruncatedResponseError(
        'Anthropic API',
        'stop_reason=max_tokens',
      );
    }

    const finalMessage = await handleAnthropicToolUseBatch({
      response,
      toolUseBlocks,
      messages: params.messages,
      step: params.progressState.nextStep,
      onProgress: params.onProgress,
      language: params.language,
      repoRoot: params.repoRoot,
      diff: params.diff,
      isStaged: params.isStaged,
      gitOps: params.gitOps,
      cancellationToken: params.cancellationToken,
    });
    if (finalMessage) {
      return finalMessage;
    }
    params.progressState.nextStep += 1;
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

function createAnthropicRetryOptions(params: {
  cancellationToken?: CancellationSignal;
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
}): RetryOptions {
  return {
    ...DEFAULT_RETRY_OPTIONS,
    checkAbort: () => {
      throwIfCancellationRequested(params.cancellationToken);
    },
    onRetry: ({ attempt, maxAttempts, delayMs }: RetryInfo) => {
      if (params.onProgress) {
        const nextAttempt = attempt + 1;
        params.onProgress(
          LOCALES[params.language].progressMessages.transientApiError(
            nextAttempt,
            maxAttempts,
            Math.ceil(delayMs / millisecondsPerSecond),
          ),
        );
      }
    },
  };
}

function createAnthropicResponseRequester(params: {
  requestMessage: AnthropicMessageRequester;
  retryOptions: RetryOptions;
}) {
  return (messages: MessageParam[]) =>
    withRetry(() => params.requestMessage(messages), params.retryOptions);
}

async function requestAnthropicFinalCommitMessage(params: {
  requestResponse: (
    messages: MessageParam[],
  ) => Promise<AnthropicAgentResponse>;
  messages: MessageParam[];
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
  progressStep: number;
}): Promise<string> {
  const finalResponse = await params.requestResponse(params.messages);
  const finalResponseContent = Array.isArray(finalResponse.content)
    ? finalResponse.content
    : [];
  const finalToolUseBlock = finalResponseContent
    .filter((block) => isAnthropicToolUseBlock(block))
    .find((block) => block.name === FINAL_COMMIT_MESSAGE_TOOL_NAME);
  if (finalToolUseBlock) {
    params.onProgress?.(
      formatBatchProgressMessage(
        params.progressStep,
        [
          {
            name: finalToolUseBlock.name,
            args: finalToolUseBlock.input,
          },
        ],
        params.language,
      ),
    );
    const finalCommitMessage = extractFinalCommitMessageFromArgs(
      finalToolUseBlock.input,
    );
    if (finalCommitMessage) {
      return finalCommitMessage;
    }
  }
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
}

async function runAnthropicAgentLoop(
  options: AgentLoopOptions,
): Promise<string> {
  const {
    apiKey,
    model,
    diff,
    repoRoot,
    onProgress,
    isStaged = true,
    gitOps,
    commitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
    cancellationToken,
    maxAgentSteps,
    draftCommitMessage,
    language = 'en',
    commitMessageLanguage = 'en',
    baseUrl,
    maxTokens: configuredMaxTokens,
  } = options;
  throwIfCancellationRequested(cancellationToken);
  if (!apiKey) {
    throw new APIKeyMissingError();
  }
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  try {
    const anthropicClientClass = (await import('@anthropic-ai/sdk')).default;
    const client = new anthropicClientClass({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
    const modelName = pickNonEmpty(model, DEFAULT_MODELS.anthropic);
    const maxTokens =
      typeof configuredMaxTokens === 'number'
        ? configuredMaxTokens
        : baseUrl
          ? undefined
          : getAnthropicModelMaxTokens(modelName);
    if (!baseUrl && maxTokens === undefined) {
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
      draftCommitMessage,
      commitMessageLanguage,
    );
    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
      commitOutputOptions: resolvedCommitOutputOptions,
      maxAgentSteps,
      language: commitMessageLanguage,
    });

    const messages: MessageParam[] = [
      { role: 'user', content: initialContext },
    ];

    if (onProgress) {
      onProgress(LOCALES[language].progressMessages.analyzingChanges);
    }

    const retryOptions = createAnthropicRetryOptions({
      cancellationToken,
      onProgress,
      language,
    });
    const requestMessage: AnthropicMessageRequester = async (
      currentMessages,
    ) => {
      const requestParams: Record<string, unknown> = {
        model: modelName,
        system: systemPrompt,
        messages: currentMessages,
        tools: toAnthropicTools(
          isStaged,
          commitMessageLanguage,
        ) as unknown as Tool[],
      };
      if (typeof maxTokens === 'number') {
        requestParams.max_tokens = maxTokens;
      }
      const response = await client.messages
        .stream(requestParams as Parameters<typeof client.messages.stream>[0])
        .finalMessage();
      return {
        content: response.content,
        stop_reason: response.stop_reason,
      };
    };
    const requestResponse = createAnthropicResponseRequester({
      requestMessage,
      retryOptions,
    });
    const progressState = { nextStep: 1 };
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
      commitOutputOptions: resolvedCommitOutputOptions,
      commitMessageLanguage,
      progressState,
    });
    if (loopResult) {
      return loopResult;
    }

    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: buildFinalOutputReminder(
            resolvedCommitOutputOptions,
            commitMessageLanguage,
          ),
        },
      ],
    });
    throwIfCancellationRequested(cancellationToken);

    return await requestAnthropicFinalCommitMessage({
      requestResponse,
      messages,
      onProgress,
      language,
      progressStep: progressState.nextStep,
    });
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
