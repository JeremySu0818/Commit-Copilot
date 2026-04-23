import * as fs from 'fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type { GitRepository } from '../commit-copilot';
import { EXIT_CODES } from '../errors';

import { clearRequireCache, withModuleMock } from './helpers/module-mock';
import { cleanupTempDir, createTempDir } from './helpers/temp-dir';

const MODULE_PATH = path.resolve(__dirname, '..', 'commit-copilot');
const expectedCommitCountInHistory = 3;
const uncappedRewriteCommitCount = 60;
const latestCommitIndex = 0;
const middleCommitIndex = 1;
const oldestCommitIndex = 2;
const parentCountSingle = 1;
const recentMessageSampleSize = 2;
const recentLogCount = 3;
const bytesPerKiB = 1024;
const bytesPerMiB = bytesPerKiB * bytesPerKiB;
const largeSnapshotFileSizeMiB = 21;
const largeSnapshotFileSizeBytes = largeSnapshotFileSizeMiB * bytesPerMiB;
const largeSnapshotBinaryFillByte = 0x61;
const snapshotSymlinkProbeTargetFile = '__symlink_probe_target__.txt';
const snapshotSymlinkProbeFile = '__symlink_probe__.txt';

function isCommitCopilotErrorWithKey(
  value: unknown,
  messageKey: string,
): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'messageKey' in value &&
    (value as { messageKey?: unknown }).messageKey === messageKey
  );
}

function getErrorMessageArgs(
  value: unknown,
): Partial<Record<string, string>> {
  if (typeof value !== 'object' || value === null || !('messageArgs' in value)) {
    return {};
  }
  const args = (value as { messageArgs?: unknown }).messageArgs;
  return typeof args === 'object' && args !== null
    ? (args as Partial<Record<string, string>>)
    : {};
}

