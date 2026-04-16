import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { createRequire } from 'node:module';
import type { GitOperations } from '../../commit-copilot';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';
import { MockUri, createVscodeMock } from '../helpers/vscode-mock';

const MODULE_PATH = '../../agent-tools/executors/search-code';

async function loadModule(
  vscodeMock: unknown,
): Promise<typeof import('../../agent-tools/executors/search-code')> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('vscode', vscodeMock, () => {
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(
      MODULE_PATH,
    ) as typeof import('../../agent-tools/executors/search-code');
  });
}

void test('executeSearchCode requires query', async () => {
  const { executeSearchCode } = await loadModule(createVscodeMock());
  const output = await executeSearchCode('repo', {});
  assert.equal(
    output,
    "Error: 'query' is required. Provide a keyword or text pattern to search for.",
  );
});

void test('executeSearchCode returns no matches message', async () => {
  const repoRoot = path.resolve('repo');
  const file = MockUri.file(path.join(repoRoot, 'src', 'a.ts'));

  const vscodeMock = createVscodeMock({
    findFiles: () => Promise.resolve([file]),
    readFile: () => Promise.resolve(Buffer.from('const x = 1;\n', 'utf-8')),
  });

  const { executeSearchCode } = await loadModule(vscodeMock);
  const output = await executeSearchCode(repoRoot, { query: 'needle' });
  assert.equal(output, 'No matches found for "needle" in the project.');
});

void test('executeSearchCode performs case-insensitive search and result capping', async () => {
  const repoRoot = path.resolve('repo');
  const fileA = MockUri.file(path.join(repoRoot, 'src', 'a.ts'));
  const fileB = MockUri.file(path.join(repoRoot, 'src', 'b.ts'));

  const contentByPath = new Map<string, string>([
    [fileA.fsPath, 'const Value = "Hello";\n'],
    [fileB.fsPath, 'const value = "hello";\n'],
  ]);

  const vscodeMock = createVscodeMock({
    findFiles: () => Promise.resolve([fileA, fileB]),
    readFile: (uri: MockUri) =>
      Promise.resolve(
        Buffer.from(contentByPath.get(uri.fsPath) ?? '', 'utf-8'),
      ),
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

void test('executeSearchCode prefers Git file list when available', async () => {
  const repoRoot = path.resolve('repo');
  const srcFilePath = path.join(repoRoot, 'src', 'a.ts');
  const gitIgnoredPath = path.join(repoRoot, 'node_modules', 'pkg', 'index.js');

  const vscodeMock = createVscodeMock({
    findFiles: () =>
      Promise.reject(
        new Error('findFiles should not be called when git file list exists'),
      ),
    readFile: (uri: MockUri) => {
      if (uri.fsPath === srcFilePath) {
        return Promise.resolve(Buffer.from('const needle = true;\n', 'utf-8'));
      }
      if (uri.fsPath === gitIgnoredPath) {
        return Promise.resolve(Buffer.from('const needle = true;\n', 'utf-8'));
      }
      return Promise.resolve(Buffer.from('', 'utf-8'));
    },
  });

  const { executeSearchCode } = await loadModule(vscodeMock);
  const output = await executeSearchCode(repoRoot, { query: 'needle' }, {
    listFilesFromGitApi: () => Promise.resolve(['src/a.ts']),
  } as unknown as GitOperations);

  assert.match(output, /src\/a\.ts/);
  assert.doesNotMatch(output, /node_modules\/pkg\/index\.js/);
});
