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

type GeminiFunctionCall = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
};

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
  isStaged: boolean = true,
  gitOps?: GitOperations,
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  cancellationToken?: CancellationSignal,
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
    });
    const generationConfig = {
      systemInstruction: systemPrompt,
      tools: [
        {
          functionDeclarations: toGeminiFunctionDeclarations(isStaged) as any,
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
    );
    const history: any[] = [
      {
        role: 'user',
        parts: [{ text: initialContext }],
      },
    ];

    if (onProgress) {
      onProgress('Agent analyzing changes...');
    }

    const retryOptions = {
      ...DEFAULT_RETRY_OPTIONS,
      onRetry: ({ attempt, maxAttempts, delayMs }: RetryInfo) => {
        if (onProgress) {
          const nextAttempt = attempt + 1;
          onProgress(
            `Transient API error. Retrying (${nextAttempt}/${maxAttempts}) in ${Math.ceil(
              delayMs / 1000,
            )}s...`,
          );
        }
      },
    };

    let response = await withRetry(
      () =>
        client.models.generateContent({
          model: modelName,
          contents: history,
          config: generationConfig as any,
        }),
      retryOptions,
    );
    let step = 0;

    while (step < MAX_AGENT_STEPS) {
      throwIfCancellationRequested(cancellationToken);
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

      const toolResults: any[] = [];
      if (onProgress && functionCalls.length > 0) {
        const calls = functionCalls.map((call) => ({
          name: call.name,
          args: call.args || {},
        }));
        onProgress(formatBatchProgressMessage(step + 1, calls));
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
      history.push({ role: 'user', parts: toolResults });

      response = await withRetry(
        () =>
          client.models.generateContent({
            model: modelName,
            contents: history,
            config: generationConfig as any,
          }),
        retryOptions,
      );
      step++;
    }

    const finalResponse = await withRetry(
      () =>
        client.models.generateContent({
          model: modelName,
          contents: [
            ...history,
            {
              role: 'user',
              parts: [
                { text: buildFinalOutputReminder(resolvedCommitOutputOptions) },
              ],
            },
          ],
          config: generationConfig as any,
        }),
      retryOptions,
    );
    throwIfCancellationRequested(cancellationToken);
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
    const message = error?.message || String(error);
    if (
      message.includes('API_KEY_INVALID') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      throw new APIKeyInvalidError(message);
    } else if (message.includes('429') || message.includes('quota')) {
      throw new APIQuotaExceededError(message);
    }
    throw new APIRequestError(message);
  }
}

export { runGeminiAgentLoop };