function resolveGitExecutablePath(): string {
  const envPath = process.env.COMMIT_COPILOT_GIT_PATH;
  if (envPath && envPath.trim().length > 0) {
    return envPath.trim();
  }

  if (process.platform === 'win32') {
    const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']];
    for (const root of roots) {
      if (!root) {
        continue;
      }
      const candidate = path.join(root, 'Git', 'cmd', 'git.exe');
      if (fs.existsSync(candidate)) {
        return candidate;
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

type CommitCopilotModule = typeof import('../commit-copilot');

interface TestRepo {
  repoRoot: string;
  repository: GitRepository;
  commits: {
    first: string;
    second: string;
    third: string;
  };
}

interface RemoteFixture {
  bareRoot: string;
  localRoot: string;
  collaboratorRoot: string;
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync(gitExecutablePath, args, {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim();
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function createRepository(repoRoot: string): GitRepository {
  return {
    rootUri: {
      fsPath: repoRoot,
      toString: () => `file://${repoRoot.replace(/\\/g, '/')}`,
    },
    state: {
      workingTreeChanges: [],
      indexChanges: [],
      untrackedChanges: [],
    },
    inputBox: { value: '' },
    diff: () => Promise.resolve(''),
    add: () => Promise.resolve(),
    show: () => Promise.resolve(''),
    log: () => Promise.resolve([]),
    commit: () => Promise.resolve(),
    status: () => Promise.resolve(),
  };
}

function createRepositoryWithDirtyState(
  repoRoot: string,
  options: { staged: boolean; unstaged: boolean },
): GitRepository {
  const createChange = (fileName: string) => ({
    uri: { fsPath: path.join(repoRoot, fileName) },
    status: 0,
  });
  return {
    ...createRepository(repoRoot),
    state: {
      workingTreeChanges: options.unstaged ? [createChange('app.ts')] : [],
      indexChanges: options.staged ? [createChange('util.ts')] : [],
      untrackedChanges: [],
    },
  };
}

function supportsSymlinkCreation(baseDir: string): boolean {
  const targetPath = path.join(baseDir, snapshotSymlinkProbeTargetFile);
  const symlinkPath = path.join(baseDir, snapshotSymlinkProbeFile);
  try {
    fs.writeFileSync(targetPath, 'probe');
    fs.symlinkSync(snapshotSymlinkProbeTargetFile, symlinkPath);
    return fs.lstatSync(symlinkPath).isSymbolicLink();
  } catch {
    return false;
  } finally {
    fs.rmSync(symlinkPath, { force: true });
    fs.rmSync(targetPath, { force: true });
  }
}

function initTestRepo(): TestRepo {
  const repoRoot = createTempDir();
  git(repoRoot, ['init']);
  git(repoRoot, ['config', 'user.email', 'test@example.com']);
  git(repoRoot, ['config', 'user.name', 'Commit Copilot Test']);

  fs.writeFileSync(path.join(repoRoot, 'app.ts'), 'export const value = 1;\n');
  git(repoRoot, ['add', 'app.ts']);
  git(repoRoot, ['commit', '-m', 'feat(core): init']);
  const first = git(repoRoot, ['rev-parse', 'HEAD']);

  fs.writeFileSync(path.join(repoRoot, 'app.ts'), 'export const value = 2;\n');
  git(repoRoot, ['add', 'app.ts']);
  git(repoRoot, ['commit', '-m', 'bad commit message']);
  const second = git(repoRoot, ['rev-parse', 'HEAD']);

  fs.writeFileSync(
    path.join(repoRoot, 'util.ts'),
    'export const util = true;\n',
  );
  git(repoRoot, ['add', 'util.ts']);
  git(repoRoot, ['commit', '-m', 'chore(core): add util']);
  const third = git(repoRoot, ['rev-parse', 'HEAD']);

  return {
    repoRoot,
    repository: createRepository(repoRoot),
    commits: { first, second, third },
  };
}

function appendCommits(repoRoot: string, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const fileName = `extra-${String(index)}.txt`;
    fs.writeFileSync(path.join(repoRoot, fileName), `${String(index)}\n`);
    git(repoRoot, ['add', fileName]);
    git(repoRoot, ['commit', '-m', `chore(test): extra ${String(index)}`]);
  }
}

function initRemoteFixture(): RemoteFixture {
  const bareRoot = createTempDir();
  const localRoot = createTempDir();
  const collaboratorRoot = createTempDir();

  git(bareRoot, ['init', '--bare']);

  git(localRoot, ['init']);
  git(localRoot, ['config', 'user.email', 'test@example.com']);
  git(localRoot, ['config', 'user.name', 'Commit Copilot Test']);
  fs.writeFileSync(path.join(localRoot, 'app.ts'), 'export const value = 1;\n');
  git(localRoot, ['add', 'app.ts']);
  git(localRoot, ['commit', '-m', 'feat(core): init']);
  git(localRoot, ['remote', 'add', 'origin', bareRoot]);
  const branchName = git(localRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  git(localRoot, ['push', '-u', 'origin', branchName]);

  git(collaboratorRoot, ['clone', bareRoot, '.']);
  git(collaboratorRoot, ['config', 'user.email', 'col@example.com']);
  git(collaboratorRoot, ['config', 'user.name', 'Collaborator']);

  return { bareRoot, localRoot, collaboratorRoot };
}

async function loadCommitCopilotWithMocks(options?: {
  runAgentLoop?: (input: Record<string, unknown>) => Promise<string> | string;
}): Promise<CommitCopilotModule> {
  clearRequireCache(MODULE_PATH);
  const runAgentLoop =
    options?.runAgentLoop ??
    (() => Promise.resolve('fix(core): rewrite\n\nupdated message'));

  const loaded = await withModuleMock('./agent-loop', { runAgentLoop }, () =>
    withModuleMock(
      './llm-clients',
      {
        createLLMClient: () => ({
          generateCommitMessage: () =>
            Promise.resolve('fix(core): direct\n\ndirect mode'),
        }),
      },
      () => {
        const dynamicRequire = createRequire(__filename);
        return dynamicRequire(MODULE_PATH) as CommitCopilotModule;
      },
    ),
  );

  return loaded;
}

void test('listRecentCommitsForRewrite returns branch history entries', async () => {
  const fixture = initTestRepo();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const commits = await mod.listRecentCommitsForRewrite(fixture.repository);
    assert.equal(commits.length >= expectedCommitCountInHistory, true);
    assert.equal(commits[latestCommitIndex]?.hash, fixture.commits.third);
    assert.equal(commits[middleCommitIndex]?.hash, fixture.commits.second);
    assert.equal(commits[oldestCommitIndex]?.hash, fixture.commits.first);
    assert.equal(
      commits[latestCommitIndex]?.parentHashes.length,
      parentCountSingle,
    );
  } finally {
    cleanupTempDir(fixture.repoRoot);
  }
});

void test('listRecentCommitsForRewrite returns full branch history by default', async () => {
  const fixture = initTestRepo();
  try {
    appendCommits(fixture.repoRoot, uncappedRewriteCommitCount);

    const mod = await loadCommitCopilotWithMocks();
    const commits = await mod.listRecentCommitsForRewrite(fixture.repository);

    assert.equal(
      commits.length,
      expectedCommitCountInHistory + uncappedRewriteCommitCount,
    );
    assert.equal(commits.at(-1)?.hash, fixture.commits.first);
  } finally {
    cleanupTempDir(fixture.repoRoot);
  }
});

void test('generateHistoricalCommitMessage uses history before target commit', async () => {
  const fixture = initTestRepo();
  let capturedRecentMessages: string[] = [];
  let capturedDiff = '';
  let capturedRepoRoot = '';

  try {
    const mod = await loadCommitCopilotWithMocks({
      runAgentLoop: async (input) => {
        capturedDiff = asString(input.diff);
        capturedRepoRoot = asString(input.repoRoot);
        const gitOps = input.gitOps as {
          getRecentCommitMessages: (count: number) => Promise<string[]>;
        };
        capturedRecentMessages = await gitOps.getRecentCommitMessages(
          recentMessageSampleSize,
        );
        return 'fix(core): normalize message\n\nhistory aware rewrite';
      },
    });

    const result = await mod.generateHistoricalCommitMessage({
      repository: fixture.repository,
      commitHash: fixture.commits.second,
      provider: 'openai',
      apiKey: 'token',
      generateMode: 'agentic',
      commitOutputOptions: {
        includeScope: true,
        includeBody: true,
        includeFooter: false,
      },
      language: 'en',
    });

    assert.equal(result.success, true);
    assert.equal(
      result.message,
      'fix(core): normalize message\n\nhistory aware rewrite',
    );
    assert.match(capturedDiff, /\+export const value = 2;/);
    assert.equal(capturedRecentMessages.length, 1);
    assert.match(capturedRecentMessages[0] ?? '', /feat\(core\): init/);
    const relativeSnapshotPath = path.relative(
      fixture.repoRoot,
      capturedRepoRoot,
    );
    const snapshotInsideRepo =
      relativeSnapshotPath === '' ||
      (!relativeSnapshotPath.startsWith('..') &&
        !path.isAbsolute(relativeSnapshotPath));
    assert.equal(snapshotInsideRepo, false);
    assert.equal(capturedRepoRoot.includes('commit-copilot-temp'), true);
    assert.equal(fs.existsSync(capturedRepoRoot), false);
  } finally {
    cleanupTempDir(fixture.repoRoot);
  }
});

void test('rewriteHistoricalCommitMessage rewrites selected commit message', async () => {
  const fixture = initTestRepo();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const rewriteResult = await mod.rewriteHistoricalCommitMessage({
      repository: fixture.repository,
      commitHash: fixture.commits.second,
      newMessage: 'fix(core): standardized message\n\nrewrite with agent',
    });

    assert.equal(rewriteResult.success, true);
    assert.equal(rewriteResult.previousRemoteTrackingHash, undefined);
    assert.equal(
      git(fixture.repoRoot, [
        'log',
        '--format=%s',
        '-n',
        String(recentLogCount),
      ]),
      [
        'chore(core): add util',
        'fix(core): standardized message',
        'feat(core): init',
      ].join('\n'),
    );
    assert.equal(
      fs.readFileSync(path.join(fixture.repoRoot, 'app.ts'), 'utf-8'),
      'export const value = 2;\n',
    );
  } finally {
    cleanupTempDir(fixture.repoRoot);
  }
});

void test('forcePushWithLease rejects push when expected lease is stale', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
    const expectedRemoteHeadHash = git(fixture.localRoot, [
      'rev-parse',
      'HEAD',
    ]);

    fs.writeFileSync(
      path.join(fixture.collaboratorRoot, 'remote-only.ts'),
      'export const collaborator = true;\n',
    );
    git(fixture.collaboratorRoot, ['add', 'remote-only.ts']);
    git(fixture.collaboratorRoot, [
      'commit',
      '-m',
      'feat(core): collaborator update',
    ]);
    git(fixture.collaboratorRoot, ['push', 'origin', branchName]);

    fs.writeFileSync(
      path.join(fixture.localRoot, 'local-only.ts'),
      'export const local = true;\n',
    );
    git(fixture.localRoot, ['add', 'local-only.ts']);
    git(fixture.localRoot, ['commit', '-m', 'chore(core): local rewrite tip']);

    await assert.rejects(
      () => mod.forcePushWithLease(fixture.localRoot, expectedRemoteHeadHash),
      /stale info|lease/i,
    );
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});

void test('fetched incoming commits are blocked by rewrite preflight', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);

    fs.writeFileSync(
      path.join(fixture.localRoot, 'rewrite-target.ts'),
      'export const rewriteTarget = true;\n',
    );
    git(fixture.localRoot, ['add', 'rewrite-target.ts']);
    git(fixture.localRoot, ['commit', '-m', 'bad commit message']);
    git(fixture.localRoot, ['push', 'origin', branchName]);

    git(fixture.collaboratorRoot, ['pull', 'origin', branchName]);
    fs.writeFileSync(
      path.join(fixture.collaboratorRoot, 'remote-incoming.ts'),
      'export const remoteIncoming = true;\n',
    );
    git(fixture.collaboratorRoot, ['add', 'remote-incoming.ts']);
    git(fixture.collaboratorRoot, [
      'commit',
      '-m',
      'chore(core): collaborator incoming commit',
    ]);
    git(fixture.collaboratorRoot, ['push', 'origin', branchName]);
    const incomingRemoteHash = git(fixture.collaboratorRoot, [
      'rev-parse',
      'HEAD',
    ]);

    git(fixture.localRoot, ['fetch', 'origin', branchName]);
    const fetchedTrackingHash = git(fixture.localRoot, [
      'rev-parse',
      `origin/${branchName}`,
    ]);
    assert.equal(fetchedTrackingHash, incomingRemoteHash);

    await assert.rejects(
      () => mod.ensureSafeRewritePreflight(fixture.localRoot),
      (error) => {
        const args = getErrorMessageArgs(error);
        return (
          isCommitCopilotErrorWithKey(error, 'rewrite.remoteNotIntegrated') &&
          args.upstreamRef === `origin/${branchName}` &&
          typeof args.remoteHash === 'string' &&
          args.remoteHash.length > 0
        );
      },
    );
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});

void test('ensureSafeRewritePreflight rejects when local branch is behind upstream', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);

    fs.writeFileSync(
      path.join(fixture.collaboratorRoot, 'remote-preflight.ts'),
      'export const remotePreflight = true;\n',
    );
    git(fixture.collaboratorRoot, ['add', 'remote-preflight.ts']);
    git(fixture.collaboratorRoot, [
      'commit',
      '-m',
      'chore(core): remote preflight commit',
    ]);
    git(fixture.collaboratorRoot, ['push', 'origin', branchName]);

    await assert.rejects(
      () => mod.ensureSafeRewritePreflight(fixture.localRoot),
      (error) => {
        const args = getErrorMessageArgs(error);
        return (
          isCommitCopilotErrorWithKey(error, 'rewrite.remoteNotIntegrated') &&
          args.upstreamRef === `origin/${branchName}` &&
          typeof args.remoteHash === 'string' &&
          args.remoteHash.length > 0
        );
      },
    );
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});

