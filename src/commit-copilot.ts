import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { runAgentLoop } from './agent-loop';
import {
  CancellationSignal,
  throwIfCancellationRequested,
} from './cancellation';
import {
  EXIT_CODES,
  CommitCopilotError,
  NoChangesError,
  NoChangesButUntrackedError,
  NoTrackedChangesButUntrackedError,
  StageFailedError,
  MixedChangesError,
} from './errors';
import type { EffectiveDisplayLanguage } from './i18n/types';
import { createLLMClient, ProgressCallback } from './llm-clients';
import {
  APIProvider,
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_GENERATE_MODE,
  DEFAULT_MODELS,
  GenerateMode,
  normalizeCommitOutputOptions,
} from './models';

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
const MAX_COMMIT_LOG_ENTRIES_FALLBACK = 1000;
const GIT_COMMIT_COUNT_TIMEOUT_MS = 15000;
const GIT_LS_FILES_TIMEOUT_MS = 15000;
const bytesPerKiB = 1024;
const bytesPerMiB = bytesPerKiB * bytesPerKiB;
const gitLsFilesMaxBufferMiB = 20;
const GIT_LS_FILES_MAX_BUFFER = gitLsFilesMaxBufferMiB * bytesPerMiB;
const execFileAsync = promisify(execFile);

function isNoCommitsError(message: string): boolean {
  return (
    message.includes('does not have any commits') ||
    message.includes('no commits yet') ||
    message.includes('unknown revision') ||
    message.includes('bad revision') ||
    message.includes('Needed a single revision') ||
    (message.includes('ambiguous argument') && message.includes('HEAD'))
  );
}

function getStringProperty(value: unknown, key: string): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    key in value &&
    typeof (value as Record<string, unknown>)[key] === 'string'
  ) {
    return String((value as Record<string, unknown>)[key]);
  }
  return '';
}

interface GitChange {
  readonly uri: { fsPath: string };
  readonly status: number;
}

interface GitCommit {
  readonly message: string;
}

function normalizeGitPathCandidate(
  filePath: string,
  repoRoot: string,
): string | null {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;
  if (path.isAbsolute(candidate)) {
    const relPath = path.relative(repoRoot, candidate);
    if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) {
      return null;
    }
    candidate = relPath;
  }

  const normalized = candidate.replace(/\\/g, '/');
  if (
    !normalized ||
    normalized.startsWith('../') ||
    path.isAbsolute(normalized)
  ) {
    return null;
  }

  return normalized;
}

function normalizeGitFileList(
  files: unknown,
  repoRoot: string | undefined,
): string[] | null {
  if (!Array.isArray(files)) {
    return null;
  }

  const normalizedFiles: string[] = [];
  for (const filePath of files) {
    if (typeof filePath !== 'string') {
      continue;
    }

    if (path.isAbsolute(filePath) && !repoRoot) {
      continue;
    }

    const normalized = normalizeGitPathCandidate(filePath, repoRoot ?? '');
    if (normalized) {
      normalizedFiles.push(normalized);
    }
  }
  return normalizedFiles;
}

export interface GitRepository {
  readonly rootUri: { fsPath: string; toString(): string };
  readonly state: {
    readonly workingTreeChanges: readonly GitChange[];
    readonly indexChanges: readonly GitChange[];
    readonly untrackedChanges: readonly GitChange[];
  };
  readonly inputBox: { value: string };
  diff(cached?: boolean): Promise<string>;
  lsFiles?(path?: string): Promise<string[]>;
  add(paths: string[]): Promise<void>;
  show(ref: string, path: string): Promise<string>;
  log(options?: { maxEntries?: number; path?: string }): Promise<GitCommit[]>;
  commit(message: string, opts?: { all?: boolean | 'tracked' }): Promise<void>;
  status(): Promise<void>;
}

export class GitOperations {
  constructor(private readonly repository: GitRepository) {}

