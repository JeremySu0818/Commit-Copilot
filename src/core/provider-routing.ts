import { runAgentLoop } from '../agent/loop';
import type { GitOperations } from '../git/git-operations';
import type { GitRepository } from '../git/types';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import { createLLMClient } from '../llm/clients';
import { APIProvider, DEFAULT_MODELS } from '../llm/provider-registry';
import type { CustomProviderApiFormat } from '../models/custom-provider';
import {
  AgenticGenerationOptions,
  CommitOutputOptions,
  GenerateMode,
  normalizeAgenticGenerationOptions,
  normalizeCommitOutputOptions,
} from '../models/options';
import type { ProgressCallback } from '../shared/progress';

export async function generateMessageWithProvider(params: {
  repository: GitRepository;
  provider: APIProvider;
  apiKey: string;
  baseUrl?: string;
  apiFormat?: CustomProviderApiFormat;
  maxTokens?: number;
  model?: string;
  generateMode: GenerateMode;
  commitOutputOptions: CommitOutputOptions;
  agenticGenerationOptions: AgenticGenerationOptions;
  onProgress?: ProgressCallback;
  cancellationToken?: import('../shared/cancellation').CancellationSignal;
  maxAgentSteps?: number;
  draftCommitMessage?: string;
  language: EffectiveDisplayLanguage;
  commitMessageLanguage: EffectiveDisplayLanguage;
  diff: string;
  isStaged: boolean;
  gitOps: GitOperations;
}): Promise<string> {
  const resolvedModel =
    params.model && params.model.length > 0
      ? params.model
      : DEFAULT_MODELS[params.provider];
  const resolvedCommitOutputOptions = normalizeCommitOutputOptions(
    params.commitOutputOptions,
  );
  const resolvedAgenticGenerationOptions = normalizeAgenticGenerationOptions(
    params.agenticGenerationOptions,
  );
  const repoRoot = params.repository.rootUri.fsPath;

  if (params.generateMode === 'agentic') {
    return runAgentLoop({
      provider: params.provider,
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      apiFormat: params.apiFormat,
      maxTokens: params.maxTokens,
      model: resolvedModel,
      diff: params.diff,
      repoRoot,
      onProgress: params.onProgress,
      isStaged: params.isStaged,
      gitOps: params.gitOps,
      commitOutputOptions: resolvedCommitOutputOptions,
      cancellationToken: params.cancellationToken,
      maxAgentSteps: params.maxAgentSteps,
      enforceDiffCoverage: resolvedAgenticGenerationOptions.enforceDiffCoverage,
      draftCommitMessage: params.draftCommitMessage,
      language: params.language,
      commitMessageLanguage: params.commitMessageLanguage,
    });
  }

  return createLLMClient({
    provider: params.provider,
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    apiFormat: params.apiFormat,
    maxTokens: params.maxTokens,
    ollamaHost: params.provider === 'ollama' ? params.apiKey : undefined,
    model: resolvedModel,
    commitOutputOptions: resolvedCommitOutputOptions,
    language: params.language,
    commitMessageLanguage: params.commitMessageLanguage,
  }).generateCommitMessage(
    params.diff,
    params.draftCommitMessage,
    params.onProgress,
    params.cancellationToken,
  );
}