void test('ensureSafeRewritePreflight succeeds when local branch already contains upstream', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
    const expectedTrackingHash = git(fixture.localRoot, [
      'rev-parse',
      `origin/${branchName}`,
    ]);

    const preflight = await mod.ensureSafeRewritePreflight(fixture.localRoot);

    assert.equal(preflight.upstreamRef, `origin/${branchName}`);
    assert.equal(preflight.remoteTrackingHash, expectedTrackingHash);
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});

void test('autoSyncWithUpstreamForRewrite rejects when upstream is missing', async () => {
  const fixture = initTestRepo();
  try {
    const mod = await loadCommitCopilotWithMocks();
    assert.equal(await mod.readUpstreamRef(fixture.repoRoot), null);
    await assert.rejects(
      () => mod.autoSyncWithUpstreamForRewrite(fixture.repoRoot),
      (error) =>
        isCommitCopilotErrorWithKey(
          error,
          'rewrite.autoSyncMissingUpstream',
        ),
    );
  } finally {
    cleanupTempDir(fixture.repoRoot);
  }
});

void test('git commands force stable locale and disable terminal prompts', async () => {
  const mod = await loadCommitCopilotWithMocks();
  const env = mod.getStableGitEnvForTests({
    LC_ALL: 'zh_TW.UTF-8',
    LANG: 'ja_JP.UTF-8',
    LANGUAGE: 'de',
    GIT_TERMINAL_PROMPT: '1',
    KEEP_ME: 'yes',
  } as NodeJS.ProcessEnv);

  assert.equal(env.LC_ALL, 'C');
  assert.equal(env.LANG, 'C');
  assert.equal(env.LANGUAGE, 'C');
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(env.KEEP_ME, 'yes');
});

