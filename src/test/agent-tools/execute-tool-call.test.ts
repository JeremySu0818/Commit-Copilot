import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';
import { createVscodeMock } from '../helpers/vscode-mock';

const MODULE_PATH = '../../agent-tools/executors/execute-tool-call';

async function loadExecuteToolCall(): Promise<
  typeof import('../../agent-tools/executors/execute-tool-call')
> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('vscode', createVscodeMock(), async () => {
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(
      MODULE_PATH,
    ) as typeof import('../../agent-tools/executors/execute-tool-call');
  });
}

test('executeToolCall returns error for unknown tool', async () => {
  const { executeToolCall } = await loadExecuteToolCall();
  const result = await executeToolCall(
    { name: 'unknown_tool', arguments: {} },
    'repo',
    '',
  );
  assert.equal(result.error, true);
  assert.equal(result.content, 'Unknown tool: unknown_tool');
});

test('executeToolCall dispatches get_diff successfully', async () => {
  const { executeToolCall } = await loadExecuteToolCall();
  const diff = [
    'diff --git a/src/a.ts b/src/a.ts',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -1 +1 @@',
    '-a',
    '+b',
  ].join('\n');

  const result = await executeToolCall(
    { name: 'get_diff', arguments: { path: 'src/a.ts' } },
    'repo',
    diff,
  );
  assert.equal(result.error, undefined);
  assert.match(result.content, /diff --git a\/src\/a\.ts b\/src\/a\.ts/);
});

test('executeToolCall converts thrown errors to tool error response', async () => {
  const { executeToolCall } = await loadExecuteToolCall();
  const gitOps = {
    getRecentCommitMessages: async () => {
      throw new Error('boom');
    },
  } as any;

  const result = await executeToolCall(
    { name: 'get_recent_commits', arguments: { count: 1 } },
    'repo',
    '',
    true,
    gitOps,
  );
  assert.equal(result.error, true);
  assert.equal(result.content, 'Tool execution error: boom');
});