  async isGitRepo(): Promise<boolean> {
    const rootPath = this.repository.rootUri.fsPath;
    if (!rootPath) {
      return false;
    }

    const gitPath = path.join(rootPath, '.git');
    const gitPathExists = await fs.promises
      .stat(gitPath)
      .then((stat) => stat.isDirectory() || stat.isFile())
      .catch(() => false);
    if (gitPathExists) {
      return true;
    }

    try {
      await this.repository.status();
      return true;
    } catch {
      return false;
    }
  }

  async getDiff(staged = true): Promise<string> {
    const diff = await this.repository.diff(staged);
    return diff;
  }

  async show(filePath: string): Promise<string | null> {
    try {
      return await this.repository.show(':', filePath);
    } catch (error) {
      console.error('Error running git show:', error);
      return null;
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
        log?: (options?: {
          maxEntries?: number;
          path?: string;
        }) => Promise<GitCommit[]>;
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

  async listFilesFromGitApi(): Promise<string[] | null> {
    const repoRoot = this.repository.rootUri.fsPath;

    try {
      if (typeof this.repository.lsFiles === 'function') {
        try {
          const apiFiles = await this.repository.lsFiles('');
          const normalized = normalizeGitFileList(apiFiles, repoRoot);
          if (normalized !== null) {
            return normalized;
          }
        } catch {
          const apiFiles = await this.repository.lsFiles();
          const normalized = normalizeGitFileList(apiFiles, repoRoot);
          if (normalized !== null) {
            return normalized;
          }
        }
      }
    } catch (error) {
      console.error('Error listing files via VS Code Git API:', error);
    }

    if (!repoRoot) {
      return null;
    }

    try {
      const { stdout } = await execFileAsync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard'],
        {
          cwd: repoRoot,
          windowsHide: true,
          maxBuffer: GIT_LS_FILES_MAX_BUFFER,
          timeout: GIT_LS_FILES_TIMEOUT_MS,
        },
      );
      const cliFiles = stdout.split(/\r?\n/).filter(Boolean);
      const normalized = normalizeGitFileList(cliFiles, repoRoot);
      return normalized ?? null;
    } catch (error) {
      console.error('Error listing files via git ls-files:', error);
      return null;
    }
  }

  async getCommitCount(): Promise<number | null> {
    try {
      const repoRoot = this.repository.rootUri.fsPath;
      if (repoRoot) {
        const count = await this.getCommitCountFromCli(repoRoot);
        if (count !== null) {
          return count;
        }
      }

      const repoAny = this.repository as unknown as {
        log?: (options?: {
          maxEntries?: number;
          path?: string;
        }) => Promise<GitCommit[]>;
      };
      if (typeof repoAny.log !== 'function') {
        console.error('Git log API not available on repository');
        return null;
      }
      const commits = await repoAny.log({
        maxEntries: MAX_COMMIT_LOG_ENTRIES_FALLBACK,
      });
      if (!Array.isArray(commits)) {
        return null;
      }
      if (commits.length < MAX_COMMIT_LOG_ENTRIES_FALLBACK) {
        return commits.length;
      }
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isNoCommitsError(message)) {
        return 0;
      }
      console.error('Error running git log:', error);
      return null;
    }
  }