void test('autoSyncWithUpstreamForRewrite rebases with explicit upstream ref', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);

    fs.writeFileSync(
      path.join(fixture.collaboratorRoot, 'remote-sync.ts'),
      'export const synced = true;\n',
    );
    git(fixture.collaboratorRoot, ['add', 'remote-sync.ts']);
    git(fixture.collaboratorRoot, ['commit', '-m', 'chore(core): remote sync']);
    git(fixture.collaboratorRoot, ['push', 'origin', branchName]);

    const upstreamRef = `origin/${branchName}`;
    await mod.autoSyncWithUpstreamForRewrite(fixture.localRoot, upstreamRef);

    const localHeadHash = git(fixture.localRoot, ['rev-parse', 'HEAD']);
    const upstreamHeadHash = git(fixture.localRoot, ['rev-parse', upstreamRef]);
    assert.equal(localHeadHash, upstreamHeadHash);
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});

void test('autoSyncWithUpstreamForRewrite supports retry push with current lease after rebase', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);

    fs.writeFileSync(
      path.join(fixture.collaboratorRoot, 'remote-sync.ts'),
      'export const synced = true;\n',
    );
    git(fixture.collaboratorRoot, ['add', 'remote-sync.ts']);
    git(fixture.collaboratorRoot, ['commit', '-m', 'chore(core): remote sync']);
    git(fixture.collaboratorRoot, ['push', 'origin', branchName]);

    fs.writeFileSync(
      path.join(fixture.localRoot, 'local-rewrite.ts'),
      'export const rewrite = true;\n',
    );
    git(fixture.localRoot, ['add', 'local-rewrite.ts']);
    git(fixture.localRoot, ['commit', '-m', 'chore(core): local rewrite tip']);

    await mod.autoSyncWithUpstreamForRewrite(
      fixture.localRoot,
      `origin/${branchName}`,
    );
    const rebasedLocalHead = git(fixture.localRoot, ['rev-parse', 'HEAD']);

    await mod.forcePushWithLease(
      fixture.localRoot,
      git(fixture.localRoot, ['rev-parse', `origin/${branchName}`]),
    );

    assert.equal(
      git(fixture.bareRoot, ['rev-parse', `refs/heads/${branchName}`]),
      rebasedLocalHead,
    );
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});

