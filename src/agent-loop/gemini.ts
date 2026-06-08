import {
  executeToolCall,
  buildInitialContext,
  toGeminiFunctionDeclarations,
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
  createEmptyTextResponseError,
} from '../errors';
import { LOCALES } from '../i18n/locales';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import { ProgressCallback } from '../llm-clients';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_MODELS,
  normalizeCommitOutputOptions,
} from '../models';
import {
  DEFAULT_RETRY_OPTIONS,
  RetryInfo,
  RetryOptions,
  withRetry,
} from '../retry';

import {
  buildAgentSystemPrompt,
  buildFinalOutputReminder,
  buildFinalToolRequiredReminder,
  extractCommitMessage,
  extractFinalCommitMessageFromArgs,
  FINAL_COMMIT_MESSAGE_TOOL_NAME,
  formatBatchProgressMessage,
} from './shared';

interface GeminiFunctionCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

type UnknownRecord = Record<string, unknown>;

interface ErrorLike {
  status?: unknown;
  statusCode?: unknown;
  response?: unknown;
  code?: unknown;
  error?: unknown;
  message?: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toErrorLike(error: unknown): ErrorLike {
  return isRecord(error) ? error : {};
}

function pickNonEmpty(primary: string | undefined, fallback: string): string {
  return primary && primary.length > 0 ? primary : fallback;
}

const unauthorizedStatus = 401;
const forbiddenStatus = 403;
const tooManyRequestsStatus = 429;
const millisecondsPerSecond = 1000;
const geminiAuthMessagePatterns = [
  'unauthorized',
  'forbidden',
  'api key invalid',
  'invalid api key',
  'unauthenticated',
  'permission denied',
];
const geminiQuotaMessagePatterns = [
  'too many requests',
  'resource exhausted',
  'rate limit',
  'rate_limited',
  'quota exceeded',
  'quota exhausted',
  'quota reached',
  'quota limited',
];
const statusPrefixes = [
  'status',
  'status code',
  'http status',
  'response status',
];

function hasStatusToken(message: string, status: number): boolean {
  const normalized = message.toLowerCase();
  const statusText = String(status);

  for (const prefix of statusPrefixes) {
    if (
      normalized.includes(`${prefix} ${statusText}`) ||
      normalized.includes(`${prefix}: ${statusText}`) ||
      normalized.includes(`${prefix}:${statusText}`) ||
      normalized.includes(`${prefix}=${statusText}`) ||
      normalized.includes(`${prefix} = ${statusText}`)
    ) {
      return true;
    }
  }

  return false;
}

function includesAnyPattern(message: string, patterns: string[]): boolean {
  const normalized = message.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return String(error);
}

function getErrorStatus(error: unknown): number | null {
  const candidate = toErrorLike(error);
  const response = toErrorLike(candidate.response);
  const status =
    candidate.status ??
    candidate.statusCode ??
    response.status ??
    response.statusCode;
  if (typeof status === 'number') {
    return status;
  }
  if (typeof status === 'string' && /^\d{3}$/.test(status)) {
    return Number(status);
  }
  return null;
}

function getErrorCode(error: unknown): string {
  const candidate = toErrorLike(error);
  const nestedError = toErrorLike(candidate.error);
  const rawCode = candidate.code ?? nestedError.status ?? nestedError.code;
  if (typeof rawCode === 'string' || typeof rawCode === 'number') {
    return String(rawCode).toUpperCase();
  }
  return '';
}

function isGeminiAuthError(error: unknown, message: string): boolean {
  const status = getErrorStatus(error);
  if (status === unauthorizedStatus || status === forbiddenStatus) {
    return true;
  }

  const code = getErrorCode(error);
  if (
    code === 'API_KEY_INVALID' ||
    code === 'INVALID_API_KEY' ||
    code === 'UNAUTHENTICATED' ||
    code === 'AUTHENTICATION_ERROR' ||
    code === 'PERMISSION_DENIED'
  ) {
    return true;
  }

  return (
    hasStatusToken(message, unauthorizedStatus) ||
    hasStatusToken(message, forbiddenStatus) ||
    includesAnyPattern(message, geminiAuthMessagePatterns)
  );
}

function isGeminiQuotaError(error: unknown, message: string): boolean {
  const status = getErrorStatus(error);
  if (status === tooManyRequestsStatus) {
    return true;
  }

  const code = getErrorCode(error);
  if (
    code === 'RESOURCE_EXHAUSTED' ||
    code === 'QUOTA_EXCEEDED' ||
    code === 'RATE_LIMIT_EXCEEDED' ||
    code === 'TOO_MANY_REQUESTS'
  ) {
    return true;
  }

  return (
    hasStatusToken(message, tooManyRequestsStatus) ||
    includesAnyPattern(message, geminiQuotaMessagePatterns)
  );
}

function normalizeGeminiFunctionCall(call: unknown): GeminiFunctionCall | null {
  if (!isRecord(call)) {
    return null;
  }

  const name = asString(call.name);
  if (!name || name.length === 0) {
    return null;
  }

  return {
    id: asString(call.id),
    name,
    args: isRecord(call.args) ? call.args : {},
  };
}

function getGeminiResponseParts(response: unknown): unknown[] {
  if (!isRecord(response) || !isUnknownArray(response.candidates)) {
    return [];
  }
  const firstCandidate = response.candidates[0];
  if (!isRecord(firstCandidate) || !isRecord(firstCandidate.content)) {
    return [];
  }
  return isUnknownArray(firstCandidate.content.parts)
    ? firstCandidate.content.parts
    : [];
}

function getGeminiResponseText(response: unknown): string | undefined {
  if (!isRecord(response)) {
    return undefined;
  }
  return asString(response.text);
}

function getGeminiCandidateContent(response: unknown): UnknownRecord | null {
  if (!isRecord(response) || !isUnknownArray(response.candidates)) {
    return null;
  }
  const firstCandidate = response.candidates[0];
  if (!isRecord(firstCandidate) || !isRecord(firstCandidate.content)) {
    return null;
  }
  return firstCandidate.content;
}

function getGeminiFirstCandidate(response: unknown): UnknownRecord | null {
  if (!isRecord(response) || !isUnknownArray(response.candidates)) {
    return null;
  }
  const firstCandidate = response.candidates[0];
  return isRecord(firstCandidate) ? firstCandidate : null;
}

function normalizeGeminiFunctionCalls(response: unknown): GeminiFunctionCall[] {
  const directCalls =
    isRecord(response) && Array.isArray(response.functionCalls)
      ? response.functionCalls
      : [];
  const normalizedDirect = directCalls
    .map((call) => normalizeGeminiFunctionCall(call))
    .filter((call): call is GeminiFunctionCall => call !== null);
  if (normalizedDirect.length > 0) {
    return normalizedDirect;
  }

  return getGeminiResponseParts(response)
    .map((part) =>
      isRecord(part) ? normalizeGeminiFunctionCall(part.functionCall) : null,
    )
    .filter((call): call is GeminiFunctionCall => call !== null);
}

function resolveStepLimit(maxAgentSteps: number | undefined): number {
  return maxAgentSteps && maxAgentSteps > 0
    ? maxAgentSteps
    : Number.POSITIVE_INFINITY;
}

function toGeminiModelResponsePart(
  functionCalls: GeminiFunctionCall[],
): UnknownRecord {
  return {
    role: 'model',
    parts: functionCalls.map((functionCall) => ({
      functionCall: {
        id: functionCall.id,
        name: functionCall.name,
        args: functionCall.args,
      },
    })),
  };
}

async function buildToolResultParts(params: {
  functionCalls: GeminiFunctionCall[];
  repoRoot: string;
  diff: string;
  isStaged: boolean;
  gitOps?: GitOperations;
  cancellationToken?: CancellationSignal;
}): Promise<UnknownRecord[]> {
  const toolResults: UnknownRecord[] = [];
  for (const functionCall of params.functionCalls) {
    throwIfCancellationRequested(params.cancellationToken);
    const result = await executeToolCall(
      { name: functionCall.name, arguments: functionCall.args },
      params.repoRoot,
      params.diff,
      params.isStaged,
      params.gitOps,
    );
    toolResults.push({
      functionResponse: {
        name: functionCall.name,
        response: { content: result.content },
      },
    });
  }
  return toolResults;
}

function handleGeminiTextResponse(params: {
  response: unknown;
  history: UnknownRecord[];
  commitOutputOptions: CommitOutputOptions;
  finalToolReminderSent: boolean;
}): { finalMessage?: string; remindFinalTool: boolean } {
  const text = getGeminiResponseText(params.response);
  if (!text) {
    throw createEmptyTextResponseError('Gemini API');
  }
  if (params.finalToolReminderSent) {
    return { finalMessage: extractCommitMessage(text), remindFinalTool: false };
  }
  params.history.push(
    getGeminiCandidateContent(params.response) ?? {
      role: 'model',
      parts: [{ text }],
    },
  );
  params.history.push({
    role: 'user',
    parts: [
      {
        text: buildFinalToolRequiredReminder(params.commitOutputOptions),
      },
    ],
  });
  return { remindFinalTool: true };
}

async function handleGeminiFunctionCallBatch(params: {
  functionCalls: GeminiFunctionCall[];
  response: unknown;
  history: UnknownRecord[];
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
      params.step + 1,
      params.functionCalls.map((call) => ({
        name: call.name,
        args: call.args,
      })),
      params.language,
    ),
  );

