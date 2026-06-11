import { CancellationSignal } from '../cancellation';
import { GitOperations } from '../commit-copilot';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import { ProgressCallback } from '../llm-clients';
import { APIProvider, CommitOutputOptions } from '../models';

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
  draftCommitMessage?: string;
  language: EffectiveDisplayLanguage;
  commitMessageLanguage?: EffectiveDisplayLanguage;
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
    draftCommitMessage,
    language,
    commitMessageLanguage = 'en',
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
      draftCommitMessage,
      baseUrl,
      language,
      commitMessageLanguage,
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
        draftCommitMessage,
        language,
        commitMessageLanguage,
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
        draftCommitMessage,
        undefined,
        language,
        commitMessageLanguage,
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
        draftCommitMessage,
        language,
        commitMessageLanguage,
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
        maxAgentSteps,
        draftCommitMessage,
        language,
        commitMessageLanguage,
      );
    case 'grok':
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
        draftCommitMessage,
        'https://api.x.ai/v1',
        language,
        commitMessageLanguage,
      );
    case 'groq':
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
        draftCommitMessage,
        'https://api.groq.com/openai/v1',
        language,
        commitMessageLanguage,
      );
    case 'openrouter':
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
        draftCommitMessage,
        'https://openrouter.ai/api/v1',
        language,
        commitMessageLanguage,
      );
    case 'deepseek':
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
        draftCommitMessage,
        'https://api.deepseek.com',
        language,
        commitMessageLanguage,
      );
    case 'qwen':
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
        draftCommitMessage,
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
        language,
        commitMessageLanguage,
      );
    default:
      throw new Error(
        `Unsupported provider for agent loop: ${provider as string}`,
      );
  }
}
