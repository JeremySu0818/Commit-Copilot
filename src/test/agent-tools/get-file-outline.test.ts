import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'node:module';
import type { GitOperations } from '../../commit-copilot';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';
import {
  MockTextDocument,
  MockUri,
  createVscodeMock,
} from '../helpers/vscode-mock';
import { cleanupTempDir, createTempDir } from '../helpers/temp-dir';

const MODULE_PATH = '../../agent-tools/executors/get-file-outline';

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return '';
}

async function loadModule(
  vscodeMock: unknown,
): Promise<typeof import('../../agent-tools/executors/get-file-outline')> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('vscode', vscodeMock, () => {
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(
      MODULE_PATH,
    ) as typeof import('../../agent-tools/executors/get-file-outline');
  });
}

void test('executeGetFileOutline validates required path', async () => {
  const { executeGetFileOutline } = await loadModule(createVscodeMock());
  const output = await executeGetFileOutline('repo', {}, false);
  assert.equal(output, "Error: 'path' is required.");
});

void test('executeGetFileOutline prevents path traversal', async () => {
  const { executeGetFileOutline } = await loadModule(createVscodeMock());
  const output = await executeGetFileOutline(
    'repo',
    { path: '../x.ts' },
    false,
  );
  assert.equal(output, 'Error: path traversal is not allowed.');
});

void test('executeGetFileOutline renders outline from document symbols', async () => {
  const repoRoot = createTempDir();
  try {
    const relPath = 'src/sample.ts';
    const absPath = path.join(repoRoot, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, 'class A {\n  run() {}\n}\n', 'utf-8');

    const vscodeMock = createVscodeMock({
      openTextDocument: (input) => {
        if (input instanceof MockUri) {
          return Promise.resolve(
            new MockTextDocument(
              input,
              fs.readFileSync(input.fsPath, 'utf-8'),
              'typescript',
            ),
          );
        }
        if (input && typeof input === 'object' && 'content' in input) {
          return Promise.resolve(
            new MockTextDocument(
              new MockUri('untitled://staged', 'untitled'),
              toText((input as { content?: unknown }).content),
              'plaintext',
            ),
          );
        }
        return Promise.reject(new Error('Unsupported openTextDocument input'));
      },
      executeCommand: (command: string, ..._args: unknown[]) => {
        if (command !== 'vscode.executeDocumentSymbolProvider') {
          return Promise.resolve([]);
        }
        return Promise.resolve([
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
        ]);
      },
    });

    const { executeGetFileOutline } = await loadModule(vscodeMock);
    const gitOps = {
      showIndexFile: () =>
        Promise.resolve({
          content: 'class A {\n run() {}\n}\n',
          found: true,
        }),
    } as unknown as GitOperations;

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

void test('executeGetFileOutline handles empty symbol results', async () => {
  const repoRoot = createTempDir();
  try {
    const relPath = 'a.ts';
    const absPath = path.join(repoRoot, relPath);
    fs.writeFileSync(absPath, 'const x = 1;\n', 'utf-8');

    const vscodeMock = createVscodeMock({
      openTextDocument: (input) => {
        if (input instanceof MockUri) {
          return Promise.resolve(
            new MockTextDocument(input, 'const x = 1;\n', 'typescript'),
          );
        }
        return Promise.resolve(
          new MockTextDocument(
            new MockUri('untitled://x', 'untitled'),
            'const x = 1;\n',
            'plaintext',
          ),
        );
      },
      executeCommand: () => Promise.resolve([]),
    });

    const { executeGetFileOutline } = await loadModule(vscodeMock);
    const output = await executeGetFileOutline(
      repoRoot,
      { path: relPath },
      false,
    );
    assert.match(output, /No document symbols available/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

void test('executeGetFileOutline infers language for staged new files', async () => {
  const repoRoot = createTempDir();
  try {
    const relPath = 'src/new-file.ts';
    const openInputs: unknown[] = [];

    const vscodeMock = createVscodeMock({
      openTextDocument: (input) => {
        openInputs.push(input);

        if (input instanceof MockUri) {
          return Promise.reject(
            new Error('Document is not available on disk.'),
          );
        }

        if (input && typeof input === 'object' && 'content' in input) {
          const options = input as { content?: unknown; language?: unknown };
          const languageId =
            typeof options.language === 'string'
              ? options.language
              : 'plaintext';
          return Promise.resolve(
            new MockTextDocument(
              new MockUri('untitled://staged', 'untitled'),
              toText(options.content),
              languageId,
            ),
          );
        }

        return Promise.reject(new Error('Unsupported openTextDocument input'));
      },
      executeCommand: (command: string, ..._args: unknown[]) => {
        if (command !== 'vscode.executeDocumentSymbolProvider') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      },
    });

    const { executeGetFileOutline } = await loadModule(vscodeMock);
    const gitOps = {
      showIndexFile: () =>
        Promise.resolve({
          content: 'export const x = 1;\n',
          found: true,
        }),
    } as unknown as GitOperations;

    const output = await executeGetFileOutline(
      repoRoot,
      { path: relPath },
      true,
      gitOps,
    );

    assert.match(output, /language "typescript"/);

    const stagedOpen = openInputs.find(
      (value) =>
        value &&
        typeof value === 'object' &&
        'content' in (value as Record<string, unknown>),
    ) as { language?: unknown } | undefined;

    assert.ok(stagedOpen);
    assert.equal(stagedOpen.language, 'typescript');
  } finally {
    cleanupTempDir(repoRoot);
  }
});
