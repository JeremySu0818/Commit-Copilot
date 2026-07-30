import assert from 'node:assert/strict';
import test from 'node:test';

import { DiffCoverageTracker } from '../../../agent/tools/diff-coverage';

const diff = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1 +1 @@',
  '-one',
  '+two',
  'diff --git a/src/old.ts b/src/new.ts',
  'rename from src/old.ts',
  'rename to src/new.ts',
].join('\n');

void test('tracks single and batched get_diff coverage', () => {
  const tracker = new DiffCoverageTracker(diff, true);
  tracker.recordToolCall('get_diff', { path: 'src/a.ts' });
  assert.deepEqual(tracker.getMissingPaths(), ['src/old.ts → src/new.ts']);

  tracker.recordToolCall('get_diff', { paths: ['src/new.ts'] });
  assert.equal(tracker.isComplete(), true);
});

void test('does not treat unrelated tools or unknown paths as coverage', () => {
  const tracker = new DiffCoverageTracker(diff, true);
  tracker.recordToolCall('read_file', { path: 'src/a.ts' });
  tracker.recordToolCall('get_diff', { path: 'src/missing.ts' });
  assert.deepEqual(tracker.getMissingPaths(), [
    'src/a.ts',
    'src/old.ts → src/new.ts',
  ]);
  assert.match(tracker.formatIncompleteMessage(), /coverage is incomplete/);
});

void test('disabled coverage never blocks commit submission', () => {
  const tracker = new DiffCoverageTracker(diff, false);
  assert.equal(tracker.isComplete(), true);
  assert.doesNotThrow(() => {
    tracker.assertComplete();
  });
});
