import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';
import {
  MockTextDocument,
  MockUri,
  createVscodeMock,
} from '../helpers/vscode-mock';
import { cleanupTempDir, createTempDir } from '../helpers/temp-dir';

const MODULE_PATH = '../../agent-tools/executors/get-file-outline';

async function loadModule(vscodeMock: unknown): Promise<
  typeof import('../../agent-tools/executors/get-file-outline')
> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('vscode', vscodeMock, async () => {
    return require(MODULE_PATH) as typeof import('../../agent-tools/executors/get-file-outline');
  });
}

test('executeGetFileOutline validates required path', async () => {
  const { executeGetFileOutline } = await loadModule(createVscodeMock());
  const output = await executeGetFileOutline('repo', {}, false);
  assert.equal(output, "Error: 'path' is required.");
});

test('executeGetFileOutline prevents path traversal', async () => {
  const { executeGetFileOutline } = await loadModule(createVscodeMock());
  const output = await executeGetFileOutline('repo', { path: '../x.ts' }, false);
  assert.equal(output, 'Error: path traversal is not allowed.');
});

test('executeGetFileOutline renders outline from document symbols', async () => {
  const repoRoot = createTempDir();
  try {
    const relPath = 'src/sample.ts';
    const absPath = path.join(repoRoot, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, 'class A {\n  run() {}\n}\n', 'utf-8');

    const vscodeMock = createVscodeMock({
      openTextDocument: async (input) => {
        if (input instanceof MockUri) {
          return new MockTextDocument(
            input,
            fs.readFileSync(input.fsPath, 'utf-8'),
            'typescript',
          );
        }
        if (input && typeof input === 'object' && 'content' in input) {
          return new MockTextDocument(
            new MockUri('untitled://staged', 'untitled'),
            String((input as { content?: unknown }).content ?? ''),
            'plaintext',
          );
        }
        throw new Error('Unsupported openTextDocument input');
      },
      executeCommand: async (command: string, ..._args: unknown[]) => {
        if (command !== 'vscode.executeDocumentSymbolProvider') {
          return [];
        }
        return [
          new vscodeMock.DocumentSymbol(
            'A',
            '',
            vscodeMock.SymbolKind.Class,
            new vscodeMock.Range(
              new vscodeMock.Position(0, 0),
              new vscodeMock.Position(2, 1),
            ),
            new vscodeMock.Range(
              new vscodeMock.Position(0, 6),
              new vscodeMock.Position(0, 7),
            ),
            [
              new vscodeMock.DocumentSymbol(
                'run',
                '',
                vscodeMock.SymbolKind.Method,
                new vscodeMock.Range(
                  new vscodeMock.Position(1, 2),
                  new vscodeMock.Position(1, 9),
                ),
                new vscodeMock.Range(
                  new vscodeMock.Position(1, 2),
                  new vscodeMock.Position(1, 5),
                ),
                [],
              ),
            ],
          ),
        ];
      },
    });

    const { executeGetFileOutline } = await loadModule(vscodeMock);
    const gitOps = {
      showIndexFile: async () => ({ content: 'class A {\n run() {}\n}\n', found: true }),
    } as any;

    const output = await executeGetFileOutline(
      repoRoot,
      { path: relPath },
      true,
      gitOps,
    );

    assert.match(output, /File: src\/sample\.ts/);
    assert.match(output, /L1 \[Class\] A/);
    assert.match(output, /L2 \[Method\] run/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('executeGetFileOutline handles empty symbol results', async () => {
  const repoRoot = createTempDir();
  try {
    const relPath = 'a.ts';
    const absPath = path.join(repoRoot, relPath);
    fs.writeFileSync(absPath, 'const x = 1;\n', 'utf-8');

    const vscodeMock = createVscodeMock({
      openTextDocument: async (input) => {
        if (input instanceof MockUri) {
          return new MockTextDocument(input, 'const x = 1;\n', 'typescript');
        }
        return new MockTextDocument(
          new MockUri('untitled://x', 'untitled'),
          'const x = 1;\n',
          'plaintext',
        );
      },
      executeCommand: async () => [],
    });

    const { executeGetFileOutline } = await loadModule(vscodeMock);
    const output = await executeGetFileOutline(repoRoot, { path: relPath }, false);
    assert.match(output, /No document symbols available/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});
