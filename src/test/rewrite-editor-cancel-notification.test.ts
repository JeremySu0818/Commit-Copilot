import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const EXTENSION_PATH = path.resolve(process.cwd(), 'src', 'extension.ts');

void test('rewrite editor cancel shows a cancellation notification', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');
  const cancelBranchIndex = source.indexOf(
    "if (typeof rewrittenMessage !== 'string') {",
  );

  assert.notEqual(cancelBranchIndex, -1);
  assert.equal(
    source
      .slice(cancelBranchIndex, cancelBranchIndex + 200)
      .includes(
        'vscode.window.showInformationMessage(text.notification.rewriteCanceled);',
      ),
    true,
  );
});
