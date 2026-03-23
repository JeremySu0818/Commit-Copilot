import { buildInitialContext } from '../agent-tools';
import { DEFAULT_MODELS, OLLAMA_DEFAULT_HOST } from '../models';
import { APIRequestError, NoChangesError } from '../errors';
import { ProgressCallback } from '../llm-clients';
import { GitOperations } from '../commit-copilot';
import { buildAgentSystemPrompt, extractCommitMessage } from './shared';

async function runOllamaAgentLoop(
  host: string | undefined,
  model: string | undefined,
  diff: string,
  repoRoot: string,
  onProgress: ProgressCallback | undefined,
  isStaged: boolean,
  gitOps?: GitOperations,
): Promise<string> {
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  const resolvedHost = host || OLLAMA_DEFAULT_HOST;

  try {
    const { Ollama } = await import('ollama');
    const client = new Ollama({ host: resolvedHost });
    const modelName = model || DEFAULT_MODELS.ollama;

    const pullStream = await client.pull({ model: modelName, stream: true });
    let lastPercent = 0;
    for await (const part of pullStream) {
      if (part.total && part.completed) {
        const percent = Math.round((part.completed / part.total) * 100);
        if (percent > lastPercent) {
          const increment = percent - lastPercent;
          lastPercent = percent;
          if (onProgress) {
            onProgress(
              `Pulling ${modelName}: ${part.status} (${percent}%)`,
              increment,
            );
          }
        }
      } else if (part.status && onProgress) {
        onProgress(`Pulling ${modelName}: ${part.status}`);
      }
    }

    if (onProgress) {
      onProgress('Generating commit message...', 0);
    }

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
    );
    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
    });
    const enhancedPrompt = `${initialContext}\n\n## Full Diff (provided inline for local model)\n\n${diff}`;

    const response = await client.chat({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: enhancedPrompt },
      ],
      options: {
        temperature: 0.7,
        top_p: 0.95,
      },
    });

    const text = response.message?.content;
    if (!text) {
      throw new APIRequestError('Empty response from Ollama');
    }
    return extractCommitMessage(text);
  } catch (error: any) {
    if (error instanceof NoChangesError) {
      throw error;
    }
    const message = error?.message || String(error);
    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      throw new APIRequestError(
        `Cannot connect to Ollama. Make sure Ollama is running at ${resolvedHost}`,
      );
    } else if (message.includes('model') && message.includes('not found')) {
      throw new APIRequestError(
        `Model "${model || DEFAULT_MODELS.ollama}" not found. Please pull it first.`,
      );
    }
    throw new APIRequestError(message);
  }
}

export { runOllamaAgentLoop };
