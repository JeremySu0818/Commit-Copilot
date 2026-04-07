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
  MAX_AGENT_STEPS,
} from './shared';
import { DEFAULT_RETRY_OPTIONS, RetryInfo, withRetry } from '../retry';

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
    const client = new OpenAI({ apiKey });
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
    });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: initialContext },
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

    let step = 0;

    while (step < MAX_AGENT_STEPS) {
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

      if (
        choice.finish_reason === 'tool_calls' &&
        functionToolCalls.length > 0
      ) {
        if (onProgress) {
          const calls = functionToolCalls.map((tc: any) => ({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || '{}'),
          }));
          onProgress(formatBatchProgressMessage(step + 1, calls));
        }

        for (const toolCall of functionToolCalls) {
          throwIfCancellationRequested(cancellationToken);
          const args = JSON.parse(toolCall.function.arguments || '{}');
          const result = await executeToolCall(
            { name: toolCall.function.name, arguments: args },
            repoRoot,
            diff,
            isStaged,
            gitOps,
          );

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.content,
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
