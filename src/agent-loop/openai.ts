import {
  executeToolCall,
  buildInitialContext,
  toOpenAITools,
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
} from './shared';
import { DEFAULT_RETRY_OPTIONS, RetryInfo, withRetry } from '../retry';
import { LOCALES } from '../i18n/locales';
import type { EffectiveDisplayLanguage } from '../i18n/types';

function parseToolArguments(
  rawArguments: unknown,
): { args: Record<string, unknown>; error?: string } {
  if (typeof rawArguments !== 'string' || rawArguments.trim() === '') {
    return { args: {} };
  }

  try {
    const parsed = JSON.parse(rawArguments);
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

async function runOpenAIAgentLoop(
  apiKey: string,
  model: string | undefined,
  diff: string,
  repoRoot: string,
  onProgress?: ProgressCallback,
  isStaged: boolean = true,
  gitOps?: GitOperations,
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  cancellationToken?: CancellationSignal,
  maxAgentSteps?: number,
  baseUrl?: string,
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
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) });
    const modelName = model || DEFAULT_MODELS.openai;
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

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: initialContext },
    ];

    if (onProgress) {
      onProgress(LOCALES[language].progressMessages.analyzingChanges);
    }

    const retryOptions = {
      ...DEFAULT_RETRY_OPTIONS,
      checkAbort: () => throwIfCancellationRequested(cancellationToken),
      onRetry: ({ attempt, maxAttempts, delayMs }: RetryInfo) => {
        if (onProgress) {
          const nextAttempt = attempt + 1;
          onProgress(
            LOCALES[language].progressMessages.transientApiError(
              nextAttempt,
              maxAttempts,
              Math.ceil(delayMs / 1000)
            )
          );
        }
      },
    };

    let step = 0;

    while (step < (maxAgentSteps && maxAgentSteps > 0 ? maxAgentSteps : Infinity)) {
      throwIfCancellationRequested(cancellationToken);
      const completion = await withRetry(
        () =>
          client.chat.completions.create({
            model: modelName,
            messages,
            tools: toOpenAITools(isStaged) as any,
            tool_choice: 'auto',
          }),
        retryOptions,
      );

      const choice = completion.choices[0];
      if (!choice) {
        throw new APIRequestError('Empty response from OpenAI API');
      }

      const assistantMessage = choice.message;
      messages.push(assistantMessage);
      const functionToolCalls = (assistantMessage.tool_calls || []).filter(
        (toolCall): toolCall is any =>
          toolCall.type === 'function' &&
          typeof (toolCall as any).function?.name === 'string',
      );

      if (functionToolCalls.length > 0) {
        const parsedToolCalls = functionToolCalls.map((toolCall: any) => {
          const parsed = parseToolArguments(toolCall.function.arguments);
          return {
            toolCall,
            name: toolCall.function.name,
            args: parsed.args,
            parseError: parsed.error,
          };
        });

        if (onProgress) {
          const calls = parsedToolCalls.map(({ name, args }) => ({
            name,
            args,
          }));
          onProgress(formatBatchProgressMessage(step + 1, calls, language));
        }

        for (const parsedToolCall of parsedToolCalls) {
          throwIfCancellationRequested(cancellationToken);
          const { toolCall, name, args, parseError } = parsedToolCall;
          let content: string;

          if (parseError) {
            content = `Tool execution error: Invalid JSON arguments for ${name}: ${parseError}`;
          } else {
            const result = await executeToolCall(
              { name, arguments: args },
              repoRoot,
              diff,
              isStaged,
              gitOps,
            );
            content = result.content;
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content,
          });
        }
        step++;
      } else {
        const text = assistantMessage.content;
        if (!text) {
          throw new APIRequestError('Empty text response from OpenAI API');
        }
        return extractCommitMessage(text);
      }
    }

    messages.push({
      role: 'user',
      content: buildFinalOutputReminder(resolvedCommitOutputOptions),
    });
    throwIfCancellationRequested(cancellationToken);
    const finalCompletion = await withRetry(
      () =>
        client.chat.completions.create({
          model: modelName,
          messages,
        }),
      retryOptions,
    );
    const text = finalCompletion.choices[0]?.message?.content;
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
    const status = error?.status;
    if (
      status === 401 ||
      status === 403 ||
      message.includes('Invalid API Key')
    ) {
      throw new APIKeyInvalidError(message);
    } else if (status === 429 || message.includes('rate limit')) {
      throw new APIQuotaExceededError(message);
    }
    throw new APIRequestError(message);
  }
}

export { runOpenAIAgentLoop };
