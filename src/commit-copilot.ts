import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
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
  GenerationCancelledError,
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
const GIT_COMMIT_COUNT_TIMEOUT_MS = 15000;
const GIT_LS_FILES_TIMEOUT_MS = 15000;
const bytesPerKiB = 1024;
const bytesPerMiB = bytesPerKiB * bytesPerKiB;
const GIT_LS_FILES_MAX_BUFFER = Number.POSITIVE_INFINITY;
const GIT_SHOW_TIMEOUT_MS = 30000;
const GIT_LOG_TIMEOUT_MS = 30000;
const GIT_DIFF_TIMEOUT_MS = 30000;
const GIT_COMMIT_TREE_TIMEOUT_MS = 30000;
const GIT_PUSH_TIMEOUT_MS = 120000;
const rewriteTempDirPrefix = 'rewrite-';
const commitRecordSeparator = '\x1e';
const commitFieldSeparator = '\x1f';
const GIT_SHOW_MAX_BUFFER = Number.POSITIVE_INFINITY;
const GIT_DIFF_MAX_BUFFER = Number.POSITIVE_INFINITY;
const GIT_LOG_MAX_BUFFER = Number.POSITIVE_INFINITY;
const GIT_COMMIT_TREE_MAX_BUFFER = Number.POSITIVE_INFINITY;
const rewriteCommitLineFieldCount = 4;
const rewriteCommitHashFieldIndex = 0;
const rewriteCommitShortHashFieldIndex = 1;
const rewriteCommitSubjectFieldIndex = 2;
const rewriteCommitParentsFieldIndex = 3;
const rewriteSnapshotHashLength = 12;
const rewriteSnapshotTimestampRadix = 36;
const gitCommandEnvPathKey = 'COMMIT_COPILOT_GIT_PATH';
const gitTreeRecordSeparator = '\0';
const gitTreeMetadataPathSeparator = '\t';
const gitTreeMetadataFieldCountMin = 2;
const gitTreeBlobType = 'blob';
const gitTreeSymlinkMode = '120000';
const byteMask = 0xff;
const gitPathOctalMaxDigits = 3;
const gitEscapeSequenceLength = 2;
const execFileAsync = promisify(execFile);

