import { APIProvider, DEFAULT_MODELS } from './models';
import { createLLMClient, ProgressCallback } from './llm-clients';
import { runAgentLoop } from './agent-loop';
import {
  EXIT_CODES,
  CommitCopilotError,
  NoChangesError,
  NoChangesButUntrackedError,
  NoTrackedChangesButUntrackedError,
  StageFailedError,
  MixedChangesError,
} from './errors';

export {
  EXIT_CODES,
  ERROR_MESSAGES,
  CommitCopilotError,
  APIKeyMissingError,
  APIKeyInvalidError,
  APIQuotaExceededError,
  APIRequestError,
  NoChangesError,
  NoChangesButUntrackedError,
  NoTrackedChangesButUntrackedError,
  StageFailedError,
  MixedChangesError,
} from './errors';

const STATUS_UNTRACKED = 7;
const MAX_COMMIT_LOG_ENTRIES = 2147483647;

interface GitChange {
  readonly uri: { fsPath: string };
  readonly status: number;
}

interface GitCommit {
  readonly message: string;
}

export interface GitRepository {
  readonly rootUri: { fsPath: string; toString(): string };
  readonly state: {
    readonly workingTreeChanges: ReadonlyArray<GitChange>;
    readonly indexChanges: ReadonlyArray<GitChange>;
    readonly untrackedChanges: ReadonlyArray<GitChange>;
  };
  readonly inputBox: { value: string };
  diff(cached?: boolean): Promise<string>;
  add(paths: string[]): Promise<void>;
  show(ref: string, path: string): Promise<string>;
  log(options?: { maxEntries?: number; path?: string }): Promise<GitCommit[]>;
  commit(message: string, opts?: { all?: boolean | 'tracked' }): Promise<void>;
  status(): Promise<void>;
}

export class GitOperations {
  constructor(private readonly repository: GitRepository) {}

  async isGitRepo(): Promise<boolean> {
    return true;
  }

  async getDiff(staged: boolean = true): Promise<string> {
    try {
      const diff = await this.repository.diff(staged);
      return diff;
    } catch (error: any) {
      console.error('Error running git diff:', error);
      return '';
    }
  }

  async show(filePath: string): Promise<string> {
    try {
      return await this.repository.show(':', filePath);
    } catch (error) {
      console.error('Error running git show:', error);
      return '';
    }
  }

  async showIndexFile(
    filePath: string,
  ): Promise<{ content: string; found: boolean }> {
    try {
      const content = await this.repository.show(':', filePath);
      return { content, found: true };
    } catch (error) {
      console.error('Error running git show for index file:', error);
      return { content: '', found: false };
    }
  }

  async getRecentCommitMessages(count: number): Promise<string[]> {
    if (count <= 0 || !Number.isFinite(count)) {
      return [];
    }
    try {
      const repoAny = this.repository as unknown as {
        log?: (options?: { maxEntries?: number; path?: string }) => Promise<
          GitCommit[]
        >;
      };
      if (typeof repoAny.log !== 'function') {
        console.error('Git log API not available on repository');
        return [];
      }
      const commits = await repoAny.log({ maxEntries: count });
      return commits.map((commit) => commit.message).filter(Boolean);
    } catch (error) {
      console.error('Error running git log:', error);
      return [];
    }
  }

