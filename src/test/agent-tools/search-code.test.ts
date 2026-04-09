import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';
import { MockUri, createVscodeMock } from '../helpers/vscode-mock';

const MODULE_PATH = '../../agent-tools/executors/search-code';

async function loadModule(
  vscodeMock: unknown,
): Promise<typeof import('../../agent-tools/executors/search-code')> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('vscode', vscodeMock, async () => {
    return require(
      MODULE_PATH,
    ) as typeof import('../../agent-tools/executors/search-code');
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

test('executeSearchCode prefers Git file list when available', async () => {
  const repoRoot = path.resolve('repo');
  const srcFilePath = path.join(repoRoot, 'src', 'a.ts');
  const gitIgnoredPath = path.join(repoRoot, 'node_modules', 'pkg', 'index.js');

  const vscodeMock = createVscodeMock({
    findFiles: async () => {
      throw new Error(
        'findFiles should not be called when git file list exists',
      );
    },
    readFile: async (uri: MockUri) => {
      if (uri.fsPath === srcFilePath) {
        return Buffer.from('const needle = true;\n', 'utf-8');
      }
      if (uri.fsPath === gitIgnoredPath) {
        return Buffer.from('const needle = true;\n', 'utf-8');
      }
      return Buffer.from('', 'utf-8');
    },
  });

  const { executeSearchCode } = await loadModule(vscodeMock);
  const output = await executeSearchCode(repoRoot, { query: 'needle' }, {
    listFilesFromGitApi: async () => ['src/a.ts'],
  } as any);

  assert.match(output, /src\/a\.ts/);
  assert.doesNotMatch(output, /node_modules\/pkg\/index\.js/);
});

test('executeSearchCode skips known binary extensions without reading file', async () => {
  const repoRoot = path.resolve('repo');
  const binaryFile = MockUri.file(path.join(repoRoot, 'assets', 'logo.png'));
  let readCount = 0;

  const vscodeMock = createVscodeMock({
    findFiles: async () => [binaryFile],
    readFile: async () => {
      readCount += 1;
      return Buffer.from('should not be read', 'utf-8');
    },
  });

  const { executeSearchCode } = await loadModule(vscodeMock);
  const output = await executeSearchCode(repoRoot, { query: 'logo' });

  assert.equal(output, 'No matches found for "logo" in the project.');
  assert.equal(readCount, 0);
});

test('executeSearchCode skips oversized files before reading content', async () => {
  const repoRoot = path.resolve('repo');
  const largeFile = MockUri.file(path.join(repoRoot, 'src', 'big.ts'));
  let readCount = 0;

  const vscodeMock = createVscodeMock({
    findFiles: async () => [largeFile],
    stat: async () => ({
      type: 0,
      ctime: 0,
      mtime: 0,
      size: 2 * 1024 * 1024,
    }),
    readFile: async () => {
      readCount += 1;
      return Buffer.from('const value = true;\n', 'utf-8');
    },
  });

  const { executeSearchCode } = await loadModule(vscodeMock);
  const output = await executeSearchCode(repoRoot, { query: 'value' });

  assert.equal(output, 'No matches found for "value" in the project.');
  assert.equal(readCount, 0);
});