function resolveGitExecutablePath(): string {
  const explicitPath = process.env[gitCommandEnvPathKey];
  if (explicitPath && explicitPath.trim().length > 0) {
    return explicitPath.trim();
  }

  if (process.platform === 'win32') {
    const roots = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      process.env.LocalAppData,
    ].filter((root): root is string => typeof root === 'string');
    const relativeCandidates = [
      ['Git', 'cmd', 'git.exe'],
      ['Git', 'bin', 'git.exe'],
      ['Programs', 'Git', 'cmd', 'git.exe'],
      ['Programs', 'Git', 'bin', 'git.exe'],
    ];

    for (const root of roots) {
      for (const relativePath of relativeCandidates) {
        const candidate = path.join(root, ...relativePath);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }

  const unixCandidate = '/usr/bin/git';
  if (fs.existsSync(unixCandidate)) {
    return unixCandidate;
  }

  return 'git';
}

const gitExecutablePath = resolveGitExecutablePath();

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

function isCancellationLikeError(error: unknown): boolean {
  if (error instanceof GenerationCancelledError) {
    return true;
  }

  if (
    error instanceof CommitCopilotError &&
    error.exitCode === EXIT_CODES.CANCELLED
  ) {
    return true;
  }

  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const maybeError = error as Record<string, unknown>;
  const name = getStringProperty(maybeError, 'name').toLowerCase();
  const message = getStringProperty(maybeError, 'message').toLowerCase();
  const rawCode = maybeError.code;
  const code =
    typeof rawCode === 'string' || typeof rawCode === 'number'
      ? String(rawCode).toUpperCase()
      : '';

  if (
    name === 'aborterror' ||
    name === 'cancellationerror' ||
    name === 'cancellederror' ||
    name === 'cancelederror'
  ) {
    return true;
  }

  if (
    code === 'ABORT_ERR' ||
    code === 'ERR_CANCELED' ||
    code === 'ERR_CANCELLED' ||
    code === 'CANCELED' ||
    code === 'CANCELLED'
  ) {
    return true;
  }

  return (
    message.includes('cancelled') ||
    message.includes('canceled') ||
    message.includes('operation aborted') ||
    message.includes('request aborted')
  );
}

interface GitChange {
  readonly uri: { fsPath: string };
  readonly status: number;
}

interface GitCommit {
  readonly message: string;
}

export interface RewriteCommitEntry {
  hash: string;
  shortHash: string;
  subject: string;
  parentHashes: string[];
}

interface ResolvedRewriteCommit {
  hash: string;
  parentHash: string | null;
  parentHashes: string[];
}

interface RewriteCommitSnapshot {
  workspaceRoot: string;
  files: string[];
}

interface RevisionTreeEntry {
  path: string;
  mode: string;
  type: string;
}

const gitQuotedPathEscapeToByte: Readonly<Record<string, number>> = {
  '"': '"'.charCodeAt(0),
  '\\': '\\'.charCodeAt(0),
  a: 0x07,
  b: 0x08,
  f: 0x0c,
  n: 0x0a,
  r: 0x0d,
  t: 0x09,
  v: 0x0b,
};

function isOctalDigit(value: string): boolean {
  return value >= '0' && value <= '7';
}

function readGitQuotedPathOctalEscape(
  source: string,
  startIndex: number,
): { byte: number; nextIndex: number } {
  let octalValue = source[startIndex];
  let index = startIndex + 1;
  while (octalValue.length < gitPathOctalMaxDigits && index < source.length) {
    const nextChar = source[index];
    if (!isOctalDigit(nextChar)) {
      break;
    }
    octalValue += nextChar;
    index += 1;
  }
  return { byte: Number.parseInt(octalValue, 8), nextIndex: index };
}

function decodeQuotedGitPath(candidate: string): string {
  if (!(candidate.startsWith('"') && candidate.endsWith('"'))) {
    return candidate;
  }

  const source = candidate.slice(1, -1);
  const bytes: number[] = [];
  let index = 0;
  while (index < source.length) {
    const current = source[index];
    if (current !== '\\') {
      bytes.push(source.charCodeAt(index) & byteMask);
      index += 1;
      continue;
    }

    const escaped = source[index + 1];
    if (!escaped) {
      bytes.push('\\'.charCodeAt(0));
      index += 1;
      continue;
    }

    if (isOctalDigit(escaped)) {
      const parsed = readGitQuotedPathOctalEscape(source, index + 1);
      bytes.push(parsed.byte);
      index = parsed.nextIndex;
      continue;
    }

    const escapedByte = gitQuotedPathEscapeToByte[escaped];
    bytes.push(
      typeof escapedByte === 'number'
        ? escapedByte
        : escaped.charCodeAt(0) & byteMask,
    );
    index += gitEscapeSequenceLength;
  }

  return Buffer.from(bytes).toString('utf8');
}

function normalizeGitPathCandidate(
  filePath: string,
  repoRoot: string,
): string | null {
  const trimmed = decodeQuotedGitPath(filePath.trim());
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

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseRewriteCommitLine(line: string): RewriteCommitEntry | null {
  const fields = line.split(commitFieldSeparator);
  if (fields.length < rewriteCommitLineFieldCount) {
    return null;
  }
  const hash = fields[rewriteCommitHashFieldIndex].trim();
  const shortHash = fields[rewriteCommitShortHashFieldIndex].trim();
  const subject = fields[rewriteCommitSubjectFieldIndex].trim();
  const parentsRaw = fields[rewriteCommitParentsFieldIndex].trim();
  if (!hash || !shortHash) {
    return null;
  }
  const parentHashes = parentsRaw
    .split(/\s+/)
    .map((parent) => parent.trim())
    .filter((parent) => parent.length > 0);
  return {
    hash,
    shortHash,
    subject,
    parentHashes,
  };
}

function parseRevisionParents(value: string): ResolvedRewriteCommit | null {
  const parts = splitLines(value)[0]?.split(/\s+/) ?? [];
  if (parts.length === 0) {
    return null;
  }
  const [hash, ...parentHashes] = parts;
  if (!hash) {
    return null;
  }
  return {
    hash,
    parentHash: parentHashes[0] ?? null,
    parentHashes,
  };
}

function parseCommitMessages(value: string): string[] {
  return value
    .split(commitRecordSeparator)
    .map((entry) => entry.replace(/\r/g, '').trim())
    .filter((entry) => entry.length > 0);
}

async function runGitTextCommand(params: {
  repoRoot: string;
  args: string[];
  timeout: number;
  maxBuffer: number;
  env?: NodeJS.ProcessEnv;
}): Promise<string> {
  const { stdout } = await execFileAsync(gitExecutablePath, params.args, {
    cwd: params.repoRoot,
    windowsHide: true,
    timeout: params.timeout,
    maxBuffer: params.maxBuffer,
    ...(params.env ? { env: params.env } : {}),
  });
  return stdout;
}

async function runGitBufferCommand(params: {
  repoRoot: string;
  args: string[];
  timeout: number;
  maxBuffer: number;
}): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    execFile(
      gitExecutablePath,
      params.args,
      {
        cwd: params.repoRoot,
        windowsHide: true,
        timeout: params.timeout,
        maxBuffer: params.maxBuffer,
        encoding: 'buffer',
      },
      (error, stdout) => {
        if (error) {
          const message =
            error instanceof Error
              ? error.message
              : getStringProperty(error, 'message') || 'Unknown git error';
          reject(new Error(message));
          return;
        }
        if (Buffer.isBuffer(stdout)) {
          resolve(stdout);
          return;
        }
        resolve(Buffer.from(stdout));
      },
    );
  });
}

