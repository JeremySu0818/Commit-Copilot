import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from 'openai/resources/chat/completions';

import type { GitOperations } from '../../git/git-operations';
import type { EffectiveDisplayLanguage } from '../../i18n/types';
import { LOCALES } from '../../i18n/ui';
import { DEFAULT_MODELS } from '../../llm/provider-registry';
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
  createEmptyTextResponseError,
} from '../../shared/errors';
import type { ProgressCallback } from '../../shared/progress';
import {
  DEFAULT_RETRY_OPTIONS,
  RetryInfo,
  RetryOptions,
  withRetry,
} from '../../shared/retry';
import { buildInitialContext } from '../tools/context';
import { toOpenAITools } from '../tools/definitions';
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
  message?: unknown;
  status?: unknown;
}

const millisecondsPerSecond = 1000;
const unauthorizedStatus = 401;
const forbiddenStatus = 403;
const tooManyRequestsStatus = 429;

function toErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? error : {};
}

function pickNonEmpty(primary: string | undefined, fallback: string): string {
  return primary && primary.length > 0 ? primary : fallback;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

interface OpenAIFunctionToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

function isFunctionToolCall(value: unknown): value is OpenAIFunctionToolCall {
  return (
    isRecord(value) &&
    value.type === 'function' &&
    typeof value.id === 'string' &&
    isRecord(value.function) &&
    typeof value.function.name === 'string' &&
    typeof value.function.arguments === 'string'
  );
}

function getAssistantMessage(completion: unknown): UnknownRecord | null {
  if (!isRecord(completion) || !isUnknownArray(completion.choices)) {
    return null;
  }
  const firstChoice = completion.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }
  return firstChoice.message;
}

function getOpenAIMessageText(content: unknown): string | null {
  return typeof content === 'string' && content.length > 0 ? content : null;
}

function parseToolArguments(rawArguments: unknown): {
  args: Record<string, unknown>;
  error?: string;
} {
  if (typeof rawArguments !== 'string' || rawArguments.trim() === '') {
    return { args: {} };
  }

  try {
    const parsed: unknown = JSON.parse(rawArguments);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { args: parsed as Record<string, unknown> };
    }
    return {
      args: {},
      error: 'arguments must be a JSON object',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { args: {}, error: message };
  }
}

function resolveStepLimit(maxAgentSteps: number | undefined): number {
  return maxAgentSteps && maxAgentSteps > 0
    ? maxAgentSteps
    : Number.POSITIVE_INFINITY;
}

function getFunctionToolCalls(
  assistantMessage: UnknownRecord,
): OpenAIFunctionToolCall[] {
  const toolCalls = Array.isArray(assistantMessage.tool_calls)
    ? assistantMessage.tool_calls
    : [];
  return toolCalls.filter((toolCall) => isFunctionToolCall(toolCall));
}

interface ParsedOpenAIToolCall {
  toolCall: OpenAIFunctionToolCall;
  name: string;
  args: Record<string, unknown>;
  parseError?: string;
}

function parseOpenAIToolCalls(
  functionToolCalls: OpenAIFunctionToolCall[],
): ParsedOpenAIToolCall[] {
  return functionToolCalls.map((toolCall) => {
    const parsed = parseToolArguments(toolCall.function.arguments);
    return {
      toolCall,
      name: toolCall.function.name,
      args: parsed.args,
      parseError: parsed.error,
    };
  });
}

function handleOpenAITextOnlyResponse(params: {
  messages: ChatCompletionMessageParam[];
  commitOutputOptions: CommitOutputOptions;
  commitMessageLanguage: EffectiveDisplayLanguage;
  finalToolReminderSent: boolean;
  assistantMessageContent: unknown;
}): { finalMessage?: string; remindFinalTool: boolean } {
  const text = getOpenAIMessageText(params.assistantMessageContent);
  if (!text) {
    throw createEmptyTextResponseError('OpenAI API');
  }
  if (params.finalToolReminderSent) {
    return { finalMessage: extractCommitMessage(text), remindFinalTool: false };
  }

  params.messages.push({
    role: 'user',
    content: buildFinalToolRequiredReminder(
      params.commitOutputOptions,
      params.commitMessageLanguage,
    ),
  });
  return { remindFinalTool: true };
}

