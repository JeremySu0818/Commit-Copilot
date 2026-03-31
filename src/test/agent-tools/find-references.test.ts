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

const MODULE_PATH = '../../agent-tools/executors/find-references';

async function loadModule(vscodeMock: unknown): Promise<
  typeof import('../../agent-tools/executors/find-references')
> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('vscode', vscodeMock, async () => {
    return require(MODULE_PATH) as typeof import('../../agent-tools/executors/find-references');
  });
}

test('executeFindReferences validates required position args', async () => {
  const { executeFindReferences } = await loadModule(createVscodeMock());
  const output = await executeFindReferences(
    'repo',
    { path: 'a.ts', line: 0, character: 1 },
    false,
    '',
  );
  assert.equal(
    output,
    "Error: 'line' and 'character' are required and must be positive 1-based numbers.",
  );
});

test('executeFindReferences validates line and character range', async () => {
  const repoRoot = createTempDir();
  try {
    const relPath = 'src/a.ts';
    const absPath = path.join(repoRoot, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, 'alpha\nbeta\n', 'utf-8');

    const vscodeMock = createVscodeMock({
      openTextDocument: async (input) => {
        if (!(input instanceof MockUri)) {
          throw new Error('Expected file URI');
        }
        return new MockTextDocument(input, fs.readFileSync(input.fsPath, 'utf-8'), 'typescript');
      },
    });

    const { executeFindReferences } = await loadModule(vscodeMock);
    const lineErr = await executeFindReferences(
      repoRoot,
      { path: relPath, line: 20, character: 1 },
      false,
      '',
    );
    assert.match(lineErr, /outside the valid range/);

    const charErr = await executeFindReferences(
      repoRoot,
      { path: relPath, line: 1, character: 99 },
      false,
      '',
    );
    assert.match(charErr, /outside the line length/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('executeFindReferences formats grouped references with snippets', async () => {
  const repoRoot = createTempDir();
  try {
    const relA = 'src/a.ts';
    const relB = 'src/b.ts';
    const absA = path.join(repoRoot, relA);
    const absB = path.join(repoRoot, relB);
    fs.mkdirSync(path.dirname(absA), { recursive: true });
    fs.writeFileSync(absA, 'foo()\n', 'utf-8');
    fs.writeFileSync(absB, 'call foo()\n', 'utf-8');

    const vscodeMock = createVscodeMock({
      openTextDocument: async (input) => {
        if (!(input instanceof MockUri)) {
          throw new Error('Expected file URI');
        }
        return new MockTextDocument(
          input,
          fs.readFileSync(input.fsPath, 'utf-8'),
          'typescript',
        );
      },
      executeCommand: async (command: string) => {
        if (command !== 'vscode.executeReferenceProvider') {
          return undefined;
        }
        return [
          {
            uri: vscodeMock.Uri.file(absA),
            range: new vscodeMock.Range(
              new vscodeMock.Position(0, 0),
              new vscodeMock.Position(0, 3),
            ),
          },
          {
            uri: vscodeMock.Uri.file(absB),
            range: new vscodeMock.Range(
              new vscodeMock.Position(0, 5),
              new vscodeMock.Position(0, 8),
            ),
          },
          {
            uri: vscodeMock.Uri.file(absB),
            range: new vscodeMock.Range(
              new vscodeMock.Position(0, 5),
              new vscodeMock.Position(0, 8),
            ),
          },
        ];
      },
    });

    const { executeFindReferences } = await loadModule(vscodeMock);
    const output = await executeFindReferences(
      repoRoot,
      { path: relA, line: 1, character: 1, includeDeclaration: true },
      false,
      '',
    );

    assert.match(output, /References for src\/a\.ts:1:1 \(includeDeclaration: true\)/);
    assert.match(output, /Found 2 references in 2 files\./);
    assert.match(output, /src[\\/]+a\.ts/);
    assert.match(output, /L1:C1/);
    assert.match(output, /src[\\/]+b\.ts/);
    assert.match(output, /L1:C6/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('executeFindReferences handles missing provider result', async () => {
  const repoRoot = createTempDir();
  try {
    const relPath = 'a.ts';
    const absPath = path.join(repoRoot, relPath);
    fs.writeFileSync(absPath, 'const x = 1;\n', 'utf-8');

    const vscodeMock = createVscodeMock({
      openTextDocument: async (input) => {
        if (!(input instanceof MockUri)) {
          throw new Error('Expected file URI');
        }
        return new MockTextDocument(input, 'const x = 1;\n', 'typescript');
      },
      executeCommand: async () => undefined,
    });

    const { executeFindReferences } = await loadModule(vscodeMock);
    const output = await executeFindReferences(
      repoRoot,
      { path: relPath, line: 1, character: 1 },
      false,
      '',
    );
    assert.match(output, /No reference provider available/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});