async function resolveRewriteCommit(
  repoRoot: string,
  commitHash: string,
): Promise<ResolvedRewriteCommit | null> {
  const output = await runGitTextCommand({
    repoRoot,
    args: ['rev-list', '--parents', '-n', '1', commitHash],
    timeout: GIT_LOG_TIMEOUT_MS,
    maxBuffer: GIT_LOG_MAX_BUFFER,
  });
  return parseRevisionParents(output);
}

async function readCommitDiff(
  repoRoot: string,
  resolvedCommit: ResolvedRewriteCommit,
): Promise<string> {
  const args =
    resolvedCommit.parentHash !== null
      ? [
          'diff',
          '--no-ext-diff',
          '--binary',
          resolvedCommit.parentHash,
          resolvedCommit.hash,
        ]
      : ['show', '--format=', '--no-ext-diff', '--binary', resolvedCommit.hash];
  return runGitTextCommand({
    repoRoot,
    args,
    timeout: GIT_DIFF_TIMEOUT_MS,
    maxBuffer: GIT_DIFF_MAX_BUFFER,
  });
}

async function listRevisionFiles(
  repoRoot: string,
  revision: string,
): Promise<RevisionTreeEntry[]> {
  const output = await runGitTextCommand({
    repoRoot,
    args: ['-c', 'core.quotepath=false', 'ls-tree', '-rz', revision],
    timeout: GIT_LOG_TIMEOUT_MS,
    maxBuffer: GIT_LOG_MAX_BUFFER,
  });
  return parseRevisionTreeEntries(output, repoRoot);
}

