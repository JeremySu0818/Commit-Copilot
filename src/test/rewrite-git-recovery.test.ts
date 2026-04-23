import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildManualRewriteRecoveryCommands,
  buildRewriteRecoveryCommandPlan,
  isCommandUnavailableError,
  isCredentialOrPromptError,
  isLeaseConflictError,
  splitUpstreamRef,
} from '../rewrite-git-recovery';

void test('splitUpstreamRef parses remote and slash-containing branch names', () => {
  assert.deepEqual(splitUpstreamRef('origin/main'), {
    remote: 'origin',
    branch: 'main',
  });
  assert.deepEqual(splitUpstreamRef('origin/feature/rewrite'), {
    remote: 'origin',
    branch: 'feature/rewrite',
  });
  assert.equal(splitUpstreamRef('main'), null);
  assert.equal(splitUpstreamRef('/main'), null);
  assert.equal(splitUpstreamRef('origin/'), null);
});

void test('buildRewriteRecoveryCommandPlan keeps displayed and executed commands in sync', () => {
  const plan = buildRewriteRecoveryCommandPlan('origin/main');

  assert.deepEqual(plan.fetchArgs, ['fetch', '--prune', 'origin', 'main']);
  assert.deepEqual(plan.rebaseArgs, ['rebase', 'origin/main']);
  assert.deepEqual(plan.retryPushArgs, ['push', '--force-with-lease']);
  assert.deepEqual(plan.displayCommands, [
    'git fetch --prune origin main',
    'git rebase origin/main',
    'git push --force-with-lease',
  ]);
});

void test('buildManualRewriteRecoveryCommands includes upstream setup when upstream is missing', () => {
  assert.deepEqual(
    buildManualRewriteRecoveryCommands({
      upstreamRef: null,
      branchName: 'topic',
    }),
    [
      'git fetch --prune <remote> topic',
      'git branch --set-upstream-to <remote>/topic topic',
      'git rebase <remote>/topic',
      'git push --force-with-lease',
    ],
  );
});

void test('buildManualRewriteRecoveryCommands uses rewrite-preserving flow when previous tracking hash is available', () => {
  assert.deepEqual(
    buildManualRewriteRecoveryCommands({
      upstreamRef: 'origin/main',
      previousRemoteTrackingHash: 'abc123',
    }),
    [
      'git fetch --prune origin main',
      'git branch <sync-branch> origin/main',
      'git rebase --onto HEAD abc123 <sync-branch>',
      'git merge --ff-only <sync-branch>',
      'git branch -D <sync-branch>',
      'git push --force-with-lease',
    ],
  );
});

void test('isLeaseConflictError recognizes C-locale force-with-lease failures', () => {
  assert.equal(
    isLeaseConflictError('! [rejected] main -> main (stale info)'),
    true,
  );
  assert.equal(
    isLeaseConflictError(
      'Updates were rejected because the tip of your current branch is behind; fetch first',
    ),
    true,
  );
  assert.equal(isLeaseConflictError('non-fast-forward'), true);
  assert.equal(
    isLeaseConflictError(
      'Authentication failed for https://example.test/repo.git',
    ),
    false,
  );
});

void test('isCredentialOrPromptError recognizes credential and disabled prompt failures', () => {
  assert.equal(
    isCredentialOrPromptError(
      'Authentication failed for https://example.test/repo.git',
    ),
    true,
  );
  assert.equal(
    isCredentialOrPromptError(
      'fatal: could not read Username for https://example.test: terminal prompts disabled',
    ),
    true,
  );
  assert.equal(
    isCredentialOrPromptError('Permission denied (publickey).'),
    true,
  );
  assert.equal(
    isCredentialOrPromptError('! [rejected] main -> main (stale info)'),
    false,
  );
});

void test('isCommandUnavailableError recognizes missing VS Code command errors only for the requested command', () => {
  assert.equal(
    isCommandUnavailableError(
      new Error("command 'git.pushForceWithLease' not found"),
      'git.pushForceWithLease',
    ),
    true,
  );
  assert.equal(
    isCommandUnavailableError(
      new Error("command 'git.push' not found"),
      'git.pushForceWithLease',
    ),
    false,
  );
});
