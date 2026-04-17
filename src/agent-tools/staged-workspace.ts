import * as fs from 'fs';
import * as path from 'path';

import ignore from 'ignore';

import { GitOperations } from '../commit-copilot';

const STAGED_WORKSPACE_DIR_NAME = 'commit-copilot-temp';
const STAGED_WORKSPACE_SUBDIR_NAME = 'staged-workspace';

interface StagedDiffEntry {
  aPath: string;
  bPath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

function applyDiffLineStatus(entry: StagedDiffEntry, line: string): void {
  if (line.startsWith('new file mode') || line.startsWith('--- /dev/null')) {
    entry.status = 'added';
    return;
  }
  if (
    line.startsWith('deleted file mode') ||
    line.startsWith('+++ /dev/null')
  ) {
    entry.status = 'deleted';
    return;
  }
  if (line.startsWith('rename from') || line.startsWith('rename to')) {
    entry.status = 'renamed';
  }
}

function normalizeModifiedRenames(entries: StagedDiffEntry[]): void {
  for (const entry of entries) {
    if (entry.status === 'modified' && entry.aPath !== entry.bPath) {
      entry.status = 'renamed';
    }
  }
}

function parseStagedDiffEntries(diffContent: string): StagedDiffEntry[] {
  const aPathMatchIndex = 1;
  const bPathMatchIndex = 2;
  const entries: StagedDiffEntry[] = [];
  const lines = diffContent.split('\n');
  let current: StagedDiffEntry | null = null;

  for (const line of lines) {
    const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (match) {
      if (current) {
        entries.push(current);
      }
      current = {
        aPath: match[aPathMatchIndex],
        bPath: match[bPathMatchIndex],
        status: 'modified',
      };
      continue;
    }

    if (!current) continue;

    applyDiffLineStatus(current, line);
  }

  if (current) {
    entries.push(current);
  }

  normalizeModifiedRenames(entries);

  return entries;
}

interface RemovePathOptions {
  throwOnFailure?: boolean;
  operation?: string;
}

interface ErrorLike {
  message?: unknown;
  code?: unknown;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : String(value);
}

function removePath(
  targetPath: string,
  options?: RemovePathOptions,
): Error | null {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return null;
  } catch (err: unknown) {
    if (options?.throwOnFailure) {
      const error = err as ErrorLike;
      const message = toText(error.message ?? err);
      const code =
        typeof error.code === 'string' || typeof error.code === 'number'
          ? ` (${String(error.code)})`
          : '';
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
    copyTrackedFilesSnapshot(repoRoot, destRoot, trackedFiles);
    return;
  }

  const ignoreMatcher = createIgnoreMatcher(repoRoot);
  copyWorkspaceTree(repoRoot, destRoot, ignoreMatcher);
}

function copyTrackedFilesSnapshot(
  repoRoot: string,
  destRoot: string,
  trackedFiles: string[],
): void {
  for (const relPath of trackedFiles) {
    const nativePath = relPath.replace(/\//g, path.sep);
    const srcPath = path.join(repoRoot, nativePath);
    if (!fs.existsSync(srcPath)) {
      continue;
    }

    const destPath = path.join(destRoot, nativePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }
}

function createIgnoreMatcher(repoRoot: string): ReturnType<typeof ignore> {
  const matcher = ignore().add('.git');
  const gitignorePath = path.join(repoRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    matcher.add(fs.readFileSync(gitignorePath, 'utf-8'));
  }
  return matcher;
}

function listNonIgnoredEntries(
  srcPath: string,
  relDir: string,
  matcher: ReturnType<typeof ignore>,
): fs.Dirent[] {
  try {
    return fs.readdirSync(srcPath, { withFileTypes: true }).filter((entry) => {
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      return !matcher.ignores(relPath);
    });
  } catch {
    return [];
  }
}

function copyWorkspaceTree(
  repoRoot: string,
  destRoot: string,
  matcher: ReturnType<typeof ignore>,
): void {
  const stack: { src: string; dest: string; relDir: string }[] = [
    { src: repoRoot, dest: destRoot, relDir: '' },
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      break;
    }

    fs.mkdirSync(current.dest, { recursive: true });
    const entries = listNonIgnoredEntries(current.src, current.relDir, matcher);

    for (const entry of entries) {
      processWorkspaceEntry(entry, current, stack);
    }
  }
}

function processWorkspaceEntry(
  entry: fs.Dirent,
  current: { src: string; dest: string; relDir: string },
  stack: { src: string; dest: string; relDir: string }[],
): void {
  if (entry.isSymbolicLink()) {
    return;
  }

  const relPath = current.relDir
    ? `${current.relDir}/${entry.name}`
    : entry.name;
  const srcPath = path.join(current.src, entry.name);
  const destPath = path.join(current.dest, entry.name);

  if (entry.isDirectory()) {
    if (entry.name !== STAGED_WORKSPACE_DIR_NAME) {
      stack.push({ src: srcPath, dest: destPath, relDir: relPath });
    }
    return;
  }

  if (entry.isFile()) {
    fs.copyFileSync(srcPath, destPath);
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
    await applyStagedEntryToWorkspace(repoRoot, workspaceRoot, entry, gitOps);
  }

  return workspaceRoot;
}

function removeWorkspacePathIfWithin(
  workspaceRoot: string,
  targetPath: string,
): void {
  const resolved = path.resolve(workspaceRoot, targetPath);
  if (isPathWithinRoot(workspaceRoot, resolved)) {
    removePath(resolved);
  }
}

function resolveEntryTargetPath(entry: StagedDiffEntry): string | null {
  const target = entry.bPath === '/dev/null' ? entry.aPath : entry.bPath;
  if (!target || target === '/dev/null') {
    return null;
  }
  return target;
}

async function resolveEntryContent(
  repoRoot: string,
  targetRel: string,
  gitOps: GitOperations,
): Promise<string | null> {
  const { content, found } = await gitOps.showIndexFile(targetRel);
  if (found) {
    return content;
  }

  const diskAbs = path.resolve(repoRoot, targetRel);
  if (!isPathWithinRoot(repoRoot, diskAbs) || !fs.existsSync(diskAbs)) {
    return null;
  }

  try {
    return fs.readFileSync(diskAbs, 'utf-8');
  } catch {
    return null;
  }
}

async function applyStagedEntryToWorkspace(
  repoRoot: string,
  workspaceRoot: string,
  entry: StagedDiffEntry,
  gitOps: GitOperations,
): Promise<void> {
  if (entry.status === 'deleted') {
    removeWorkspacePathIfWithin(workspaceRoot, entry.aPath);
    return;
  }

  if (entry.status === 'renamed' && entry.aPath !== entry.bPath) {
    removeWorkspacePathIfWithin(workspaceRoot, entry.aPath);
  }

  const targetRel = resolveEntryTargetPath(entry);
  if (!targetRel) {
    return;
  }

  const targetAbs = path.resolve(workspaceRoot, targetRel);
  if (!isPathWithinRoot(workspaceRoot, targetAbs)) {
    return;
  }

  const content = await resolveEntryContent(repoRoot, targetRel, gitOps);
  if (content === null) {
    return;
  }

  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  fs.writeFileSync(targetAbs, content, 'utf-8');
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
