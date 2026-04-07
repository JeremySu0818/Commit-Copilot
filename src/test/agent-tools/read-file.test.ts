import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { executeReadFile } from '../../agent-tools/executors/read-file';
import { cleanupTempDir, createTempDir } from '../helpers/temp-dir';

test('executeReadFile validates required path', async () => {
  const repoRoot = createTempDir();
  try {
    const output = await executeReadFile(repoRoot, {}, false);
    assert.equal(output, "Error: 'path' is required.");
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('executeReadFile prevents path traversal', async () => {
  const repoRoot = createTempDir();
  try {
    const output = await executeReadFile(repoRoot, { path: '../x.txt' }, false);
    assert.equal(output, 'Error: path traversal is not allowed.');
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('executeReadFile reads disk file and line range', async () => {
  const repoRoot = createTempDir();
  try {
    const filePath = path.join(repoRoot, 'src', 'index.ts');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'a\nb\nc\n', 'utf-8');

    const output = await executeReadFile(
      repoRoot,
      { path: 'src/index.ts', startLine: 2, endLine: 3 },
      false,
    );
    assert.match(output, /File: src\/index\.ts \(lines 2-3 of 4\)/);
    assert.match(output, /2: b/);
    assert.match(output, /3: c/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('executeReadFile clamps endLine to startLine for negative values', async () => {
  const repoRoot = createTempDir();
  try {
    const filePath = path.join(repoRoot, 'src', 'index.ts');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'a\nb\nc\n', 'utf-8');

    const output = await executeReadFile(
      repoRoot,
      { path: 'src/index.ts', startLine: 2, endLine: -5 },
      false,
    );
    assert.match(output, /File: src\/index\.ts \(lines 2-2 of 4\)/);
    assert.match(output, /2: b/);
    assert.doesNotMatch(output, /3: c/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('executeReadFile prefers staged index content when available', async () => {
  const repoRoot = createTempDir();
  try {
    const filePath = path.join(repoRoot, 'file.txt');
    fs.writeFileSync(filePath, 'disk', 'utf-8');

    const gitOps = {
      showIndexFile: async () => ({ content: 'index-content', found: true }),
    } as any;

    const output = await executeReadFile(
      repoRoot,
      { path: 'file.txt' },
      true,
      gitOps,
    );
    assert.match(output, /1: index-content/);
    assert.doesNotMatch(output, /disk/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('executeReadFile falls back to disk when staged file not found in index', async () => {
  const repoRoot = createTempDir();
  try {
    const filePath = path.join(repoRoot, 'file.txt');
    fs.writeFileSync(filePath, 'disk-only', 'utf-8');

    const gitOps = {
      showIndexFile: async () => ({ content: '', found: false }),
    } as any;

    const output = await executeReadFile(
      repoRoot,
      { path: 'file.txt' },
      true,
      gitOps,
    );
    assert.match(output, /1: disk-only/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});
