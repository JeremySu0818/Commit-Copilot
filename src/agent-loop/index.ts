import { APIProvider, CommitOutputOptions } from '../models';
import { ProgressCallback } from '../llm-clients';
import { GitOperations } from '../commit-copilot';
import { CancellationSignal } from '../cancellation';
import { runGeminiAgentLoop } from './gemini';
import { runOpenAIAgentLoop } from './openai';
import { runAnthropicAgentLoop } from './anthropic';
import { runOllamaAgentLoop } from './ollama';

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
      );
    default:
      throw new Error(`Unsupported provider for agent loop: ${provider}`);
  }
}
