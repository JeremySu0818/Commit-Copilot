import { runAgentLoop } from '../agent/loop';
import type { GitOperations } from '../git/git-operations';
import type { GitRepository } from '../git/types';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import { createLLMClient } from '../llm/clients';
import { APIProvider } from '../llm/provider-registry';
import type { CustomProviderApiFormat } from '../models/custom-provider';
import { fetchProviderModels } from '../models/discovery';
import {
  AgenticGenerationOptions,
  CommitOutputOptions,
  GenerateMode,
  normalizeAgenticGenerationOptions,
  normalizeCommitOutputOptions,
} from '../models/options';
import { APIRequestError } from '../shared/errors';
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
  let resolvedModel = params.model;
  if (!resolvedModel && !params.baseUrl) {
    resolvedModel = (
      await fetchProviderModels(params.provider, params.apiKey)
    )[0]?.id;
  }
  if (!resolvedModel) {
    throw new APIRequestError(
      'No model available. Select a model in provider settings.',
    );
  }
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