void test('autoSyncWithUpstreamForRewrite preserves local rewritten commit when upstream advanced', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);

    fs.writeFileSync(
      path.join(fixture.localRoot, 'rewrite-target.ts'),
      'export const rewriteTarget = true;\n',
    );
    git(fixture.localRoot, ['add', 'rewrite-target.ts']);
    git(fixture.localRoot, ['commit', '-m', 'bad commit message']);
    const targetCommitHash = git(fixture.localRoot, ['rev-parse', 'HEAD']);
    git(fixture.localRoot, ['push', 'origin', branchName]);

    git(fixture.collaboratorRoot, ['pull', 'origin', branchName]);

    const rewriteResult = await mod.rewriteHistoricalCommitMessage({
      repository: createRepository(fixture.localRoot),
      commitHash: targetCommitHash,
      newMessage: 'fix(core): rewritten tip message',
    });
    assert.equal(rewriteResult.success, true);
    assert.ok(rewriteResult.previousRemoteTrackingHash);

    fs.writeFileSync(
      path.join(fixture.collaboratorRoot, 'remote-after-rewrite.ts'),
      'export const remoteAfterRewrite = true;\n',
    );
    git(fixture.collaboratorRoot, ['add', 'remote-after-rewrite.ts']);
    git(fixture.collaboratorRoot, [
      'commit',
      '-m',
      'chore(core): collaborator after rewrite',
    ]);
    git(fixture.collaboratorRoot, ['push', 'origin', branchName]);

    await mod.autoSyncWithUpstreamForRewrite(
      fixture.localRoot,
      `origin/${branchName}`,
      rewriteResult.previousRemoteTrackingHash,
    );

    assert.equal(
      git(fixture.localRoot, ['log', '--format=%s', '-n', '3']),
      [
        'chore(core): collaborator after rewrite',
        'fix(core): rewritten tip message',
        'feat(core): init',
      ].join('\n'),
    );

    await mod.forcePushWithLease(
      fixture.localRoot,
      git(fixture.localRoot, ['rev-parse', `origin/${branchName}`]),
    );

    assert.equal(
      git(fixture.bareRoot, [
        'log',
        '--format=%s',
        '-n',
        '3',
        `refs/heads/${branchName}`,
      ]),
      [
        'chore(core): collaborator after rewrite',
        'fix(core): rewritten tip message',
        'feat(core): init',
      ].join('\n'),
    );
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});

void test('generateHistoricalCommitMessage supports non-ASCII file paths in rewrite snapshot', async () => {
  const repoRoot = createTempDir();
  const repository = createRepository(repoRoot);
  const nonAsciiRelativePath =
    'static/md/\u5f35\u570b\u8a9e\u932f\u6587\u5b57\u7248.md';

  try {
    git(repoRoot, ['init']);
    git(repoRoot, ['config', 'user.email', 'test@example.com']);
    git(repoRoot, ['config', 'user.name', 'Commit Copilot Test']);

    fs.writeFileSync(
      path.join(repoRoot, 'app.ts'),
      'export const value = 1;\n',
    );
    git(repoRoot, ['add', 'app.ts']);
    git(repoRoot, ['commit', '-m', 'feat(core): init']);

    const nonAsciiAbsPath = path.join(
      repoRoot,
      ...nonAsciiRelativePath.split('/'),
    );
    fs.mkdirSync(path.dirname(nonAsciiAbsPath), { recursive: true });
    fs.writeFileSync(nonAsciiAbsPath, '# law\n');
    git(repoRoot, ['add', nonAsciiRelativePath]);
    git(repoRoot, ['commit', '-m', 'bad commit message']);

    const targetCommitHash = git(repoRoot, ['rev-parse', 'HEAD']);
    const lsTreeOutput = git(repoRoot, [
      'ls-tree',
      '-r',
      '--name-only',
      targetCommitHash,
    ]);
    assert.match(lsTreeOutput, /\\[0-7]{3}/);

    const mod = await loadCommitCopilotWithMocks({
      runAgentLoop: () =>
        Promise.resolve('fix(core): rewrite\n\nnormalize non-ascii snapshot'),
    });
    const result = await mod.generateHistoricalCommitMessage({
      repository,
      commitHash: targetCommitHash,
      provider: 'openai',
      apiKey: 'token',
      generateMode: 'agentic',
      language: 'en',
    });

    assert.equal(result.success, true);
    assert.equal(
      result.message,
      'fix(core): rewrite\n\nnormalize non-ascii snapshot',
    );
  } finally {
    cleanupTempDir(repoRoot);
  }
});

