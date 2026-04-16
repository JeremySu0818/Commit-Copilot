import assert from 'node:assert/strict';
import test from 'node:test';

import { executeGetDiff } from '../../agent-tools/executors/get-diff';

const sampleDiff = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 111..222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,1 +1,2 @@',
  '-old',
  '+new',
  '+next',
  'diff --git a/src/old.ts b/src/new.ts',
  'similarity index 90%',
  'rename from src/old.ts',
  'rename to src/new.ts',
  '--- a/src/old.ts',
  '+++ b/src/new.ts',
  '@@ -1,1 +1,1 @@',
  '-oldName',
  '+newName',
].join('\n');

void test('executeGetDiff requires path', () => {
  const result = executeGetDiff('repo', {}, sampleDiff);
  assert.match(result, /'path' is required/);
});

void test('executeGetDiff returns selected file block', () => {
  const result = executeGetDiff('repo', { path: 'src/a.ts' }, sampleDiff);
  assert.match(result, /diff --git a\/src\/a\.ts b\/src\/a\.ts/);
  assert.doesNotMatch(result, /src\/old\.ts/);
});

void test('executeGetDiff supports renamed path syntax', () => {
  const result = executeGetDiff(
    'repo',
    { path: 'src/old.ts -> src/new.ts' },
    sampleDiff,
  );
  assert.match(result, /diff --git a\/src\/old\.ts b\/src\/new\.ts/);
});

void test('executeGetDiff returns not found message for unknown file', () => {
  const result = executeGetDiff('repo', { path: 'missing.ts' }, sampleDiff);
  assert.equal(result, 'No diff found for file: missing.ts');
});
