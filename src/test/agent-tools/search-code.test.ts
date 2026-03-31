import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';
import { MockUri, createVscodeMock } from '../helpers/vscode-mock';

const MODULE_PATH = '../../agent-tools/executors/search-code';

async function loadModule(vscodeMock: unknown): Promise<
  typeof import('../../agent-tools/executors/search-code')
> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('vscode', vscodeMock, async () => {
    return require(MODULE_PATH) as typeof import('../../agent-tools/executors/search-code');
  });
}

test('executeSearchCode requires query', async () => {
  const { executeSearchCode } = await loadModule(createVscodeMock());
  const output = await executeSearchCode('repo', {});
  assert.equal(
    output,
    "Error: 'query' is required. Provide a keyword or text pattern to search for.",
  );
});

test('executeSearchCode returns no matches message', async () => {
  const repoRoot = path.resolve('repo');
  const file = MockUri.file(path.join(repoRoot, 'src', 'a.ts'));

  const vscodeMock = createVscodeMock({
    findFiles: async () => [file],
    readFile: async () => Buffer.from('const x = 1;\n', 'utf-8'),
  });

  const { executeSearchCode } = await loadModule(vscodeMock);
  const output = await executeSearchCode(repoRoot, { query: 'needle' });
  assert.equal(output, 'No matches found for "needle" in the project.');
});

test('executeSearchCode performs case-insensitive search and result capping', async () => {
  const repoRoot = path.resolve('repo');
  const fileA = MockUri.file(path.join(repoRoot, 'src', 'a.ts'));
  const fileB = MockUri.file(path.join(repoRoot, 'src', 'b.ts'));

  const contentByPath = new Map<string, string>([
    [fileA.fsPath, 'const Value = "Hello";\n'],
    [fileB.fsPath, 'const value = "hello";\n'],
  ]);

  const vscodeMock = createVscodeMock({
    findFiles: async () => [fileA, fileB],
    readFile: async (uri: MockUri) =>
      Buffer.from(contentByPath.get(uri.fsPath) ?? '', 'utf-8'),
  });

  const { executeSearchCode } = await loadModule(vscodeMock);
  const output = await executeSearchCode(repoRoot, {
    query: 'value',
    caseSensitive: false,
    maxResults: 1,
  });

  assert.match(output, /Search results for "value" \(case-insensitive\):/);
  assert.match(output, /src\/a\.ts|src\/b\.ts/);
  assert.match(output, /\.\.\. \(results capped at 1 files\)/);
});
