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
import { DEFAULT_RETRY_OPTIONS, RetryInfo, withRetry } from '../retry';

import {
  buildAgentSystemPrompt,
  buildFinalOutputReminder,
  extractCommitMessage,
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
  return isRecord(error) ? (error as ErrorLike) : {};
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
}): Promise<string | null> {
  let step = 0;
  while (step < params.stepLimit) {
    throwIfCancellationRequested(params.cancellationToken);
    const response = await params.requestGeminiResponse(params.history);
    if (!getGeminiFirstCandidate(response)) {
      throw new APIRequestError('Empty response from Gemini API');
    }

    const functionCalls = normalizeGeminiFunctionCalls(response);
    if (functionCalls.length === 0) {
      const text = getGeminiResponseText(response);
      if (!text) {
        throw new APIRequestError('Empty text response from Gemini API');
      }
      return extractCommitMessage(text);
    }

    params.history.push(
      getGeminiCandidateContent(response) ??
        toGeminiModelResponsePart(functionCalls),
    );

    if (params.onProgress) {
      params.onProgress(
        formatBatchProgressMessage(
          step + 1,
          functionCalls.map((call) => ({ name: call.name, args: call.args })),
          params.language,
        ),
      );
    }

    const toolResults = await buildToolResultParts({
      functionCalls,
      repoRoot: params.repoRoot,
      diff: params.diff,
      isStaged: params.isStaged,
      gitOps: params.gitOps,
      cancellationToken: params.cancellationToken,
    });
    params.history.push({ role: 'user', parts: toolResults });
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
    const finalGenerationConfig = {
      systemInstruction: systemPrompt,
    };

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
      true,
      resolvedCommitOutputOptions,
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

    const requestGeminiResponse = async (
      contents: UnknownRecord[],
      config: UnknownRecord = generationConfig,
    ) => {
      throwIfCancellationRequested(cancellationToken);
      const result = await withRetry(
        () => {
          throwIfCancellationRequested(cancellationToken);
          return client.models.generateContent({
            model: modelName,
            contents,
            config,
          });
        },
        {
          ...retryOptions,
          onRetry: (info: RetryInfo) => {
            throwIfCancellationRequested(cancellationToken);
            retryOptions.onRetry(info);
          },
        },
      );
      throwIfCancellationRequested(cancellationToken);
      return result;
    };

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
    });
    if (loopResult) {
      return loopResult;
    }

    const finalResponse = await requestGeminiResponse(
      [
        ...history,
        {
          role: 'user',
          parts: [
            { text: buildFinalOutputReminder(resolvedCommitOutputOptions) },
          ],
        },
      ],
      finalGenerationConfig,
    );
    const text = getGeminiResponseText(finalResponse);
    if (!text) {
      throw new APIRequestError('Empty final response from Gemini API');
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
    throwMappedGeminiError(error);
  }
}

export { runGeminiAgentLoop };