void test('generateHistoricalCommitMessage restores symlink files in rewrite snapshot', async (context) => {
  const repoRoot = createTempDir();
  if (!supportsSymlinkCreation(repoRoot)) {
    cleanupTempDir(repoRoot);
    context.skip('Symlink creation is not available in this environment.');
    return;
  }

  const repository = createRepository(repoRoot);
  const symlinkTargetRelativePath = 'src/target.ts';
  const symlinkRelativePath = 'src/link.ts';
  const appRelativePath = 'app.ts';
  const symlinkTargetFileName = 'target.ts';
  let capturedSymlinkIsLink = false;
  let capturedSymlinkTarget = '';
  let capturedSnapshotFiles: string[] = [];

  try {
    git(repoRoot, ['init']);
    git(repoRoot, ['config', 'user.email', 'test@example.com']);
    git(repoRoot, ['config', 'user.name', 'Commit Copilot Test']);

    const appPath = path.join(repoRoot, appRelativePath);
    fs.writeFileSync(appPath, 'export const value = 1;\n');

    const symlinkTargetAbs = path.join(
      repoRoot,
      ...symlinkTargetRelativePath.split('/'),
    );
    const symlinkAbs = path.join(repoRoot, ...symlinkRelativePath.split('/'));
    fs.mkdirSync(path.dirname(symlinkTargetAbs), { recursive: true });
    fs.writeFileSync(symlinkTargetAbs, 'export const target = true;\n');
    fs.symlinkSync(symlinkTargetFileName, symlinkAbs);

    git(repoRoot, [
      'add',
      appRelativePath,
      symlinkTargetRelativePath,
      symlinkRelativePath,
    ]);
    git(repoRoot, ['commit', '-m', 'feat(core): add symlink']);

    fs.writeFileSync(appPath, 'export const value = 2;\n');
    git(repoRoot, ['add', appRelativePath]);
    git(repoRoot, ['commit', '-m', 'bad commit message']);

    const targetCommitHash = git(repoRoot, ['rev-parse', 'HEAD']);
    const mod = await loadCommitCopilotWithMocks({
      runAgentLoop: async (input) => {
        const snapshotRoot = asString(input.repoRoot);
        const symlinkSnapshotAbs = path.join(
          snapshotRoot,
          ...symlinkRelativePath.split('/'),
        );
        capturedSymlinkIsLink = fs
          .lstatSync(symlinkSnapshotAbs)
          .isSymbolicLink();
        capturedSymlinkTarget = fs.readlinkSync(symlinkSnapshotAbs);
        const gitOps = input.gitOps as {
          listFilesFromGitApi: () => Promise<string[] | null>;
        };
        capturedSnapshotFiles = (await gitOps.listFilesFromGitApi()) ?? [];
        return 'fix(core): rewrite\n\nrestore symlink snapshot';
      },
    });

    const result = await mod.generateHistoricalCommitMessage({
      repository,
      commitHash: targetCommitHash,
      provider: 'openai',
      apiKey: 'token',
      generateMode: 'agentic',
      language: 'en',
    });

    assert.equal(result.success, true);
    assert.equal(capturedSymlinkIsLink, true);
    assert.equal(capturedSymlinkTarget, symlinkTargetFileName);
    assert.equal(capturedSnapshotFiles.includes(symlinkRelativePath), true);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

void test('generateHistoricalCommitMessage includes large files in rewrite snapshot', async () => {
  const repoRoot = createTempDir();
  const repository = createRepository(repoRoot);
  const appRelativePath = 'app.ts';
  const largeFileRelativePath = 'assets/large.bin';
  let capturedSnapshotFiles: string[] = [];
  let capturedLargeFileExists = true;

  try {
    git(repoRoot, ['init']);
    git(repoRoot, ['config', 'user.email', 'test@example.com']);
    git(repoRoot, ['config', 'user.name', 'Commit Copilot Test']);

    const appPath = path.join(repoRoot, appRelativePath);
    fs.writeFileSync(appPath, 'export const value = 1;\n');

    const largeFileAbsPath = path.join(
      repoRoot,
      ...largeFileRelativePath.split('/'),
    );
    fs.mkdirSync(path.dirname(largeFileAbsPath), { recursive: true });
    fs.writeFileSync(
      largeFileAbsPath,
      Buffer.alloc(largeSnapshotFileSizeBytes, largeSnapshotBinaryFillByte),
    );

    git(repoRoot, ['add', appRelativePath, largeFileRelativePath]);
    git(repoRoot, ['commit', '-m', 'feat(core): add large binary']);

    fs.writeFileSync(appPath, 'export const value = 2;\n');
    git(repoRoot, ['add', appRelativePath]);
    git(repoRoot, ['commit', '-m', 'bad commit message']);

    const targetCommitHash = git(repoRoot, ['rev-parse', 'HEAD']);
    const mod = await loadCommitCopilotWithMocks({
      runAgentLoop: async (input) => {
        const snapshotRoot = asString(input.repoRoot);
        const largeSnapshotAbsPath = path.join(
          snapshotRoot,
          ...largeFileRelativePath.split('/'),
        );
        capturedLargeFileExists = fs.existsSync(largeSnapshotAbsPath);
        const gitOps = input.gitOps as {
          listFilesFromGitApi: () => Promise<string[] | null>;
        };
        capturedSnapshotFiles = (await gitOps.listFilesFromGitApi()) ?? [];
        return 'fix(core): rewrite\n\ninclude large snapshot file';
      },
    });

    const result = await mod.generateHistoricalCommitMessage({
      repository,
      commitHash: targetCommitHash,
      provider: 'openai',
      apiKey: 'token',
      generateMode: 'agentic',
      language: 'en',
    });

    assert.equal(result.success, true);
    assert.equal(capturedSnapshotFiles.includes(appRelativePath), true);
    assert.equal(capturedSnapshotFiles.includes(largeFileRelativePath), true);
    assert.equal(capturedLargeFileExists, true);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

void test('generateHistoricalCommitMessage maps cancellation-like errors to CANCELLED exit code', async () => {
  const fixture = initTestRepo();
  try {
    const mod = await loadCommitCopilotWithMocks({
      runAgentLoop: () => {
        throw new Error('AbortError: request aborted');
      },
    });
    const result = await mod.generateHistoricalCommitMessage({
      repository: fixture.repository,
      commitHash: fixture.commits.second,
      provider: 'openai',
      apiKey: 'token',
      generateMode: 'agentic',
      language: 'en',
    });

    assert.equal(result.success, false);
    assert.equal(result.error?.exitCode, EXIT_CODES.CANCELLED);
  } finally {
    cleanupTempDir(fixture.repoRoot);
  }
});

void test('rewriteHistoricalCommitMessage rejects unstaged changes before rewriting', async () => {
  const fixture = initTestRepo();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const result = await mod.rewriteHistoricalCommitMessage({
      repository: createRepositoryWithDirtyState(fixture.repoRoot, {
        staged: false,
        unstaged: true,
      }),
      commitHash: fixture.commits.second,
      newMessage: 'fix(core): standardized message',
    });

    assert.equal(result.success, false);
    assert.equal(result.error?.errorCode, 'REWRITE_WORKSPACE_NOT_CLEAN');
    assert.ok(result.error);
    assert.equal(result.error.messageKey, 'rewrite.workspaceNotCleanUnstaged');
  } finally {
    cleanupTempDir(fixture.repoRoot);
  }
});

void test('rewriteHistoricalCommitMessage rejects staged changes before rewriting', async () => {
  const fixture = initTestRepo();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const result = await mod.rewriteHistoricalCommitMessage({
      repository: createRepositoryWithDirtyState(fixture.repoRoot, {
        staged: true,
        unstaged: false,
      }),
      commitHash: fixture.commits.second,
      newMessage: 'fix(core): standardized message',
    });

    assert.equal(result.success, false);
    assert.equal(result.error?.errorCode, 'REWRITE_WORKSPACE_NOT_CLEAN');
    assert.ok(result.error);
    assert.equal(result.error.messageKey, 'rewrite.workspaceNotCleanStaged');
  } finally {
    cleanupTempDir(fixture.repoRoot);
  }
});

void test('rewriteHistoricalCommitMessage rejects mixed staged and unstaged changes before rewriting', async () => {
  const fixture = initTestRepo();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const result = await mod.rewriteHistoricalCommitMessage({
      repository: createRepositoryWithDirtyState(fixture.repoRoot, {
        staged: true,
        unstaged: true,
      }),
      commitHash: fixture.commits.second,
      newMessage: 'fix(core): standardized message',
    });

    assert.equal(result.success, false);
    assert.equal(result.error?.errorCode, 'REWRITE_WORKSPACE_NOT_CLEAN');
    assert.ok(result.error);
    assert.equal(result.error.messageKey, 'rewrite.workspaceNotCleanBoth');
  } finally {
    cleanupTempDir(fixture.repoRoot);
  }
});

void test('autoSyncWithUpstreamForRewrite aborts rebase on conflict and rethrows', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);

    fs.writeFileSync(
      path.join(fixture.collaboratorRoot, 'app.ts'),
      'export const value = 100;\n',
    );
    git(fixture.collaboratorRoot, ['add', 'app.ts']);
    git(fixture.collaboratorRoot, [
      'commit',
      '-m',
      'chore(core): collaborator conflicting edit',
    ]);
    git(fixture.collaboratorRoot, ['push', 'origin', branchName]);

    fs.writeFileSync(
      path.join(fixture.localRoot, 'app.ts'),
      'export const value = 200;\n',
    );
    git(fixture.localRoot, ['add', 'app.ts']);
    git(fixture.localRoot, [
      'commit',
      '-m',
      'chore(core): local conflicting edit',
    ]);
    const localHeadBeforeSync = git(fixture.localRoot, ['rev-parse', 'HEAD']);

    await assert.rejects(() =>
      mod.autoSyncWithUpstreamForRewrite(
        fixture.localRoot,
        `origin/${branchName}`,
      ),
    );

    assert.equal(
      fs.existsSync(path.join(fixture.localRoot, '.git', 'rebase-merge')),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(fixture.localRoot, '.git', 'rebase-apply')),
      false,
    );
    assert.equal(
      git(fixture.localRoot, ['rev-parse', 'HEAD']),
      localHeadBeforeSync,
    );
    assert.equal(
      fs.readFileSync(path.join(fixture.localRoot, 'app.ts'), 'utf-8'),
      'export const value = 200;\n',
    );
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});

