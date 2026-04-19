import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const EXTENSION_PATH = path.resolve(process.cwd(), 'src', 'extension.ts');

void test('rewrite command checks API key before commit selection', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');
  const functionStart = source.indexOf('async function executeRewriteCommand');
  const functionEnd = source.indexOf(
    'function getPushTargetLabel',
    functionStart,
  );

  assert.notEqual(functionStart, -1);
  assert.notEqual(functionEnd, -1);

  const functionBody = source.slice(functionStart, functionEnd);
  const ensureApiKeyIndex = functionBody.indexOf(
    'const hasApiKey = await ensureProviderApiKey(',
  );
  const selectCommitIndex = functionBody.indexOf(
    'const targetCommit = await selectRewriteCommit(repository, text);',
  );

  assert.notEqual(ensureApiKeyIndex, -1);
  assert.notEqual(selectCommitIndex, -1);
  assert.equal(ensureApiKeyIndex < selectCommitIndex, true);
});
