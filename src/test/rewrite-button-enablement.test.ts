import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const MAIN_VIEW_PATH = path.resolve(
  process.cwd(),
  'src',
  'webview',
  'views',
  'MainView.tsx',
);
const DERIVED_STATE_PATH = path.resolve(
  process.cwd(),
  'src',
  'webview',
  'views',
  'MainViewDerivedState.ts',
);

void test('rewrite button is not disabled by lack of working tree changes', () => {
  const source = readFileSync(MAIN_VIEW_PATH, 'utf8');
  const declarationStart = source.indexOf('const rewriteBtnDisabled =');

  assert.notEqual(declarationStart, -1);
  const declaration = source.slice(declarationStart, declarationStart + 160);
  assert.equal(declaration.includes('generateBtnDisabled'), false);
  assert.equal(declaration.includes('isOllama'), false);
});

void test('rewrite button uses configured key status before treating API key as missing', () => {
  const source = readFileSync(MAIN_VIEW_PATH, 'utf8');
  assert.match(
    source,
    /const hasConfiguredKey = state\.providerKeyStatuses\[currentProvider\] === true;/,
  );
  assert.match(
    source,
    /const isApiKeyMissing = !hasConfiguredKey && !state\.apiKeyValue\.trim\(\);/,
  );
});

void test('rewrite button title does not reuse no-changes generate status', () => {
  const source = readFileSync(DERIVED_STATE_PATH, 'utf8');
  const functionStart = source.indexOf('export function getRewriteBtnTitle');

  assert.notEqual(functionStart, -1);
  const functionBody = source.slice(functionStart, functionStart + 700);
  assert.equal(functionBody.includes('noChangesDetected'), false);
});