  async getCommitCount(): Promise<number | null> {
    try {
      const repoAny = this.repository as unknown as {
        log?: (options?: { maxEntries?: number; path?: string }) => Promise<
          GitCommit[]
        >;
      };
      if (typeof repoAny.log !== 'function') {
        console.error('Git log API not available on repository');
        return null;
      }
      const commits = await repoAny.log({
        maxEntries: MAX_COMMIT_LOG_ENTRIES,
      });
      if (!Array.isArray(commits)) {
        return null;
      }
      return commits.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('does not have any commits') ||
        message.includes('no commits yet') ||
        message.includes('unknown revision') ||
        message.includes('bad revision') ||
        message.includes('Needed a single revision') ||
        (message.includes('ambiguous argument') && message.includes('HEAD'))
      ) {
        return 0;
      }
      console.error('Error running git log:', error);
      return null;
    }
  }

  async hasMixedChanges(): Promise<boolean> {
    const hasStaged = this.repository.state.indexChanges.length > 0;
    const hasUnstaged = this.repository.state.workingTreeChanges.length > 0;
    return hasStaged && hasUnstaged;
  }

  async stageAllChanges(): Promise<boolean> {
    try {
      const paths: string[] = [];

      for (const change of this.repository.state.workingTreeChanges) {
        paths.push(change.uri.fsPath);
      }
      for (const change of this.repository.state.untrackedChanges) {
        paths.push(change.uri.fsPath);
      }

      if (paths.length > 0) {
        await this.repository.add(paths);
      }
      return true;
    } catch (error) {
      console.error('Error staging changes:', error);
      return false;
    }
  }

  async commitChanges(message: string): Promise<boolean> {
    try {
      await this.repository.commit(message);
      return true;
    } catch (error) {
      console.error('Error committing changes:', error);
      return false;
    }
  }

  async hasUntrackedFiles(): Promise<boolean> {
    try {
      if (this.repository.state.untrackedChanges.length > 0) {
        return true;
      }
      return this.repository.state.workingTreeChanges.some(
        (change) => change.status === STATUS_UNTRACKED,
      );
    } catch {
      return false;
    }
  }

  getWorkingTreePaths(): string[] {
    try {
      return this.repository.state.workingTreeChanges.map(
        (change) => change.uri.fsPath,
      );
    } catch {
      return [];
    }
  }

  getUntrackedPaths(): string[] {
    try {
      const paths = new Set<string>();
      for (const change of this.repository.state.untrackedChanges) {
        paths.add(change.uri.fsPath);
      }
      for (const change of this.repository.state.workingTreeChanges) {
        if (change.status === STATUS_UNTRACKED) {
          paths.add(change.uri.fsPath);
        }
      }
      return [...paths];
    } catch {
      return [];
    }
  }

  async stageFiles(files: string[]): Promise<boolean> {
    if (files.length === 0) {
      return true;
    }
    try {
      await this.repository.add(files);
      return true;
    } catch (error) {
      console.error('Error staging files:', error);
      return false;
    }
  }
}

export interface GenerateCommitMessageOptions {
  repository: GitRepository;
  provider: APIProvider;
  apiKey: string;
  model?: string;
  stageChanges?: boolean;
  ignoreUntracked?: boolean;
  onProgress?: ProgressCallback;
  proceedWithStagedOnly?: boolean;
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
    model,
    stageChanges = true,
    ignoreUntracked = false,
    onProgress,
    proceedWithStagedOnly = false,
  } = options;
  try {
    const gitOps = new GitOperations(repository);
    if (!(await gitOps.isGitRepo())) {
      throw new CommitCopilotError(
        'Not a git repository. Please run this command inside a git repository.',
        'NOT_GIT_REPO',
        EXIT_CODES.NOT_GIT_REPO,
      );
    }

    if (stageChanges) {
      const staged = await gitOps.stageAllChanges();
      if (!staged) {
        throw new StageFailedError();
      }
    } else if (!proceedWithStagedOnly && (await gitOps.hasMixedChanges())) {
      throw new MixedChangesError();
    }

    let isStaged = true;
    let diff = await gitOps.getDiff(true);

    if (!diff.trim() && !stageChanges) {
      const unstagedDiff = await gitOps.getDiff(false);
      if (!ignoreUntracked && (await gitOps.hasUntrackedFiles())) {
        if (!unstagedDiff.trim()) {
          throw new NoTrackedChangesButUntrackedError();
        } else {
          throw new NoChangesButUntrackedError();
        }
      }
      diff = unstagedDiff;
      isStaged = false;
    }

    if (!diff.trim()) {
      throw new NoChangesError();
    }
    const repoRoot = repository.rootUri.fsPath;
    const commitMessage = await runAgentLoop({
      provider,
      apiKey,
      model: model || DEFAULT_MODELS[provider],
      diff,
      repoRoot,
      onProgress,
      isStaged,
      gitOps,
    });
    return {
      success: true,
      message: commitMessage,
    };
  } catch (error) {
    if (error instanceof CommitCopilotError) {
      return {
        success: false,
        error: error,
      };
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
