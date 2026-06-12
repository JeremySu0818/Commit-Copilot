import type { GitOperations } from '../../git/git-operations';
import type { EffectiveDisplayLanguage } from '../../i18n/types';
import type { CommitOutputOptions } from '../../models/options';
import type { CancellationSignal } from '../../shared/cancellation';
import type { ProgressCallback } from '../../shared/progress';

export interface AgentLoopOptions {
  apiKey: string;
  model?: string;
  diff: string;
  repoRoot: string;
  onProgress?: ProgressCallback;
  isStaged?: boolean;
  gitOps?: GitOperations;
  commitOutputOptions?: CommitOutputOptions;
  cancellationToken?: CancellationSignal;
  maxAgentSteps?: number;
  draftCommitMessage?: string;
  baseUrl?: string;
  language?: EffectiveDisplayLanguage;
  commitMessageLanguage?: EffectiveDisplayLanguage;
}