  private async getCommitCountFromCli(
    repoRoot: string,
  ): Promise<number | null> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['rev-list', '--count', 'HEAD'],
        {
          cwd: repoRoot,
          windowsHide: true,
          maxBuffer: bytesPerMiB,
          timeout: GIT_COMMIT_COUNT_TIMEOUT_MS,
        },
      );
      const trimmed = stdout.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    } catch (error: unknown) {
      const stderr = getStringProperty(error, 'stderr');
      const errorMessage =
        error instanceof Error
          ? error.message
          : getStringProperty(error, 'message');
      const message = [stderr, errorMessage]
        .filter((segment): segment is string => segment.length > 0)
        .join(' ');
      if (isNoCommitsError(message)) {
        return 0;
      }
      console.error('Error running git rev-list --count:', error);
      return null;
    }
  }

  hasMixedChanges(): boolean {
    const hasStaged = this.repository.state.indexChanges.length > 0;
    const hasUnstaged = this.repository.state.workingTreeChanges.length > 0;
    return hasStaged && hasUnstaged;
  }

  async stageAllChanges(): Promise<boolean> {
    try {
      await this.repository.status();
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

  hasUntrackedFiles(): boolean {
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
  baseUrl?: string;
  cancellationToken?: CancellationSignal;
  model?: string;
  generateMode?: GenerateMode;
  commitOutputOptions?: CommitOutputOptions;
  stageChanges?: boolean;
  ignoreUntracked?: boolean;
  onProgress?: ProgressCallback;
  proceedWithStagedOnly?: boolean;
  maxAgentSteps?: number;
  language: EffectiveDisplayLanguage;
}

export interface GenerateCommitMessageResult {
  success: boolean;
  message?: string;
  error?: CommitCopilotError;
}

async function prepareRepositoryForGeneration(params: {
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

async function resolveGenerationDiff(params: {
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

async function generateMessageWithProvider(params: {
  repository: GitRepository;
  provider: APIProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  generateMode: GenerateMode;
  commitOutputOptions: CommitOutputOptions;
  onProgress?: ProgressCallback;
  cancellationToken?: CancellationSignal;
  maxAgentSteps?: number;
  language: EffectiveDisplayLanguage;
  diff: string;
  isStaged: boolean;
  gitOps: GitOperations;
}): Promise<string> {
  const resolvedGenerateMode: GenerateMode =
    params.provider === 'ollama' ? 'direct-diff' : params.generateMode;
  const resolvedModel =
    params.model && params.model.length > 0
      ? params.model
      : DEFAULT_MODELS[params.provider];
  const resolvedCommitOutputOptions = normalizeCommitOutputOptions(
    params.commitOutputOptions,
  );
  const repoRoot = params.repository.rootUri.fsPath;

  if (resolvedGenerateMode === 'agentic') {
    return runAgentLoop({
      provider: params.provider,
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      model: resolvedModel,
      diff: params.diff,
      repoRoot,
      onProgress: params.onProgress,
      isStaged: params.isStaged,
      gitOps: params.gitOps,
      commitOutputOptions: resolvedCommitOutputOptions,
      cancellationToken: params.cancellationToken,
      maxAgentSteps: params.maxAgentSteps,
      language: params.language,
    });
  }

  return createLLMClient({
    provider: params.provider,
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    ollamaHost: params.provider === 'ollama' ? params.apiKey : undefined,
    model: resolvedModel,
    commitOutputOptions: resolvedCommitOutputOptions,
  }).generateCommitMessage(
    params.diff,
    params.onProgress,
    params.cancellationToken,
  );
}

export async function generateCommitMessage(
  options: GenerateCommitMessageOptions,
): Promise<GenerateCommitMessageResult> {
  const {
    repository,
    provider,
    apiKey,
    baseUrl,
    cancellationToken,
    model,
    generateMode = DEFAULT_GENERATE_MODE,
    commitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
    stageChanges = false,
    ignoreUntracked = false,
    onProgress,
    proceedWithStagedOnly = false,
    maxAgentSteps,
    language,
  } = options;
  try {
    throwIfCancellationRequested(cancellationToken);
    const gitOps = new GitOperations(repository);
    if (!(await gitOps.isGitRepo())) {
      throw new CommitCopilotError(
        'Not a git repository. Please run this command inside a git repository.',
        'NOT_GIT_REPO',
        EXIT_CODES.NOT_GIT_REPO,
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
      model,
      generateMode,
      commitOutputOptions,
      onProgress,
      cancellationToken,
      maxAgentSteps,
      language,
      diff,
      isStaged,
      gitOps,
    });
    throwIfCancellationRequested(cancellationToken);
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