void test('rewriteHistoricalCommitMessage captures previousRemoteTrackingHash from upstream ref', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
    const pushedUpstreamHash = git(fixture.localRoot, [
      'rev-parse',
      `origin/${branchName}`,
    ]);

    fs.writeFileSync(
      path.join(fixture.localRoot, 'feature-a.ts'),
      'export const a = 1;\n',
    );
    git(fixture.localRoot, ['add', 'feature-a.ts']);
    git(fixture.localRoot, ['commit', '-m', 'feat(core): add feature-a']);
    const targetCommitHash = git(fixture.localRoot, ['rev-parse', 'HEAD']);

    fs.writeFileSync(
      path.join(fixture.localRoot, 'feature-b.ts'),
      'export const b = 2;\n',
    );
    git(fixture.localRoot, ['add', 'feature-b.ts']);
    git(fixture.localRoot, ['commit', '-m', 'feat(core): add feature-b']);
    const localHeadBeforeRewrite = git(fixture.localRoot, [
      'rev-parse',
      'HEAD',
    ]);

    const result = await mod.rewriteHistoricalCommitMessage({
      repository: createRepository(fixture.localRoot),
      commitHash: targetCommitHash,
      newMessage: 'feat(core): standardized feature-a',
    });

    assert.equal(result.success, true);
    assert.equal(result.previousRemoteTrackingHash, pushedUpstreamHash);
    assert.notEqual(result.previousRemoteTrackingHash, localHeadBeforeRewrite);
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});

