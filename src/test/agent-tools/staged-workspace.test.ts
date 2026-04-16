import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import type { GitOperations } from '../../commit-copilot';
import {
  STAGED_WORKSPACE_DIR_NAME,
  STAGED_WORKSPACE_SUBDIR_NAME,
  cleanupStagedWorkspaceSnapshot,
  createStagedWorkspaceSnapshot,
  isPathWithinRoot,
  toPosixPath,
} from '../../agent-tools/staged-workspace';
import { cleanupTempDir, createTempDir } from '../helpers/temp-dir';

void test('isPathWithinRoot validates child paths only', () => {
  const root = path.resolve('repo');
  assert.equal(isPathWithinRoot(root, path.join(root, 'src', 'a.ts')), true);
  assert.equal(isPathWithinRoot(root, path.resolve(root, '..', 'x.ts')), false);
});

void test('toPosixPath normalizes windows separators', () => {
  assert.equal(toPosixPath(`a${path.sep}b${path.sep}c.ts`), 'a/b/c.ts');
});

void test('createStagedWorkspaceSnapshot builds index-based snapshot', async () => {
  const repoRoot = createTempDir();
  try {
    fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'src', 'a.ts'), 'working-a', 'utf-8');
    fs.writeFileSync(path.join(repoRoot, 'src', 'b.ts'), 'working-b', 'utf-8');
    fs.writeFileSync(
      path.join(repoRoot, 'src', 'deleted.ts'),
      'remove-me',
      'utf-8',
    );

    const diffContent = [
      'diff --git a/src/a.ts b/src/a.ts',
      'diff --git a/src/deleted.ts b/src/deleted.ts',
      'deleted file mode 100644',
      '--- a/src/deleted.ts',
      '+++ /dev/null',
    ].join('\n');

    const gitOps = {
      listFilesFromGitApi: () => Promise.resolve(null),
      showIndexFile: (relPath: string) => {
        if (relPath === 'src/a.ts') {
          return Promise.resolve({ content: 'index-a', found: true });
        }
        if (relPath === 'src/deleted.ts') {
          return Promise.resolve({ content: '', found: false });
        }
        if (relPath === 'src/b.ts') {
          return Promise.resolve({ content: 'index-b', found: true });
        }
        return Promise.resolve({ content: '', found: false });
      },
      getUntrackedPaths: () => [],
      getWorkingTreePaths: () => [path.join(repoRoot, 'src', 'b.ts')],
    } as unknown as GitOperations;

    const snapshot = await createStagedWorkspaceSnapshot(
      repoRoot,
      diffContent,
      gitOps,
    );

    const aPath = path.join(snapshot, 'src', 'a.ts');
    const bPath = path.join(snapshot, 'src', 'b.ts');
    const deletedPath = path.join(snapshot, 'src', 'deleted.ts');

    assert.equal(fs.readFileSync(aPath, 'utf-8'), 'index-a');
    assert.equal(fs.readFileSync(bPath, 'utf-8'), 'index-b');
    assert.equal(fs.existsSync(deletedPath), false);

    cleanupStagedWorkspaceSnapshot(snapshot);
    assert.equal(fs.existsSync(snapshot), false);
    assert.equal(
      fs.existsSync(
        path.join(
          repoRoot,
          STAGED_WORKSPACE_DIR_NAME,
          STAGED_WORKSPACE_SUBDIR_NAME,
        ),
      ),
      false,
    );
  } finally {
    cleanupTempDir(repoRoot);
  }
});