async function handleOpenAIToolCallBatch(params: {
  parsedToolCalls: ParsedOpenAIToolCall[];
  language: EffectiveDisplayLanguage;
  step: number;
  onProgress?: ProgressCallback;
  messages: ChatCompletionMessageParam[];
  repoRoot: string;
  diff: string;
  isStaged: boolean;
  gitOps?: GitOperations;
  cancellationToken?: CancellationSignal;
}): Promise<string | null> {
  params.onProgress?.(
    formatBatchProgressMessage(
      params.step,
      params.parsedToolCalls.map(({ name, args }) => ({ name, args })),
      params.language,
    ),
  );

  const finalToolCall = params.parsedToolCalls.find(
    (toolCall) =>
      toolCall.name === FINAL_COMMIT_MESSAGE_TOOL_NAME && !toolCall.parseError,
  );
  if (finalToolCall) {
    const finalMessage = extractFinalCommitMessageFromArgs(finalToolCall.args);
    if (finalMessage) {
      return finalMessage;
    }
  }

  await appendToolCallMessages(params.parsedToolCalls, {
    messages: params.messages,
    repoRoot: params.repoRoot,
    diff: params.diff,
    isStaged: params.isStaged,
    gitOps: params.gitOps,
    cancellationToken: params.cancellationToken,
  });
  return null;
}

async function appendToolCallMessages(
  parsedToolCalls: {
    toolCall: OpenAIFunctionToolCall;
    name: string;
    args: Record<string, unknown>;
    parseError?: string;
  }[],
  params: {
    messages: ChatCompletionMessageParam[];
    repoRoot: string;
    diff: string;
    isStaged: boolean;
    gitOps?: GitOperations;
    cancellationToken?: CancellationSignal;
  },
): Promise<void> {
  for (const parsedToolCall of parsedToolCalls) {
    throwIfCancellationRequested(params.cancellationToken);
    const { toolCall, name, args, parseError } = parsedToolCall;
    const content = parseError
      ? `Tool execution error: Invalid JSON arguments for ${name}: ${parseError}`
      : (
          await executeToolCall(
            { name, arguments: args },
            params.repoRoot,
            params.diff,
            params.isStaged,
            params.gitOps,
          )
        ).content;

    const toolMessage: ChatCompletionToolMessageParam = {
      role: 'tool',
      tool_call_id: toolCall.id,
      content,
    };
    params.messages.push(toolMessage);
  }
}

