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

void test('MainView does not render force push with lease button', () => {
  const source = readFileSync(MAIN_VIEW_PATH, 'utf8');
  assert.doesNotMatch(source, /id="forcePushWithLeaseBtn"/);
  assert.doesNotMatch(source, /type:\s*'forcePushWithLease'/);
});
