import { APIProvider } from '../models';
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
      );
    default:
      throw new Error(`Unsupported provider for agent loop: ${provider}`);
  }
}

