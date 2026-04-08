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

async function runAnthropicAgentLoop(
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
    const modelName = model || DEFAULT_MODELS.anthropic;
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
    });

    const messages: any[] = [{ role: 'user', content: initialContext }];

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

    while (step < (maxAgentSteps && maxAgentSteps > 0 ? maxAgentSteps : Infinity)) {
      throwIfCancellationRequested(cancellationToken);
      const response = await withRetry(
        () =>
          client.messages
            .stream({
              model: modelName,
              max_tokens: maxTokens,
              system: systemPrompt,
              messages,
              tools: toAnthropicTools(isStaged) as any,
            })
            .finalMessage(),
        retryOptions,
      );

      const textBlocks = response.content.filter((b: any) => b.type === 'text');
      const toolUseBlocks = response.content.filter(
        (b: any) => b.type === 'tool_use',
      );

      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        const text = textBlocks.map((b: any) => b.text).join('');
        if (!text) {
          throw new APIRequestError('Empty response from Anthropic API');
        }
        return extractCommitMessage(text);
      }

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: any[] = [];
      if (onProgress && toolUseBlocks.length > 0) {
        const calls = toolUseBlocks.map((b: any) => ({
          name: b.name,
          args: b.input || {},
        }));
        onProgress(formatBatchProgressMessage(step + 1, calls));
      }

      for (const block of toolUseBlocks) {
        throwIfCancellationRequested(cancellationToken);
        const toolUse = block as any;
        const result = await executeToolCall(
          { name: toolUse.name, arguments: toolUse.input || {} },
          repoRoot,
          diff,
          isStaged,
          gitOps,
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
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
    const text = finalResponse.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
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
