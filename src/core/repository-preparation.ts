import type { GitOperations } from '../git/git-operations';
import type { CancellationSignal } from '../shared/cancellation';
import { throwIfCancellationRequested } from '../shared/cancellation';
import {
  MixedChangesError,
  NoChangesButUntrackedError,
  NoChangesError,
  NoTrackedChangesButUntrackedError,
  StageFailedError,
} from '../shared/errors';

export async function prepareRepositoryForGeneration(params: {
  gitOps: GitOperations;
  cancellationToken?: CancellationSignal;
  stageChanges: boolean;
  proceedWithStagedOnly: boolean;
}): Promise<void> {
  if (params.stageChanges) {
    throwIfCancellationRequested(params.cancellationToken);
    const staged = await params.gitOps.stageAllChanges();
    if (!staged) {
      throw new StageFailedError();
    }
    return;
  }

  if (!params.proceedWithStagedOnly && params.gitOps.hasMixedChanges()) {
    throw new MixedChangesError();
  }
}

export async function resolveGenerationDiff(params: {
  gitOps: GitOperations;
  stageChanges: boolean;
  ignoreUntracked: boolean;
  cancellationToken?: CancellationSignal;
}): Promise<{ diff: string; isStaged: boolean }> {
  let isStaged = true;
  let diff = await params.gitOps.getDiff(true);
  throwIfCancellationRequested(params.cancellationToken);

  if (!diff.trim() && !params.stageChanges) {
    const unstagedDiff = await params.gitOps.getDiff(false);
    throwIfCancellationRequested(params.cancellationToken);
    if (!params.ignoreUntracked && params.gitOps.hasUntrackedFiles()) {
      if (!unstagedDiff.trim()) {
        throw new NoTrackedChangesButUntrackedError();
      }
      throw new NoChangesButUntrackedError();
    }
    diff = unstagedDiff;
    isStaged = false;
  }

  if (!diff.trim()) {
    throw new NoChangesError();
  }

  return { diff, isStaged };
}