function parseRevisionTreeEntries(
  value: string,
  repoRoot: string,
): RevisionTreeEntry[] {
  const entries: RevisionTreeEntry[] = [];
  const records = value.split(gitTreeRecordSeparator);
  for (const record of records) {
    if (!record) {
      continue;
    }

    const separatorIndex = record.indexOf(gitTreeMetadataPathSeparator);
    if (separatorIndex <= 0) {
      continue;
    }

    const metadata = record.slice(0, separatorIndex).trim();
    const rawPath = record.slice(separatorIndex + 1);
    const metadataParts = metadata.split(/\s+/);
    if (metadataParts.length < gitTreeMetadataFieldCountMin) {
      continue;
    }

    const mode = metadataParts[0];
    const type = metadataParts[1];
    const normalizedPath = normalizeGitPathCandidate(rawPath, repoRoot);
    if (!mode || !type || !normalizedPath) {
      continue;
    }

    entries.push({ path: normalizedPath, mode, type });
  }
  return entries;
}

function isSymlinkTreeEntry(entry: RevisionTreeEntry): boolean {
  return entry.type === gitTreeBlobType && entry.mode === gitTreeSymlinkMode;
}

function shouldSkipTreeEntry(entry: RevisionTreeEntry): boolean {
  return entry.type !== gitTreeBlobType;
}

async function readSnapshotBlob(params: {
  repoRoot: string;
  revision: string;
  relPath: string;
}): Promise<Buffer | null> {
  return runGitBufferCommand({
    repoRoot: params.repoRoot,
    args: ['show', `${params.revision}:${params.relPath}`],
    timeout: GIT_SHOW_TIMEOUT_MS,
    maxBuffer: GIT_SHOW_MAX_BUFFER,
  });
}

function restoreSnapshotSymlink(
  absPath: string,
  relPath: string,
  symlinkTargetBuffer: Buffer,
): boolean {
  try {
    fs.symlinkSync(symlinkTargetBuffer.toString('utf8'), absPath);
    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : getStringProperty(error, 'message') || 'Unknown symlink error';
    console.warn(
      `[Commit-Copilot] Failed to restore symlink '${relPath}' in rewrite snapshot: ${message}. Skipping file.`,
    );
    return false;
  }
}

function removeRewriteSnapshot(workspaceRoot: string): void {
  try {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  } catch (error) {
    console.error('Error cleaning rewrite snapshot:', error);
  }
}

async function createRewriteCommitSnapshot(params: {
  repoRoot: string;
  revision: string;
}): Promise<RewriteCommitSnapshot> {
  const baseTempRoot = path.join(os.tmpdir(), 'commit-copilot-temp');
  const suffix = `${params.revision.slice(0, rewriteSnapshotHashLength)}-${Date.now().toString(rewriteSnapshotTimestampRadix)}`;
  const workspaceRoot = path.join(
    baseTempRoot,
    `${rewriteTempDirPrefix}${suffix}`,
  );

  fs.mkdirSync(workspaceRoot, { recursive: true });
  try {
    const entries = await listRevisionFiles(params.repoRoot, params.revision);
    const restoredFiles: string[] = [];
    for (const entry of entries) {
      if (shouldSkipTreeEntry(entry)) {
        continue;
      }

      const relPath = entry.path;
      const absPath = path.resolve(workspaceRoot, relPath);
      if (!isPathWithinDirectory(workspaceRoot, absPath)) {
        continue;
      }

      const fileBuffer = await readSnapshotBlob({
        repoRoot: params.repoRoot,
        revision: params.revision,
        relPath,
      });
      if (fileBuffer === null) {
        continue;
      }

      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      if (isSymlinkTreeEntry(entry)) {
        if (!restoreSnapshotSymlink(absPath, relPath, fileBuffer)) {
          continue;
        }
      } else {
        fs.writeFileSync(absPath, fileBuffer);
      }
      restoredFiles.push(relPath);
    }

    return { workspaceRoot, files: restoredFiles };
  } catch (error) {
    removeRewriteSnapshot(workspaceRoot);
    throw error;
  }
}

function isPathWithinDirectory(rootPath: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === '') {
    return true;
  }
  if (relative === '..' || relative.startsWith(`..${path.sep}`)) {
    return false;
  }
  return !path.isAbsolute(relative);
}

