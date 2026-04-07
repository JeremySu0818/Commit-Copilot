import * as fs from 'fs';
import * as path from 'path';
import { GitOperations } from '../commit-copilot';

const STAGED_WORKSPACE_DIR_NAME = 'commit-copilot-temp';
const STAGED_WORKSPACE_SUBDIR_NAME = 'staged-workspace';

type StagedDiffEntry = {
  aPath: string;
  bPath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
};

function parseStagedDiffEntries(diffContent: string): StagedDiffEntry[] {
  const entries: StagedDiffEntry[] = [];
  const lines = diffContent.split('\n');
  let current: StagedDiffEntry | null = null;

  for (const line of lines) {
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (match) {
      if (current) {
        entries.push(current);
      }
      current = {
        aPath: match[1],
        bPath: match[2],
        status: 'modified',
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith('new file mode') || line.startsWith('--- /dev/null')) {
      current.status = 'added';
      continue;
    }
    if (
      line.startsWith('deleted file mode') ||
      line.startsWith('+++ /dev/null')
    ) {
      current.status = 'deleted';
      continue;
    }
    if (line.startsWith('rename from') || line.startsWith('rename to')) {
      current.status = 'renamed';
      continue;
    }
  }

  if (current) {
    entries.push(current);
  }

  for (const entry of entries) {
    if (entry.status === 'modified' && entry.aPath !== entry.bPath) {
      entry.status = 'renamed';
    }
  }

  return entries;
}

type RemovePathOptions = {
  throwOnFailure?: boolean;
  operation?: string;
};

function removePath(
  targetPath: string,
  options?: RemovePathOptions,
): Error | null {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return null;
  } catch (err: any) {
    if (options?.throwOnFailure) {
      const message = err?.message || String(err);
      const code = err?.code ? ` (${err.code})` : '';
      throw new Error(
        `Failed to ${options.operation ?? 'remove path'} '${targetPath}'${code}: ${message}`,
      );
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}

async function copyWorkspaceSnapshot(
  repoRoot: string,
  destRoot: string,
  gitOps: GitOperations,
): Promise<void> {
  const trackedFiles = await gitOps.listFilesFromGitApi();
  if (trackedFiles !== null) {
    for (const relPath of trackedFiles) {
      const nativePath = relPath.replace(/\//g, path.sep);
      const srcPath = path.join(repoRoot, nativePath);
      const destPath = path.join(destRoot, nativePath);
      try {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
      } catch {}
    }
    return;
  }

  const stack: Array<{ src: string; dest: string }> = [
    { src: repoRoot, dest: destRoot },
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    const { src, dest } = current;
    fs.mkdirSync(dest, { recursive: true });

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(src, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === STAGED_WORKSPACE_DIR_NAME || entry.name === '.git') {
          continue;
        }
        stack.push({ src: srcPath, dest: destPath });
        continue;
      }

      if (entry.isFile()) {
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch {}
      }
    }
  }
}

function toRepoRelativePath(
  repoRoot: string,
  targetPath: string,
): string | null {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedTarget = path.resolve(targetPath);
  const rel = path.relative(resolvedRepoRoot, resolvedTarget);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return rel;
}

function isPathWithinRoot(rootPath: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (rel === '') {
    return true;
  }
  if (rel === '..' || rel.startsWith(`..${path.sep}`)) {
    return false;
  }
  return !path.isAbsolute(rel);
}

function toPosixPath(relPath: string): string {
  return relPath.split(path.sep).join('/');
}

async function restoreIndexSnapshotFile(
  workspaceRoot: string,
  relPath: string,
  gitOps: GitOperations,
): Promise<void> {
  const targetAbs = path.resolve(workspaceRoot, relPath);
  if (!isPathWithinRoot(workspaceRoot, targetAbs)) {
    return;
  }

  const { content, found } = await gitOps.showIndexFile(relPath);
  if (!found) {
    removePath(targetAbs);
    return;
  }

  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  fs.writeFileSync(targetAbs, content, 'utf-8');
}

async function scrubWorkspaceToIndex(
  repoRoot: string,
  workspaceRoot: string,
  gitOps: GitOperations,
): Promise<void> {
  const untrackedRelPaths = new Set<string>();

  for (const absPath of gitOps.getUntrackedPaths()) {
    const relPath = toRepoRelativePath(repoRoot, absPath);
    if (!relPath) continue;
    const relPosix = toPosixPath(relPath);
    untrackedRelPaths.add(relPosix);

    const targetAbs = path.resolve(workspaceRoot, relPosix);
    if (isPathWithinRoot(workspaceRoot, targetAbs)) {
      removePath(targetAbs);
    }
  }

  for (const absPath of gitOps.getWorkingTreePaths()) {
    const relPath = toRepoRelativePath(repoRoot, absPath);
    if (!relPath) continue;
    const relPosix = toPosixPath(relPath);
    if (untrackedRelPaths.has(relPosix)) {
      continue;
    }
    await restoreIndexSnapshotFile(workspaceRoot, relPosix, gitOps);
  }
}

async function createStagedWorkspaceSnapshot(
  repoRoot: string,
  diffContent: string,
  gitOps?: GitOperations,
): Promise<string> {
  if (!gitOps) {
    throw new Error(
      'git operations are not available to build staged workspace.',
    );
  }

  const baseTempRoot = path.join(repoRoot, STAGED_WORKSPACE_DIR_NAME);
  const workspaceRoot = path.join(baseTempRoot, STAGED_WORKSPACE_SUBDIR_NAME);

  fs.mkdirSync(baseTempRoot, { recursive: true });
  removePath(workspaceRoot, {
    throwOnFailure: true,
    operation: 'clean staged workspace snapshot',
  });
  await copyWorkspaceSnapshot(repoRoot, workspaceRoot, gitOps);
  await scrubWorkspaceToIndex(repoRoot, workspaceRoot, gitOps);

  const stagedEntries = parseStagedDiffEntries(diffContent);
  for (const entry of stagedEntries) {
    if (entry.status === 'deleted') {
      const deletedPath = path.resolve(workspaceRoot, entry.aPath);
      if (isPathWithinRoot(workspaceRoot, deletedPath)) {
        removePath(deletedPath);
      }
      continue;
    }

    if (entry.status === 'renamed' && entry.aPath !== entry.bPath) {
      const oldPath = path.resolve(workspaceRoot, entry.aPath);
      if (isPathWithinRoot(workspaceRoot, oldPath)) {
        removePath(oldPath);
      }
    }

    const targetRel = entry.bPath === '/dev/null' ? entry.aPath : entry.bPath;
    if (!targetRel || targetRel === '/dev/null') continue;

    const targetAbs = path.resolve(workspaceRoot, targetRel);
    if (!isPathWithinRoot(workspaceRoot, targetAbs)) {
      continue;
    }

    fs.mkdirSync(path.dirname(targetAbs), { recursive: true });

    let content = '';
    let hasContent = false;
    const { content: indexContent, found } =
      await gitOps.showIndexFile(targetRel);
    if (found) {
      content = indexContent;
      hasContent = true;
    } else {
      const diskAbs = path.resolve(repoRoot, targetRel);
      if (isPathWithinRoot(repoRoot, diskAbs) && fs.existsSync(diskAbs)) {
        try {
          content = fs.readFileSync(diskAbs, 'utf-8');
          hasContent = true;
        } catch {
          hasContent = false;
        }
      }
    }

    if (hasContent) {
      fs.writeFileSync(targetAbs, content, 'utf-8');
    }
  }

  return workspaceRoot;
}

function cleanupStagedWorkspaceSnapshot(workspaceRoot: string): void {
  const removalError = removePath(workspaceRoot);
  if (removalError) {
    console.error(
      '[Commit-Copilot] Failed to clean staged workspace snapshot:',
      removalError,
    );
    return;
  }

  const baseRoot = path.dirname(workspaceRoot);
  if (!fs.existsSync(baseRoot)) {
    return;
  }
  try {
    const entries = fs.readdirSync(baseRoot);
    if (entries.length === 0) {
      fs.rmdirSync(baseRoot);
    }
  } catch (err) {
    console.error(
      '[Commit-Copilot] Failed to clean staged workspace base directory:',
      err,
    );
  }
}

export {
  STAGED_WORKSPACE_DIR_NAME,
  STAGED_WORKSPACE_SUBDIR_NAME,
  isPathWithinRoot,
  toPosixPath,
  createStagedWorkspaceSnapshot,
  cleanupStagedWorkspaceSnapshot,
};
