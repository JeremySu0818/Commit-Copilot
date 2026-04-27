import { CancellationSignal } from '../cancellation';
import { GitOperations } from '../commit-copilot';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import { ProgressCallback } from '../llm-clients';
import {
  APIProvider,
  COMMIT_COPILOT_CLOUD_OPENAI_BASE_URL,
  CommitOutputOptions,
} from '../models';

import { runAnthropicAgentLoop } from './anthropic';
import { runGeminiAgentLoop } from './gemini';
import { runOllamaAgentLoop } from './ollama';
import { runOpenAIAgentLoop } from './openai';

interface AgentLoopOptions {
  provider: APIProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  diff: string;
  repoRoot: string;
  onProgress?: ProgressCallback;
  isStaged: boolean;
  gitOps: GitOperations;
  commitOutputOptions: CommitOutputOptions;
  cancellationToken?: CancellationSignal;
  maxAgentSteps?: number;
  language: EffectiveDisplayLanguage;
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<string> {
  const {
    provider,
    apiKey,
    model,
    baseUrl,
    diff,
    repoRoot,
    onProgress,
    isStaged,
    gitOps,
    commitOutputOptions,
    cancellationToken,
    maxAgentSteps,
    language,
  } = options;

  if (baseUrl) {
    return runOpenAIAgentLoop(
      apiKey,
      model,
      diff,
      repoRoot,
      onProgress,
      isStaged,
      gitOps,
      commitOutputOptions,
      cancellationToken,
      maxAgentSteps,
      baseUrl,
      language,
    );
  }

  switch (provider) {
    case 'google':
      return runGeminiAgentLoop(
        apiKey,
        model,
        diff,
        repoRoot,
        onProgress,
        isStaged,
        gitOps,
        commitOutputOptions,
        cancellationToken,
        maxAgentSteps,
        language,
      );
    case 'openai':
      return runOpenAIAgentLoop(
        apiKey,
        model,
        diff,
        repoRoot,
        onProgress,
        isStaged,
        gitOps,
        commitOutputOptions,
        cancellationToken,
        maxAgentSteps,
        undefined,
        language,
      );
    case 'anthropic':
      return runAnthropicAgentLoop(
        apiKey,
        model,
        diff,
        repoRoot,
        onProgress,
        isStaged,
        gitOps,
        commitOutputOptions,
        cancellationToken,
        maxAgentSteps,
        language,
      );
    case 'ollama':
      return runOllamaAgentLoop(
        apiKey,
        model,
        diff,
        repoRoot,
        onProgress,
        isStaged,
        gitOps,
        commitOutputOptions,
        cancellationToken,
        language,
      );
    case 'commit-copilot-cloud':
      return runOpenAIAgentLoop(
        apiKey,
        model,
        diff,
        repoRoot,
        onProgress,
        isStaged,
        gitOps,
        commitOutputOptions,
        cancellationToken,
        maxAgentSteps,
        COMMIT_COPILOT_CLOUD_OPENAI_BASE_URL,
        language,
      );
    default:
      throw new Error(
        `Unsupported provider for agent loop: ${String(provider)}`,
      );
  }
}
