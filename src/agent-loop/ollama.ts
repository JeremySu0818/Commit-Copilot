import { buildInitialContext } from '../agent-tools';
import {
  CancellationSignal,
  throwIfCancellationRequested,
} from '../cancellation';
import { GitOperations } from '../commit-copilot';
import {
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
  OLLAMA_DEFAULT_HOST,
  normalizeCommitOutputOptions,
} from '../models';

import { buildAgentSystemPrompt, extractCommitMessage } from './shared';

function pickNonEmpty(primary: string | undefined, fallback: string): string {
  return primary && primary.length > 0 ? primary : fallback;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return String(error);
}

async function runOllamaAgentLoop(
  host: string | undefined,
  model: string | undefined,
  diff: string,
  repoRoot: string,
  onProgress: ProgressCallback | undefined,
  isStaged: boolean,
  gitOps?: GitOperations,
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  cancellationToken?: CancellationSignal,
  language: EffectiveDisplayLanguage = 'en',
): Promise<string> {
  throwIfCancellationRequested(cancellationToken);
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  const resolvedHost = pickNonEmpty(host, OLLAMA_DEFAULT_HOST);

  try {
    const { Ollama } = await import('ollama');
    const client = new Ollama({ host: resolvedHost });
    const modelName = pickNonEmpty(model, DEFAULT_MODELS.ollama);
    const resolvedCommitOutputOptions =
      normalizeCommitOutputOptions(commitOutputOptions);

    const pullStream = await client.pull({ model: modelName, stream: true });
    let lastPercent = 0;
    for await (const part of pullStream) {
      throwIfCancellationRequested(cancellationToken);
      if (part.total && part.completed) {
        const percent = Math.round((part.completed / part.total) * 100);
        if (percent > lastPercent) {
          const increment = percent - lastPercent;
          lastPercent = percent;
          if (onProgress) {
            onProgress(
              LOCALES[language].progressMessages.pulling(
                modelName,
                part.status,
                percent,
              ),
              increment,
            );
          }
        }
      } else if (part.status && onProgress) {
        onProgress(
          LOCALES[language].progressMessages.pulling(modelName, part.status),
        );
      }
    }

    if (onProgress) {
      onProgress(LOCALES[language].progressMessages.generatingMessage, 0);
    }

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
      false,
      resolvedCommitOutputOptions,
    );
    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: false,
      enableTools: false,
      commitOutputOptions: resolvedCommitOutputOptions,
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

    const text = response.message.content;
    throwIfCancellationRequested(cancellationToken);
    if (!text) {
      throw new APIRequestError('Empty response from Ollama');
    }
    return extractCommitMessage(text);
  } catch (error: unknown) {
    if (
      error instanceof NoChangesError ||
      error instanceof GenerationCancelledError
    ) {
      throw error;
    }
    const message = getErrorMessage(error);
    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      throw new APIRequestError(
        `Cannot connect to Ollama. Make sure Ollama is running at ${resolvedHost}`,
      );
    } else if (message.includes('model') && message.includes('not found')) {
      throw new APIRequestError(
        `Model "${pickNonEmpty(model, DEFAULT_MODELS.ollama)}" not found. Please pull it first.`,
      );
    }
    throw new APIRequestError(message);
  }
}

export { runOllamaAgentLoop };
