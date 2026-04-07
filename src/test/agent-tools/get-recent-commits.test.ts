import test from 'node:test';
import assert from 'node:assert/strict';
import { executeGetRecentCommits } from '../../agent-tools/executors/get-recent-commits';

test('executeGetRecentCommits requires gitOps', async () => {
  const output = await executeGetRecentCommits({ count: 3 });
  assert.equal(
    output,
    'Error: git operations are not available to retrieve commit history.',
  );
});

test('executeGetRecentCommits validates positive count', async () => {
  const gitOps = {
    getRecentCommitMessages: async () => [],
  } as any;

  const output = await executeGetRecentCommits({ count: 0 }, gitOps);
  assert.equal(
    output,
    "Error: 'count' is required and must be a positive integer.",
  );
});

test('executeGetRecentCommits handles empty commit history', async () => {
  const gitOps = {
    getRecentCommitMessages: async () => [],
  } as any;

  const output = await executeGetRecentCommits({ count: 5 }, gitOps);
  assert.equal(output, 'No recent commits found.');
});

test('executeGetRecentCommits formats multiline commit messages', async () => {
  const gitOps = {
    getRecentCommitMessages: async () => [
      'feat(core): add x\n\nbody',
      'fix(ui): y',
    ],
  } as any;

  const output = await executeGetRecentCommits({ count: 2 }, gitOps);
  assert.match(output, /Recent commits \(last 2, newest first\):/);
  assert.match(output, /\[1\]/);
  assert.match(output, /  feat\(core\): add x/);
  assert.match(output, /  body/);
  assert.match(output, /\[2\]/);
});
