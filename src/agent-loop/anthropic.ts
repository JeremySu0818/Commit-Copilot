import {
  executeToolCall,
  buildInitialContext,
  toAnthropicTools,
} from '../agent-tools';
import { DEFAULT_MODELS } from '../models';
import {
  APIKeyMissingError,
  APIKeyInvalidError,
  APIQuotaExceededError,
  APIRequestError,
  NoChangesError,
} from '../errors';
import { ProgressCallback } from '../llm-clients';
import { GitOperations } from '../commit-copilot';
import {
  buildAgentSystemPrompt,
  extractCommitMessage,
  formatBatchProgressMessage,
  MAX_AGENT_STEPS,
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
): Promise<string> {
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

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
    );
    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
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

    while (step < MAX_AGENT_STEPS) {
      const response = await withRetry(
        () =>
          client.messages.create({
            model: modelName,
            max_tokens: 16384,
            system: systemPrompt,
            messages,
            tools: toAnthropicTools(isStaged) as any,
          }),
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
          text: 'You have used all available investigation steps. Output ONLY the final commit message now in type(scope): description format. Scope parentheses are MANDATORY. Do NOT include any explanation or analysis — just the commit message.',
        },
      ],
    });

    const finalResponse = await withRetry(
      () =>
        client.messages.create({
          model: modelName,
          max_tokens: 16384,
          system: systemPrompt,
          messages,
        }),
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
      error instanceof APIKeyMissingError
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
