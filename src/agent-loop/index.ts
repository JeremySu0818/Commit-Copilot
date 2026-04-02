import { APIProvider, CommitOutputOptions } from '../models';
import { ProgressCallback } from '../llm-clients';
import { GitOperations } from '../commit-copilot';
import { runGeminiAgentLoop } from './gemini';
import { runOpenAIAgentLoop } from './openai';
import { runAnthropicAgentLoop } from './anthropic';
import { runOllamaAgentLoop } from './ollama';

interface AgentLoopOptions {
  provider: APIProvider;
  apiKey: string;
  model?: string;
  diff: string;
  repoRoot: string;
  onProgress?: ProgressCallback;
  isStaged: boolean;
  gitOps: GitOperations;
  commitOutputOptions: CommitOutputOptions;
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<string> {
  const {
    provider,
    apiKey,
    model,
    diff,
    repoRoot,
    onProgress,
    isStaged,
    gitOps,
    commitOutputOptions,
  } = options;

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
      );
    default:
      throw new Error(`Unsupported provider for agent loop: ${provider}`);
  }
}