  const finalFunctionCall = params.functionCalls.find(
    (call) => call.name === FINAL_COMMIT_MESSAGE_TOOL_NAME,
  );
  if (finalFunctionCall) {
    const finalMessage = extractFinalCommitMessageFromArgs(
      finalFunctionCall.args,
    );
    if (finalMessage) {
      return finalMessage;
    }
  }

  params.history.push(
    getGeminiCandidateContent(params.response) ??
      toGeminiModelResponsePart(params.functionCalls),
  );

  const toolResults = await buildToolResultParts({
    functionCalls: params.functionCalls,
    repoRoot: params.repoRoot,
    diff: params.diff,
    isStaged: params.isStaged,
    gitOps: params.gitOps,
    cancellationToken: params.cancellationToken,
  });
  params.history.push({ role: 'user', parts: toolResults });
  return null;
}

async function executeGeminiInvestigationLoop(params: {
  history: UnknownRecord[];
  stepLimit: number;
  requestGeminiResponse: (
    contents: UnknownRecord[],
    config?: UnknownRecord,
  ) => Promise<unknown>;
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
  repoRoot: string;
  diff: string;
  isStaged: boolean;
  gitOps?: GitOperations;
  cancellationToken?: CancellationSignal;
  commitOutputOptions: CommitOutputOptions;
}): Promise<string | null> {
  let step = 0;
  let finalToolReminderSent = false;
  while (step < params.stepLimit) {
    throwIfCancellationRequested(params.cancellationToken);
    const response = await params.requestGeminiResponse([...params.history]);
    if (!getGeminiFirstCandidate(response)) {
      throw createEmptyResponseError('Gemini API');
    }

    const functionCalls = normalizeGeminiFunctionCalls(response);
    if (functionCalls.length === 0) {
      const textResult = handleGeminiTextResponse({
        response,
        history: params.history,
        commitOutputOptions: params.commitOutputOptions,
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
    } else {
      const finalMessage = await handleGeminiFunctionCallBatch({
        functionCalls,
        response,
        history: params.history,
        step,
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
    }
    step += 1;
  }

  return null;
}

function throwMappedGeminiError(error: unknown): never {
  const message = getErrorMessage(error);
  if (isGeminiAuthError(error, message)) {
    throw new APIKeyInvalidError(message);
  }
  if (isGeminiQuotaError(error, message)) {
    throw new APIQuotaExceededError(message);
  }
  throw new APIRequestError(message);
}

interface GeminiClientLike {
  models: {
    generateContent: (request: {
      model: string;
      contents: UnknownRecord[];
      config: UnknownRecord;
    }) => Promise<unknown>;
  };
}

function createGeminiRetryOptions(params: {
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

function createGeminiResponseRequester(params: {
  client: GeminiClientLike;
  modelName: string;
  retryOptions: ReturnType<typeof createGeminiRetryOptions>;
}) {
  return (contents: UnknownRecord[], config: UnknownRecord) =>
    withRetry(
      () =>
        params.client.models.generateContent({
          model: params.modelName,
          contents,
          config,
        }),
      params.retryOptions,
    );
}

async function requestGeminiFinalCommitMessage(params: {
  requestGeminiResponse: (
    contents: UnknownRecord[],
    config?: UnknownRecord,
  ) => Promise<unknown>;
  history: UnknownRecord[];
  generationConfig: UnknownRecord;
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
  maxAgentSteps?: number;
  commitOutputOptions: CommitOutputOptions;
}): Promise<string> {
  const finalResponse = await params.requestGeminiResponse(
    [
      ...params.history,
      {
        role: 'user',
        parts: [{ text: buildFinalOutputReminder(params.commitOutputOptions) }],
      },
    ],
    params.generationConfig,
  );
  const finalFunctionCall = normalizeGeminiFunctionCalls(finalResponse).find(
    (call) => call.name === FINAL_COMMIT_MESSAGE_TOOL_NAME,
  );
  if (finalFunctionCall) {
    params.onProgress?.(
      formatBatchProgressMessage(
        resolveStepLimit(params.maxAgentSteps) === Number.POSITIVE_INFINITY
          ? 1
          : resolveStepLimit(params.maxAgentSteps) + 1,
        [
          {
            name: FINAL_COMMIT_MESSAGE_TOOL_NAME,
            args: finalFunctionCall.args,
          },
        ],
        params.language,
      ),
    );
    const finalCommitMessage = extractFinalCommitMessageFromArgs(
      finalFunctionCall.args,
    );
    if (finalCommitMessage) {
      return finalCommitMessage;
    }
  }
  const text = getGeminiResponseText(finalResponse);
  if (!text) {
    throw createEmptyFinalResponseError('Gemini API');
  }
  return extractCommitMessage(text);
}

async function runGeminiAgentLoop(
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
  draftCommitMessage?: string,
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
    const { GoogleGenAI: googleGenAIClientClass } =
      await import('@google/genai');
    const client = new googleGenAIClientClass({ apiKey });
    const modelName = pickNonEmpty(model, DEFAULT_MODELS.google).replace(
      /^models\//,
      '',
    );
    const resolvedCommitOutputOptions =
      normalizeCommitOutputOptions(commitOutputOptions);

    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
      commitOutputOptions: resolvedCommitOutputOptions,
      maxAgentSteps,
    });
    const generationConfig = {
      systemInstruction: systemPrompt,
      tools: [
        {
          functionDeclarations: toGeminiFunctionDeclarations(
            isStaged,
          ) as unknown,
        },
      ],
    };

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
      true,
      resolvedCommitOutputOptions,
      draftCommitMessage,
    );
    const history: UnknownRecord[] = [
      {
        role: 'user',
        parts: [{ text: initialContext }],
      },
    ];

    if (onProgress) {
      onProgress(LOCALES[language].progressMessages.analyzingChanges);
    }

    const retryOptions = createGeminiRetryOptions({
      cancellationToken,
      onProgress,
      language,
    });
    const requestGeminiResponseWithConfig = createGeminiResponseRequester({
      client,
      modelName,
      retryOptions,
    });
    const requestGeminiResponse = (
      contents: UnknownRecord[],
      config: UnknownRecord = generationConfig,
    ) => requestGeminiResponseWithConfig(contents, config);

    const loopResult = await executeGeminiInvestigationLoop({
      history,
      stepLimit: resolveStepLimit(maxAgentSteps),
      requestGeminiResponse,
      onProgress,
      language,
      repoRoot,
      diff,
      isStaged,
      gitOps,
      cancellationToken,
      commitOutputOptions: resolvedCommitOutputOptions,
    });
    if (loopResult) {
      return loopResult;
    }

    return await requestGeminiFinalCommitMessage({
      requestGeminiResponse,
      history,
      generationConfig,
      onProgress,
      language,
      maxAgentSteps,
      commitOutputOptions: resolvedCommitOutputOptions,
    });
  } catch (error: unknown) {
    if (
      error instanceof NoChangesError ||
      error instanceof APIKeyMissingError ||
      error instanceof GenerationCancelledError
    ) {
      throw error;
    }
    throwMappedGeminiError(error);
  }
}

export { runGeminiAgentLoop };
