import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const REWRITE_EDITOR_VIEW_PATH = path.resolve(
  process.cwd(),
  'src',
  'webview',
  'views',
  'RewriteEditorView.tsx',
);

void test('RewriteEditorView wires submit and cancel messages to webview', () => {
  const source = readFileSync(REWRITE_EDITOR_VIEW_PATH, 'utf8');
  assert.match(source, /id="rewriteEditorTextarea"/);
  assert.match(source, /type:\s*'submitRewriteEditor'/);
  assert.match(source, /type:\s*'cancelRewriteEditor'/);
});
