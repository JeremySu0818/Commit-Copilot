import {
  executeToolCall,
  buildInitialContext,
  toGeminiFunctionDeclarations,
} from '../agent-tools';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_MODELS,
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
  MAX_AGENT_STEPS,
} from './shared';
import { DEFAULT_RETRY_OPTIONS, RetryInfo, withRetry } from '../retry';
import { LOCALES } from '../i18n/locales';
import type { EffectiveDisplayLanguage } from '../i18n/types';

interface GeminiFunctionCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

const GEMINI_AUTH_STATUS_PATTERN =
  /\b(?:status(?:\s*code)?|http(?:\s*status)?|response(?:\s*status)?)\s*[:=]?\s*(401|403)\b/i;
const GEMINI_QUOTA_STATUS_PATTERN =
  /\b(?:status(?:\s*code)?|http(?:\s*status)?|response(?:\s*status)?)\s*[:=]?\s*429\b/i;

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

function getErrorStatus(error: any): number | null {
  const status =
    error?.status ??
    error?.statusCode ??
    error?.response?.status ??
    error?.response?.statusCode;
  if (typeof status === 'number') {
    return status;
  }
  if (typeof status === 'string' && /^\d{3}$/.test(status)) {
    return Number(status);
  }
  return null;
}

function getErrorCode(error: any): string {
  return String(
    error?.code || error?.error?.status || error?.error?.code || '',
  ).toUpperCase();
}

function isGeminiAuthError(error: any, message: string): boolean {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) {
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
    GEMINI_AUTH_STATUS_PATTERN.test(message) ||
    /\b(?:401\s+unauthorized|403\s+forbidden|api[_\s-]?key[_\s-]?invalid|invalid[_\s-]?api[_\s-]?key|unauthenticated|permission denied)\b/i.test(
      message,
    )
  );
}

function isGeminiQuotaError(error: any, message: string): boolean {
  const status = getErrorStatus(error);
  if (status === 429) {
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
    GEMINI_QUOTA_STATUS_PATTERN.test(message) ||
    /\b(?:429\s+too many requests|resource[_\s-]?exhausted|rate[\s_-]?limit(?:ed)?|quota(?:\s+(?:exceeded|exhausted|reached|limit(?:ed)?)))\b/i.test(
      message,
    )
  );
}

function normalizeGeminiFunctionCalls(response: any): GeminiFunctionCall[] {
  const directCalls = Array.isArray(response?.functionCalls)
    ? response.functionCalls
    : [];
  const normalizedDirect = directCalls
    .map((call: any) => ({
      id: typeof call?.id === 'string' ? call.id : undefined,
      name: call?.name,
      args:
        call?.args && typeof call.args === 'object'
          ? (call.args as Record<string, unknown>)
          : {},
    }))
    .filter(
      (
        call: Partial<GeminiFunctionCall>,
      ): call is GeminiFunctionCall & { name: string } =>
        typeof call.name === 'string' && call.name.length > 0,
    );
  if (normalizedDirect.length > 0) {
    return normalizedDirect;
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return [];
  }

  return parts
    .map((part: any) => part?.functionCall)
    .filter(
      (
        call: { name?: unknown; args?: unknown; id?: unknown } | undefined,
      ): call is { name: string; args?: unknown; id?: unknown } =>
        !!call && typeof call.name === 'string' && call.name.length > 0,
    )
    .map((call) => ({
      id: typeof call.id === 'string' ? call.id : undefined,
      name: call.name,
      args:
        call.args && typeof call.args === 'object'
          ? (call.args as Record<string, unknown>)
          : {},
    }));
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
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey });
    const modelName = (model || DEFAULT_MODELS.google).replace(/^models\//, '');
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
          functionDeclarations: toGeminiFunctionDeclarations(isStaged) as any,
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
    const history: any[] = [
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
              Math.ceil(delayMs / 1000),
            ),
          );
        }
      },
    };

    const requestGeminiResponse = async (
      contents: any[],
      config: any = generationConfig,
    ) => {
      throwIfCancellationRequested(cancellationToken);
      const result = await withRetry(
        () => {
          throwIfCancellationRequested(cancellationToken);
          return client.models.generateContent({
            model: modelName,
            contents,
            config: config,
          });
        },
        {
          ...retryOptions,
          onRetry: (info: RetryInfo) => {
            throwIfCancellationRequested(cancellationToken);
            retryOptions.onRetry?.(info);
          },
        },
      );
      throwIfCancellationRequested(cancellationToken);
      return result;
    };

    let step = 0;

    while (
      step < (maxAgentSteps && maxAgentSteps > 0 ? maxAgentSteps : Infinity)
    ) {
      throwIfCancellationRequested(cancellationToken);
      const response = await requestGeminiResponse(history);
      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new APIRequestError('Empty response from Gemini API');
      }

      const functionCalls = normalizeGeminiFunctionCalls(response);

      if (!functionCalls || functionCalls.length === 0) {
        const text = response.text;
        if (!text) {
          throw new APIRequestError('Empty text response from Gemini API');
        }
        return extractCommitMessage(text);
      }

      history.push(
        candidate.content || {
          role: 'model',
          parts: functionCalls.map((fc: any) => ({
            functionCall: {
              id: fc.id,
              name: fc.name,
              args: fc.args || {},
            },
          })),
        },
      );

      const toolResults: any[] = [];
      if (onProgress && functionCalls.length > 0) {
        const calls = functionCalls.map((call) => ({
          name: call.name,
          args: call.args || {},
        }));
        onProgress(formatBatchProgressMessage(step + 1, calls, language));
      }

      for (const fc of functionCalls) {
        throwIfCancellationRequested(cancellationToken);
        const result = await executeToolCall(
          { name: fc.name, arguments: fc.args || {} },
          repoRoot,
          diff,
          isStaged,
          gitOps,
        );

        toolResults.push({
          functionResponse: {
            name: fc.name,
            response: { content: result.content },
          },
        });
      }

      history.push({ role: 'user', parts: toolResults });

      step++;
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
    const text = finalResponse.text;
    return text ? extractCommitMessage(text) : 'chore(project): update files';
  } catch (error: any) {
    if (
      error instanceof NoChangesError ||
      error instanceof APIKeyMissingError ||
      error instanceof GenerationCancelledError
    ) {
      throw error;
    }
    const message = getErrorMessage(error);
    if (isGeminiAuthError(error, message)) {
      throw new APIKeyInvalidError(message);
    } else if (isGeminiQuotaError(error, message)) {
      throw new APIQuotaExceededError(message);
    }
    throw new APIRequestError(message);
  }
}

export { runGeminiAgentLoop };