async function executeOpenAIInvestigationLoop(params: {
  messages: ChatCompletionMessageParam[];
  stepLimit: number;
  requestCompletionWithTools: (
    messages: ChatCompletionMessageParam[],
  ) => Promise<unknown>;
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
    const completion = await params.requestCompletionWithTools([
      ...params.messages,
    ]);
    const assistantMessage = getAssistantMessage(completion);
    if (!assistantMessage) {
      throw createEmptyResponseError('OpenAI API');
    }

    params.messages.push(
      assistantMessage as unknown as ChatCompletionMessageParam,
    );
    const functionToolCalls = getFunctionToolCalls(assistantMessage);
    if (functionToolCalls.length === 0) {
      const textResult = handleOpenAITextOnlyResponse({
        messages: params.messages,
        commitOutputOptions: params.commitOutputOptions,
        commitMessageLanguage: params.commitMessageLanguage,
        finalToolReminderSent,
        assistantMessageContent: assistantMessage.content,
      });
      if (textResult.finalMessage) {
        return textResult.finalMessage;
      }
      if (textResult.remindFinalTool) {
        finalToolReminderSent = true;
        step += 1;
        continue;
      }
    } else {
      const finalMessage = await handleOpenAIToolCallBatch({
        parsedToolCalls: parseOpenAIToolCalls(functionToolCalls),
        language: params.language,
        step: params.progressState.nextStep,
        onProgress: params.onProgress,
        messages: params.messages,
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
    }
    step += 1;
  }

  return null;
}

function throwMappedOpenAIError(error: unknown): never {
  const message =
    typeof toErrorLike(error).message === 'string'
      ? (toErrorLike(error).message as string)
      : String(error);
  const status = toErrorLike(error).status;

  if (
    status === unauthorizedStatus ||
    status === forbiddenStatus ||
    message.includes('Invalid API Key')
  ) {
    throw new APIKeyInvalidError(message);
  }
  if (status === tooManyRequestsStatus || message.includes('rate limit')) {
    throw new APIQuotaExceededError(message);
  }
  throw new APIRequestError(message);
}

function createOpenAIRetryOptions(params: {
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

type OpenAICompletionCreate = (
  request: ChatCompletionCreateParamsNonStreaming,
) => Promise<unknown>;

function createOpenAIRequestCompletionWithTools(params: {
  createCompletion: OpenAICompletionCreate;
  modelName: string;
  isStaged: boolean;
  retryOptions: RetryOptions;
  commitMessageLanguage: EffectiveDisplayLanguage;
}) {
  return (currentMessages: ChatCompletionMessageParam[]) =>
    withRetry(
      () =>
        params.createCompletion({
          model: params.modelName,
          messages: currentMessages,
          tools: toOpenAITools(
            params.isStaged,
            params.commitMessageLanguage,
          ) as unknown as ChatCompletionTool[],
          tool_choice: 'auto',
        }),
      params.retryOptions,
    );
}

async function requestOpenAIFinalCommitMessage(params: {
  createCompletion: OpenAICompletionCreate;
  modelName: string;
  messages: ChatCompletionMessageParam[];
  isStaged: boolean;
  retryOptions: RetryOptions;
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
  commitMessageLanguage: EffectiveDisplayLanguage;
  progressStep: number;
}): Promise<string> {
  const completion = await withRetry(
    () =>
      params.createCompletion({
        model: params.modelName,
        messages: params.messages,
        tools: toOpenAITools(
          params.isStaged,
          params.commitMessageLanguage,
        ) as unknown as ChatCompletionTool[],
        tool_choice: {
          type: 'function',
          function: { name: FINAL_COMMIT_MESSAGE_TOOL_NAME },
        },
      }),
    params.retryOptions,
  );
  const finalMessage = getAssistantMessage(completion);
  if (!finalMessage) {
    throw createEmptyFinalResponseError('OpenAI API');
  }
  const finalToolCall = getFunctionToolCalls(finalMessage).find(
    (toolCall) => toolCall.function.name === FINAL_COMMIT_MESSAGE_TOOL_NAME,
  );
  if (finalToolCall) {
    params.onProgress?.(
      formatBatchProgressMessage(
        params.progressStep,
        [
          {
            name: FINAL_COMMIT_MESSAGE_TOOL_NAME,
            args: parseToolArguments(finalToolCall.function.arguments).args,
          },
        ],
        params.language,
      ),
    );
    const parsed = parseToolArguments(finalToolCall.function.arguments);
    const finalCommitMessage = extractFinalCommitMessageFromArgs(parsed.args);
    if (finalCommitMessage) {
      return finalCommitMessage;
    }
  }
  const text = getOpenAIMessageText(finalMessage.content);
  if (!text) {
    throw createEmptyFinalResponseError('OpenAI API');
  }
  return extractCommitMessage(text);
}

async function runOpenAIAgentLoop(options: AgentLoopOptions): Promise<string> {
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
    baseUrl,
    language = 'en',
    commitMessageLanguage = 'en',
  } = options;
  throwIfCancellationRequested(cancellationToken);
  if (!apiKey) {
    throw new APIKeyMissingError();
  }
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  try {
    const openaiModule: typeof import('openai') = await import('openai');
    const openAIClientClass = openaiModule.default;
    const client = new openAIClientClass({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
    const createCompletion: OpenAICompletionCreate = (request) =>
      client.chat.completions.create(request);
    const modelName = pickNonEmpty(model, DEFAULT_MODELS.openai);
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

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: initialContext },
    ];

    if (onProgress) {
      onProgress(LOCALES[language].progressMessages.analyzingChanges);
    }

    const retryOptions = createOpenAIRetryOptions({
      cancellationToken,
      onProgress,
      language,
    });
    const requestCompletionWithTools = createOpenAIRequestCompletionWithTools({
      createCompletion,
      modelName,
      isStaged,
      retryOptions,
      commitMessageLanguage,
    });
    const stepLimit = resolveStepLimit(maxAgentSteps);
    const progressState = { nextStep: 1 };
    const loopResult = await executeOpenAIInvestigationLoop({
      messages,
      stepLimit,
      requestCompletionWithTools,
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
      content: buildFinalOutputReminder(
        resolvedCommitOutputOptions,
        commitMessageLanguage,
      ),
    });
    throwIfCancellationRequested(cancellationToken);
    return await requestOpenAIFinalCommitMessage({
      createCompletion,
      modelName,
      messages,
      isStaged,
      retryOptions,
      onProgress,
      language,
      commitMessageLanguage,
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
    throwMappedOpenAIError(error);
  }
}

export { runOpenAIAgentLoop };