void test('readLiveRemoteHeadHash sees remote updates before local tracking is fetched', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
    const upstreamRef = `origin/${branchName}`;
    const staleTrackingHash = git(fixture.localRoot, [
      'rev-parse',
      upstreamRef,
    ]);

    fs.writeFileSync(
      path.join(fixture.collaboratorRoot, 'remote-live.ts'),
      'export const live = true;\n',
    );
    git(fixture.collaboratorRoot, ['add', 'remote-live.ts']);
    git(fixture.collaboratorRoot, ['commit', '-m', 'feat(core): remote live']);
    git(fixture.collaboratorRoot, ['push', 'origin', branchName]);

    const liveRemoteHash = await mod.readLiveRemoteHeadHash(
      fixture.localRoot,
      upstreamRef,
    );
    const currentTrackingHash = await mod.readRemoteTrackingHash(
      fixture.localRoot,
      upstreamRef,
    );
    const actualRemoteHash = git(fixture.bareRoot, [
      'rev-parse',
      `refs/heads/${branchName}`,
    ]);

    assert.equal(currentTrackingHash, staleTrackingHash);
    assert.equal(liveRemoteHash, actualRemoteHash);
    assert.notEqual(liveRemoteHash, currentTrackingHash);
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});

void test('forcePushWithLease accepts unpushed local commits when remote tracking ref is unchanged', async () => {
  const fixture = initRemoteFixture();
  try {
    const mod = await loadCommitCopilotWithMocks();
    const branchName = git(fixture.localRoot, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
    const upstreamHashBeforePush = git(fixture.localRoot, [
      'rev-parse',
      `origin/${branchName}`,
    ]);

    fs.writeFileSync(
      path.join(fixture.localRoot, 'local-change.ts'),
      'export const local = true;\n',
    );
    git(fixture.localRoot, ['add', 'local-change.ts']);
    git(fixture.localRoot, ['commit', '-m', 'chore(core): local change']);
    const localHeadAfterCommit = git(fixture.localRoot, ['rev-parse', 'HEAD']);

    await mod.forcePushWithLease(fixture.localRoot, upstreamHashBeforePush);

    assert.equal(
      git(fixture.bareRoot, ['rev-parse', `refs/heads/${branchName}`]),
      localHeadAfterCommit,
    );
  } finally {
    cleanupTempDir(fixture.collaboratorRoot);
    cleanupTempDir(fixture.localRoot);
    cleanupTempDir(fixture.bareRoot);
  }
});