async function readRecentCommitMessagesBefore(params: {
  repoRoot: string;
  beforeRevision: string | null;
  count: number;
}): Promise<string[]> {
  if (!params.beforeRevision || params.count <= 0) {
    return [];
  }

  const output = await runGitTextCommand({
    repoRoot: params.repoRoot,
    args: [
      'log',
      '-n',
      String(params.count),
      '--format=%B%x1e',
      params.beforeRevision,
    ],
    timeout: GIT_LOG_TIMEOUT_MS,
    maxBuffer: GIT_LOG_MAX_BUFFER,
  });
  return parseCommitMessages(output);
}

async function readCommitCountAtRevision(
  repoRoot: string,
  revision: string,
): Promise<number | null> {
  try {
    const output = await runGitTextCommand({
      repoRoot,
      args: ['rev-list', '--count', revision],
      timeout: GIT_COMMIT_COUNT_TIMEOUT_MS,
      maxBuffer: bytesPerMiB,
    });
    const parsed = Number.parseInt(output.trim(), 10);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function readCommitTreeHash(
  repoRoot: string,
  commitHash: string,
): Promise<string> {
  const output = await runGitTextCommand({
    repoRoot,
    args: ['show', '-s', '--format=%T', commitHash],
    timeout: GIT_SHOW_TIMEOUT_MS,
    maxBuffer: bytesPerMiB,
  });
  return output.trim();
}

interface CommitAuthorInfo {
  name: string;
  email: string;
  dateIso: string;
}

async function readCommitAuthorInfo(
  repoRoot: string,
  commitHash: string,
): Promise<CommitAuthorInfo | null> {
  try {
    const output = await runGitTextCommand({
      repoRoot,
      args: ['show', '-s', '--format=%an%x1f%ae%x1f%aI', commitHash],
      timeout: GIT_SHOW_TIMEOUT_MS,
      maxBuffer: bytesPerMiB,
    });
    const [name, email, dateIso] = output.trim().split(commitFieldSeparator);
    if (!name || !email || !dateIso) {
      return null;
    }
    return { name, email, dateIso };
  } catch {
    return null;
  }
}

async function createReplacementCommit(params: {
  repoRoot: string;
  originalCommit: ResolvedRewriteCommit;
  newMessage: string;
}): Promise<string> {
  const treeHash = await readCommitTreeHash(
    params.repoRoot,
    params.originalCommit.hash,
  );
  const authorInfo = await readCommitAuthorInfo(
    params.repoRoot,
    params.originalCommit.hash,
  );
  const args = ['commit-tree', treeHash];
  if (params.originalCommit.parentHash) {
    args.push('-p', params.originalCommit.parentHash);
  }
  args.push('-m', params.newMessage);

  const env = authorInfo
    ? {
        ...process.env,
        GIT_AUTHOR_NAME: authorInfo.name,
        GIT_AUTHOR_EMAIL: authorInfo.email,
        GIT_AUTHOR_DATE: authorInfo.dateIso,
      }
    : process.env;
  const output = await runGitTextCommand({
    repoRoot: params.repoRoot,
    args,
    timeout: GIT_COMMIT_TREE_TIMEOUT_MS,
    maxBuffer: GIT_COMMIT_TREE_MAX_BUFFER,
    env,
  });
  return output.trim();
}

async function readCurrentHeadHash(repoRoot: string): Promise<string> {
  const output = await runGitTextCommand({
    repoRoot,
    args: ['rev-parse', 'HEAD'],
    timeout: GIT_SHOW_TIMEOUT_MS,
    maxBuffer: bytesPerMiB,
  });
  return output.trim();
}

async function readCurrentBranchName(repoRoot: string): Promise<string> {
  const output = await runGitTextCommand({
    repoRoot,
    args: ['rev-parse', '--abbrev-ref', 'HEAD'],
    timeout: GIT_SHOW_TIMEOUT_MS,
    maxBuffer: bytesPerMiB,
  });
  return output.trim();
}

async function isAncestorCommit(
  repoRoot: string,
  ancestor: string,
  descendant: string,
): Promise<boolean> {
  try {
    await runGitTextCommand({
      repoRoot,
      args: ['merge-base', '--is-ancestor', ancestor, descendant],
      timeout: GIT_SHOW_TIMEOUT_MS,
      maxBuffer: bytesPerMiB,
    });
    return true;
  } catch (error: unknown) {
    const rawCode =
      typeof error === 'object' && error !== null
        ? (error as Record<string, unknown>).code
        : null;
    if (rawCode === 1 || rawCode === '1') {
      return false;
    }
    throw error;
  }
}

async function rewriteBranchFromReplacement(params: {
  repoRoot: string;
  originalCommit: ResolvedRewriteCommit;
  replacementCommitHash: string;
  branchName: string;
}): Promise<void> {
  const headHash = await readCurrentHeadHash(params.repoRoot);
  if (headHash === params.originalCommit.hash) {
    await runGitTextCommand({
      repoRoot: params.repoRoot,
      args: ['reset', '--hard', params.replacementCommitHash],
      timeout: GIT_DIFF_TIMEOUT_MS,
      maxBuffer: GIT_DIFF_MAX_BUFFER,
    });
    return;
  }

  await runGitTextCommand({
    repoRoot: params.repoRoot,
    args: [
      'rebase',
      '--onto',
      params.replacementCommitHash,
      params.originalCommit.hash,
      params.branchName,
    ],
    timeout: GIT_DIFF_TIMEOUT_MS,
    maxBuffer: GIT_DIFF_MAX_BUFFER,
  });
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
        gitExecutablePath,
        [
          '-c',
          'core.quotepath=false',
          'ls-files',
          '--cached',
          '--others',
          '--exclude-standard',
        ],
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
      const commits = await repoAny.log();
      if (!Array.isArray(commits)) {
        return null;
      }
      return commits.length;
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
        gitExecutablePath,
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

class HistoricalGitOperations extends GitOperations {
  constructor(
    repository: GitRepository,
    private readonly repoRoot: string,
    private readonly snapshotFiles: string[],
    private readonly targetCommitHash: string,
    private readonly beforeRevision: string | null,
  ) {
    super(repository);
  }

  override listFilesFromGitApi(): Promise<string[] | null> {
    return Promise.resolve(this.snapshotFiles);
  }

  override async getRecentCommitMessages(count: number): Promise<string[]> {
    return readRecentCommitMessagesBefore({
      repoRoot: this.repoRoot,
      beforeRevision: this.beforeRevision,
      count,
    });
  }

  override async getCommitCount(): Promise<number | null> {
    return readCommitCountAtRevision(this.repoRoot, this.targetCommitHash);
  }
}

export interface GenerateHistoricalCommitMessageOptions {
  repository: GitRepository;
  commitHash: string;
  provider: APIProvider;
  apiKey: string;
  baseUrl?: string;
  cancellationToken?: CancellationSignal;
  model?: string;
  generateMode?: GenerateMode;
  commitOutputOptions?: CommitOutputOptions;
  onProgress?: ProgressCallback;
  maxAgentSteps?: number;
  language: EffectiveDisplayLanguage;
}

export interface RewriteHistoricalCommitMessageOptions {
  repository: GitRepository;
  commitHash: string;
  newMessage: string;
}

export interface RewriteHistoricalCommitMessageResult {
  success: boolean;
  replacementCommitHash?: string;
  error?: CommitCopilotError;
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

async function resolveRewriteCommitOrThrow(
  repoRoot: string,
  commitHash: string,
): Promise<ResolvedRewriteCommit> {
  const resolved = await resolveRewriteCommit(repoRoot, commitHash);
  if (!resolved) {
    throw new CommitCopilotError(
      `Commit "${commitHash}" was not found.`,
      'REWRITE_COMMIT_NOT_FOUND',
      EXIT_CODES.UNKNOWN_ERROR,
    );
  }
  if (resolved.parentHashes.length > 1) {
    throw new CommitCopilotError(
      `Commit "${commitHash}" is a merge commit and cannot be rewritten by this workflow.`,
      'REWRITE_MERGE_COMMIT_UNSUPPORTED',
      EXIT_CODES.UNKNOWN_ERROR,
    );
  }
  return resolved;
}

async function ensureRewriteWorkspaceCleanOrThrow(
  repository: GitRepository,
): Promise<void> {
  await repository.status();
  const hasUnstagedChanges = repository.state.workingTreeChanges.length > 0;
  const hasStagedChanges = repository.state.indexChanges.length > 0;
  if (!hasUnstagedChanges && !hasStagedChanges) {
    return;
  }
  let details = '';
  if (hasStagedChanges && hasUnstagedChanges) {
    details =
      'both staged (not committed) and modified (unstaged) changes are present';
  } else if (hasStagedChanges) {
    details = 'staged (not committed) changes are present';
  } else {
    details = 'modified (unstaged) changes are present';
  }
  throw new CommitCopilotError(
    `Cannot rewrite commit history while ${details}. Please commit or stash them first.`,
    'REWRITE_WORKSPACE_NOT_CLEAN',
    EXIT_CODES.UNKNOWN_ERROR,
  );
}

function toCommitCopilotError(
  error: unknown,
  code: string,
): CommitCopilotError {
  if (error instanceof CommitCopilotError) {
    return error;
  }
  if (isCancellationLikeError(error)) {
    return new GenerationCancelledError();
  }
  return new CommitCopilotError(
    error instanceof Error ? error.message : String(error),
    code,
    EXIT_CODES.UNKNOWN_ERROR,
  );
}

export async function listRecentCommitsForRewrite(
  repository: GitRepository,
): Promise<RewriteCommitEntry[]> {
  const repoRoot = repository.rootUri.fsPath;
  if (!repoRoot) {
    return [];
  }

  const gitOps = new GitOperations(repository);
  if (!(await gitOps.isGitRepo())) {
    return [];
  }

  const output = await runGitTextCommand({
    repoRoot,
    args: [
      'log',
      '--format=%H%x1f%h%x1f%s%x1f%P%x1e',
      'HEAD',
    ],
    timeout: GIT_LOG_TIMEOUT_MS,
    maxBuffer: GIT_LOG_MAX_BUFFER,
  });

  return output
    .split(commitRecordSeparator)
    .map((record) => parseRewriteCommitLine(record.trim()))
    .filter((entry): entry is RewriteCommitEntry => entry !== null);
}

export async function generateHistoricalCommitMessage(
  options: GenerateHistoricalCommitMessageOptions,
): Promise<GenerateCommitMessageResult> {
  const {
    repository,
    commitHash,
    provider,
    apiKey,
    baseUrl,
    cancellationToken,
    model,
    generateMode = DEFAULT_GENERATE_MODE,
    commitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
    onProgress,
    maxAgentSteps,
    language,
  } = options;
  const repoRoot = repository.rootUri.fsPath;

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

    if (!commitHash.trim()) {
      throw new CommitCopilotError(
        'A commit hash is required.',
        'REWRITE_COMMIT_NOT_FOUND',
        EXIT_CODES.UNKNOWN_ERROR,
      );
    }

    const resolvedCommit = await resolveRewriteCommitOrThrow(
      repoRoot,
      commitHash.trim(),
    );
    const diff = await readCommitDiff(repoRoot, resolvedCommit);
    throwIfCancellationRequested(cancellationToken);
    if (!diff.trim()) {
      throw new NoChangesError();
    }

    const snapshot = await createRewriteCommitSnapshot({
      repoRoot,
      revision: resolvedCommit.hash,
    });
    try {
      const historicalGitOps = new HistoricalGitOperations(
        repository,
        repoRoot,
        snapshot.files,
        resolvedCommit.hash,
        resolvedCommit.parentHash,
      );
      const resolvedCommitOutputOptions =
        normalizeCommitOutputOptions(commitOutputOptions);
      const resolvedGenerateMode: GenerateMode =
        provider === 'ollama' ? 'direct-diff' : generateMode;
      const resolvedModel =
        model && model.length > 0 ? model : DEFAULT_MODELS[provider];

      const message =
        resolvedGenerateMode === 'agentic'
          ? await runAgentLoop({
              provider,
              apiKey,
              baseUrl,
              model: resolvedModel,
              diff,
              repoRoot: snapshot.workspaceRoot,
              onProgress,
              isStaged: false,
              gitOps: historicalGitOps,
              commitOutputOptions: resolvedCommitOutputOptions,
              cancellationToken,
              maxAgentSteps,
              language,
            })
          : await createLLMClient({
              provider,
              apiKey,
              baseUrl,
              ollamaHost: provider === 'ollama' ? apiKey : undefined,
              model: resolvedModel,
              commitOutputOptions: resolvedCommitOutputOptions,
            }).generateCommitMessage(diff, onProgress, cancellationToken);

      throwIfCancellationRequested(cancellationToken);
      return {
        success: true,
        message,
      };
    } finally {
      removeRewriteSnapshot(snapshot.workspaceRoot);
    }
  } catch (error) {
    return {
      success: false,
      error: toCommitCopilotError(error, 'REWRITE_GENERATION_FAILED'),
    };
  }
}

export async function rewriteHistoricalCommitMessage(
  options: RewriteHistoricalCommitMessageOptions,
): Promise<RewriteHistoricalCommitMessageResult> {
  const repoRoot = options.repository.rootUri.fsPath;
  const trimmedMessage = options.newMessage.trim();

  try {
    const gitOps = new GitOperations(options.repository);
    if (!(await gitOps.isGitRepo())) {
      throw new CommitCopilotError(
        'Not a git repository. Please run this command inside a git repository.',
        'NOT_GIT_REPO',
        EXIT_CODES.NOT_GIT_REPO,
      );
    }
    if (!trimmedMessage) {
      throw new CommitCopilotError(
        'A non-empty commit message is required.',
        'REWRITE_EMPTY_MESSAGE',
        EXIT_CODES.UNKNOWN_ERROR,
      );
    }
    await ensureRewriteWorkspaceCleanOrThrow(options.repository);

    const resolvedCommit = await resolveRewriteCommitOrThrow(
      repoRoot,
      options.commitHash.trim(),
    );
    const branchName = await readCurrentBranchName(repoRoot);
    if (!branchName || branchName === 'HEAD') {
      throw new CommitCopilotError(
        'Cannot rewrite commits from detached HEAD.',
        'REWRITE_DETACHED_HEAD',
        EXIT_CODES.UNKNOWN_ERROR,
      );
    }

    const isAncestor = await isAncestorCommit(
      repoRoot,
      resolvedCommit.hash,
      'HEAD',
    );
    if (!isAncestor) {
      throw new CommitCopilotError(
        `Commit "${resolvedCommit.hash}" is not an ancestor of HEAD.`,
        'REWRITE_COMMIT_NOT_REACHABLE',
        EXIT_CODES.UNKNOWN_ERROR,
      );
    }

    const replacementCommitHash = await createReplacementCommit({
      repoRoot,
      originalCommit: resolvedCommit,
      newMessage: trimmedMessage,
    });

    await rewriteBranchFromReplacement({
      repoRoot,
      originalCommit: resolvedCommit,
      replacementCommitHash,
      branchName,
    });
    return {
      success: true,
      replacementCommitHash,
    };
  } catch (error) {
    return {
      success: false,
      error: toCommitCopilotError(error, 'REWRITE_FAILED'),
    };
  }
}

export async function forcePushWithLease(repoRoot: string): Promise<void> {
  await runGitTextCommand({
    repoRoot,
    args: ['push', '--force-with-lease'],
    timeout: GIT_PUSH_TIMEOUT_MS,
    maxBuffer: GIT_LOG_MAX_BUFFER,
  });
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
