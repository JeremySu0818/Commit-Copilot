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

void test('MainView wires force push with lease button to webview message', () => {
  const source = readFileSync(MAIN_VIEW_PATH, 'utf8');
  assert.match(source, /id="forcePushWithLeaseBtn"/);
  assert.match(source, /type:\s*'forcePushWithLease'/);
});
