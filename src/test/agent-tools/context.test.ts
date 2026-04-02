import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildInitialContext,
  getProjectStructure,
  parseDiffSummary,
} from '../../agent-tools/context';
import { cleanupTempDir, createTempDir } from '../helpers/temp-dir';

test('parseDiffSummary parses modified, added, deleted, and renamed files', () => {
  const diff = [
    'diff --git a/src/a.ts b/src/a.ts',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '+one',
    '-two',
    'diff --git a/src/new.ts b/src/new.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/src/new.ts',
    '+x',
    'diff --git a/src/old.ts b/src/old.ts',
    'deleted file mode 100644',
    '--- a/src/old.ts',
    '+++ /dev/null',
    '-gone',
    'diff --git a/src/rename-old.ts b/src/rename-new.ts',
    'rename from src/rename-old.ts',
    'rename to src/rename-new.ts',
  ].join('\n');

  const summary = parseDiffSummary(diff);
  assert.equal(summary.length, 4);
  assert.deepEqual(
    summary.map((f) => f.type),
    ['modified', 'added', 'deleted', 'renamed'],
  );
});

test('parseDiffSummary marks binary diffs as non-zero changes', () => {
  const diff = [
    'diff --git a/resources/icon.png b/resources/icon.png',
    'index 1111111..2222222 100644',
    'Binary files a/resources/icon.png and b/resources/icon.png differ',
  ].join('\n');

  const summary = parseDiffSummary(diff);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].path, 'resources/icon.png');
  assert.equal(summary[0].type, 'modified');
  assert.equal(summary[0].added, 1);
  assert.equal(summary[0].removed, 1);
});

test('getProjectStructure uses git API file list when available', async () => {
  const gitOps = {
    listFilesFromGitApi: async () => [
      'src/a.ts',
      'src/b.ts',
      'node_modules/x.js',
    ],
  } as any;

  const structure = await getProjectStructure('unused', gitOps);
  assert.match(structure, /src\//);
  assert.match(structure, /a\.ts/);
  assert.match(structure, /node_modules/);
});

test('buildInitialContext includes tool guidance when tools are enabled', async () => {
  const repoRoot = createTempDir();
  try {
    fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'src', 'index.ts'), 'const x = 1;\n');
    const gitOps = {
      listFilesFromGitApi: async () => ['src/index.ts'],
      getCommitCount: async () => 3,
    } as any;
    const context = await buildInitialContext(
      'diff --git a/src/index.ts b/src/index.ts',
      repoRoot,
      gitOps,
      true,
      true,
    );

    assert.match(context, /## Staged Changes Summary/);
    assert.match(
      context,
      /`get_diff`, `read_file`, `get_file_outline`, `find_references`, and `search_code`/,
    );
    assert.match(context, /This repository has 3 commits\./);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('buildInitialContext omits tool guidance when disabled', async () => {
  const repoRoot = createTempDir();
  try {
    fs.writeFileSync(path.join(repoRoot, 'a.txt'), 'x');
    const context = await buildInitialContext(
      'diff --git a/a.txt b/a.txt',
      repoRoot,
      undefined,
      false,
      false,
    );
    assert.match(context, /## Unstaged Changes Summary/);
    assert.doesNotMatch(context, /Use your tools/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});
