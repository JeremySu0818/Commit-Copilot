import type { GitOperations } from '../../git/git-operations';
import type { EffectiveDisplayLanguage } from '../../i18n/types';
import {
  APIProvider,
  getOpenAICompatibleBaseUrl,
} from '../../llm/provider-registry';
import type { CustomProviderApiFormat } from '../../models/custom-provider';
import type { CommitOutputOptions } from '../../models/options';
import type { CancellationSignal } from '../../shared/cancellation';
import type { ProgressCallback } from '../../shared/progress';

import { runAnthropicAgentLoop } from './anthropic';
import { runGeminiAgentLoop } from './gemini';
import { runOllamaAgentLoop } from './ollama';
import { runOpenAIAgentLoop } from './openai';
import type { AgentLoopOptions } from './types';

export interface AgentDispatcherOptions {
  provider: APIProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  apiFormat?: CustomProviderApiFormat;
  maxTokens?: number;
  diff: string;
  repoRoot: string;
  onProgress?: ProgressCallback;
  isStaged: boolean;
  gitOps: GitOperations;
  commitOutputOptions: CommitOutputOptions;
  cancellationToken?: CancellationSignal;
  maxAgentSteps?: number;
  draftCommitMessage?: string;
  language: EffectiveDisplayLanguage;
  commitMessageLanguage?: EffectiveDisplayLanguage;
}

export async function runAgentLoop(
  options: AgentDispatcherOptions,
): Promise<string> {
  const runnerOptions: AgentLoopOptions = {
    apiKey: options.apiKey,
    model: options.model,
    diff: options.diff,
    repoRoot: options.repoRoot,
    onProgress: options.onProgress,
    isStaged: options.isStaged,
    gitOps: options.gitOps,
    commitOutputOptions: options.commitOutputOptions,
    cancellationToken: options.cancellationToken,
    maxAgentSteps: options.maxAgentSteps,
    draftCommitMessage: options.draftCommitMessage,
    language: options.language,
    commitMessageLanguage: options.commitMessageLanguage ?? 'en',
    maxTokens: options.maxTokens,
  };

  if (options.baseUrl) {
    if (options.apiFormat === 'anthropic') {
      return runAnthropicAgentLoop({
        ...runnerOptions,
        baseUrl: options.baseUrl,
      });
    }
    return runOpenAIAgentLoop({
      ...runnerOptions,
      baseUrl: options.baseUrl,
    });
  }

  switch (options.provider) {
    case 'google':
      return runGeminiAgentLoop(runnerOptions);
    case 'openai':
      return runOpenAIAgentLoop(runnerOptions);
    case 'anthropic':
      return runAnthropicAgentLoop(runnerOptions);
    case 'ollama':
      return runOllamaAgentLoop(runnerOptions);
    case 'grok':
    case 'groq':
    case 'openrouter':
    case 'deepseek':
    case 'qwen':
      return runOpenAIAgentLoop({
        ...runnerOptions,
        baseUrl: getOpenAICompatibleBaseUrl(options.provider),
      });
    default:
      throw new Error(
        `Unsupported provider for agent loop: ${options.provider as string}`,
      );
  }
}

export type { AgentLoopOptions } from './types';
