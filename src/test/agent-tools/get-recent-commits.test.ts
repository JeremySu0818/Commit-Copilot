import assert from 'node:assert/strict';
import test from 'node:test';

import { executeGetRecentCommits } from '../../agent-tools/executors/get-recent-commits';
import type { GitOperations } from '../../commit-copilot';

void test('executeGetRecentCommits requires gitOps', async () => {
  const output = await executeGetRecentCommits({ count: 3 });
  assert.equal(
    output,
    'Error: git operations are not available to retrieve commit history.',
  );
});

void test('executeGetRecentCommits validates positive count', async () => {
  const gitOps = {
    getRecentCommitMessages: () => Promise.resolve([]),
  } as unknown as GitOperations;

  const output = await executeGetRecentCommits({ count: 0 }, gitOps);
  assert.equal(
    output,
    "Error: 'count' is required and must be a positive integer.",
  );
});

void test('executeGetRecentCommits handles empty commit history', async () => {
  const gitOps = {
    getRecentCommitMessages: () => Promise.resolve([]),
  } as unknown as GitOperations;

  const output = await executeGetRecentCommits({ count: 5 }, gitOps);
  assert.equal(output, 'No recent commits found.');
});

void test('executeGetRecentCommits formats multiline commit messages', async () => {
  const gitOps = {
    getRecentCommitMessages: () =>
      Promise.resolve(['feat(core): add x\n\nbody', 'fix(ui): y']),
  } as unknown as GitOperations;

  const output = await executeGetRecentCommits({ count: 2 }, gitOps);
  assert.match(output, /Recent commits \(last 2, newest first\):/);
  assert.match(output, /\[1\]/);
  assert.match(output, / {2}feat\(core\): add x/);
  assert.match(output, / {2}body/);
  assert.match(output, /\[2\]/);
});
