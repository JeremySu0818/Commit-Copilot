import * as fs from 'fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type { GitRepository } from '../commit-copilot';

import { clearRequireCache, withModuleMock } from './helpers/module-mock';
import { cleanupTempDir, createTempDir } from './helpers/temp-dir';

const MODULE_PATH = path.resolve(__dirname, '..', 'commit-copilot');
const rewriteListLimit = 10;
const expectedCommitCountInHistory = 3;
const latestCommitIndex = 0;
const middleCommitIndex = 1;
const oldestCommitIndex = 2;
const parentCountSingle = 1;
const recentMessageSampleSize = 2;
const recentLogCount = 3;

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

function git(repoRoot: string, args: string[]): string {
  return execFileSync(gitExecutablePath, args, {
    cwd: repoRoot,
    encoding: 'utf-8',
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

  fs.writeFileSync(path.join(repoRoot, 'util.ts'), 'export const util = true;\n');
  git(repoRoot, ['add', 'util.ts']);
  git(repoRoot, ['commit', '-m', 'chore(core): add util']);
  const third = git(repoRoot, ['rev-parse', 'HEAD']);

  return {
    repoRoot,
    repository: createRepository(repoRoot),
    commits: { first, second, third },
  };
}

async function loadCommitCopilotWithMocks(options?: {
  runAgentLoop?: (input: Record<string, unknown>) => Promise<string> | string;
}): Promise<CommitCopilotModule> {
  clearRequireCache(MODULE_PATH);
  const runAgentLoop =
    options?.runAgentLoop ??
    (() => Promise.resolve('fix(core): rewrite\n\nupdated message'));

  const loaded = await withModuleMock(
    './agent-loop',
    { runAgentLoop },
    () =>
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
    const commits = await mod.listRecentCommitsForRewrite(
      fixture.repository,
      rewriteListLimit,
    );
    assert.equal(commits.length >= expectedCommitCountInHistory, true);
    assert.equal(commits[latestCommitIndex]?.hash, fixture.commits.third);
    assert.equal(commits[middleCommitIndex]?.hash, fixture.commits.second);
    assert.equal(commits[oldestCommitIndex]?.hash, fixture.commits.first);
    assert.equal(commits[latestCommitIndex]?.parentHashes.length, parentCountSingle);
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
    assert.equal(
      git(fixture.repoRoot, ['log', '--format=%s', '-n', String(recentLogCount)]),
      ['chore(core): add util', 'fix(core): standardized message', 'feat(core): init'].join('\n'),
    );
    assert.equal(
      fs.readFileSync(path.join(fixture.repoRoot, 'app.ts'), 'utf-8'),
      'export const value = 2;\n',
    );
  } finally {
    cleanupTempDir(fixture.repoRoot);
  }
});
