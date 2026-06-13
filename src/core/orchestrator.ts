import { GitOperations } from '../git/git-operations';
import type { GitRepository } from '../git/types';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import type { APIProvider } from '../llm/provider-registry';
import type { CustomProviderApiFormat } from '../models/custom-provider';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_GENERATE_MODE,
  GenerateMode,
} from '../models/options';
import type { CancellationSignal } from '../shared/cancellation';
import { throwIfCancellationRequested } from '../shared/cancellation';
import { CommitCopilotError, EXIT_CODES } from '../shared/errors';
import type { ProgressCallback } from '../shared/progress';

import { generateMessageWithProvider } from './provider-routing';
import {
  prepareRepositoryForGeneration,
  resolveGenerationDiff,
} from './repository-preparation';

export interface GenerateCommitMessageOptions {
  repository: GitRepository;
  provider: APIProvider;
  apiKey: string;
  baseUrl?: string;
  apiFormat?: CustomProviderApiFormat;
  maxTokens?: number;
  cancellationToken?: CancellationSignal;
  model?: string;
  generateMode?: GenerateMode;
  commitOutputOptions?: CommitOutputOptions;
  stageChanges?: boolean;
  ignoreUntracked?: boolean;
  onProgress?: ProgressCallback;
  proceedWithStagedOnly?: boolean;
  maxAgentSteps?: number;
  draftCommitMessage?: string;
  language: EffectiveDisplayLanguage;
  commitMessageLanguage?: EffectiveDisplayLanguage;
}

export interface GenerateCommitMessageResult {
  success: boolean;
  message?: string;
  error?: CommitCopilotError;
}

export async function generateCommitMessage(
  options: GenerateCommitMessageOptions,
): Promise<GenerateCommitMessageResult> {
  const {
    repository,
    provider,
    apiKey,
    baseUrl,
    apiFormat,
    maxTokens,
    cancellationToken,
    model,
    generateMode = DEFAULT_GENERATE_MODE,
    commitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
    stageChanges = false,
    ignoreUntracked = false,
    onProgress,
    proceedWithStagedOnly = false,
    maxAgentSteps,
    draftCommitMessage,
    language,
    commitMessageLanguage = 'en',
  } = options;
  try {
    throwIfCancellationRequested(cancellationToken);
    const gitOps = new GitOperations(repository);
    if (!(await gitOps.isGitRepo())) {
      throw new CommitCopilotError(
        'NOT_GIT_REPO',
        'NOT_GIT_REPO',
        EXIT_CODES.NOT_GIT_REPO,
        { messageKey: 'git.notRepository' },
      );
    }

    await prepareRepositoryForGeneration({
      gitOps,
      cancellationToken,
      stageChanges,
      proceedWithStagedOnly,
    });
    const { diff, isStaged } = await resolveGenerationDiff({
      gitOps,
      stageChanges,
      ignoreUntracked,
      cancellationToken,
    });
    const commitMessage = await generateMessageWithProvider({
      repository,
      provider,
      apiKey,
      baseUrl,
      apiFormat,
      maxTokens,
      model,
      generateMode,
      commitOutputOptions,
      onProgress,
      cancellationToken,
      maxAgentSteps,
      draftCommitMessage,
      language,
      commitMessageLanguage,
      diff,
      isStaged,
      gitOps,
    });
    throwIfCancellationRequested(cancellationToken);
    return { success: true, message: commitMessage };
  } catch (error) {
    if (error instanceof CommitCopilotError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new CommitCopilotError(
        error instanceof Error ? error.message : String(error),
        'UNKNOWN',
        EXIT_CODES.UNKNOWN_ERROR,
      ),
    };
  }
}

export {
  prepareRepositoryForGeneration,
  resolveGenerationDiff,
} from './repository-preparation';
