import * as fs from 'fs';
import * as path from 'path';

import ignore from 'ignore';

import { buildCommitOutputReminder } from '../agent-loop/shared';
import { GitOperations } from '../commit-copilot';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  normalizeCommitOutputOptions,
} from '../models';

interface DiffSummaryEntry {
  path: string;
  type: string;
  added: number;
  removed: number;
}

function createInitialDiffSummaryEntry(
  aPath: string,
  bPath: string,
  renamePathSeparator: string,
): DiffSummaryEntry {
  if (aPath !== bPath) {
    return {
      path: `${aPath}${renamePathSeparator}${bPath}`,
      type: 'renamed',
      added: 0,
      removed: 0,
    };
  }

  return {
    path: bPath,
    type: 'modified',
    added: 0,
    removed: 0,
  };
}

function updateDiffSummaryEntryType(
  line: string,
  entry: DiffSummaryEntry,
  currentAPath: string,
  currentBPath: string,
  renamePathSeparator: string,
): boolean {
  if (line.startsWith('new file mode') || line.startsWith('--- /dev/null')) {
    entry.type = 'added';
    entry.path = currentBPath;
    return true;
  }
  if (
    line.startsWith('deleted file mode') ||
    line.startsWith('+++ /dev/null')
  ) {
    entry.type = 'deleted';
    entry.path = currentAPath;
    return true;
  }
  if (line.startsWith('rename from') || line.startsWith('rename to')) {
    entry.type = 'renamed';
    entry.path = `${currentAPath}${renamePathSeparator}${currentBPath}`;
    return true;
  }
  if (line.startsWith('Binary files ') && line.endsWith(' differ')) {
    entry.added = Math.max(entry.added, 1);
    entry.removed = Math.max(entry.removed, 1);
    return true;
  }

  return false;
}

function updateDiffSummaryLineStats(
  line: string,
  entry: DiffSummaryEntry,
): void {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    entry.added += 1;
  } else if (line.startsWith('-') && !line.startsWith('---')) {
    entry.removed += 1;
  }
}

export function parseDiffSummary(
  diff: string,
): { path: string; type: string; added: number; removed: number }[] {
  const renamePathSeparator = ' → ';
  const aPathMatchIndex = 1;
  const bPathMatchIndex = 2;
  const files: DiffSummaryEntry[] = [];
  const lines = diff.split('\n');

  let currentFile: DiffSummaryEntry | null = null;
  let currentAPath = '';
  let currentBPath = '';

  for (const line of lines) {
    const diffMatch = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (diffMatch) {
      if (currentFile) {
        files.push(currentFile);
      }

      currentAPath = diffMatch[aPathMatchIndex];
      currentBPath = diffMatch[bPathMatchIndex];

      currentFile = createInitialDiffSummaryEntry(
        currentAPath,
        currentBPath,
        renamePathSeparator,
      );
      continue;
    }

    if (!currentFile) continue;

    if (
      updateDiffSummaryEntryType(
        line,
        currentFile,
        currentAPath,
        currentBPath,
        renamePathSeparator,
      )
    ) {
      continue;
    }

    updateDiffSummaryLineStats(line, currentFile);
  }

  if (currentFile) {
    files.push(currentFile);
  }

  return files;
}

export async function getProjectStructure(
  repoRoot: string,
  gitOps?: GitOperations,
): Promise<string> {
  const maxFiles = Infinity;

  interface TreeNode {
    dirs: Map<string, TreeNode>;
    files: Set<string>;
  }

  const buildTreeFromPaths = (paths: string[]): string[] => {
    const root: TreeNode = { dirs: new Map(), files: new Set() };

    const addFile = (relPath: string): void => {
      const normalized = relPath.trim().replace(/\\/g, '/');
      if (
        !normalized ||
        normalized.startsWith('../') ||
        path.isAbsolute(normalized)
      ) {
        return;
      }

      const parts = normalized.split('/').filter(Boolean);
      if (parts.length === 0) {
        return;
      }

      const fileName = parts[parts.length - 1];
      if (!fileName) {
        return;
      }

      let node = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const segment = parts[i];
        let next = node.dirs.get(segment);
        if (!next) {
          next = { dirs: new Map(), files: new Set() };
          node.dirs.set(segment, next);
        }
        node = next;
      }
      node.files.add(fileName);
    };

    for (const relPath of paths) {
      addFile(relPath);
    }

    let fileCount = 0;
    let didTruncate = false;

    const render = (node: TreeNode, prefix = ''): string[] => {
      const lines: string[] = [];
      const dirNames = [...node.dirs.keys()].sort((a, b) => a.localeCompare(b));
      const fileNames = [...node.files].sort((a, b) => a.localeCompare(b));
      const entries = [
        ...dirNames.map((name) => ({ name, isDir: true })),
        ...fileNames.map((name) => ({ name, isDir: false })),
      ];

      for (let i = 0; i < entries.length; i++) {
        if (fileCount >= maxFiles) {
          if (!didTruncate) {
            lines.push(`${prefix}... (truncated, ${String(maxFiles)}+ files)`);
            didTruncate = true;
          }
          break;
        }

        const entry = entries[i];
        const isLast = i === entries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';

        if (entry.isDir) {
          const childNode = node.dirs.get(entry.name);
          if (!childNode) {
            continue;
          }
          lines.push(`${prefix}${connector}${entry.name}/`);
          lines.push(...render(childNode, prefix + childPrefix));
          continue;
        }

        lines.push(`${prefix}${connector}${entry.name}`);
        fileCount++;
      }

      return lines;
    };

    return render(root);
  };

  const filesFromGitApi = await gitOps?.listFilesFromGitApi();
  if (filesFromGitApi !== null && filesFromGitApi !== undefined) {
    return buildTreeFromPaths(filesFromGitApi).join('\n');
  }

  const ig = ignore().add('.git');
  const gitignorePath = path.join(repoRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    ig.add(gitignoreContent);
  }

  let fileCount = 0;
  function walk(dir: string, prefix = '', relDir = ''): string[] {
    const lines: string[] = [];

    let allEntries: fs.Dirent[];
    try {
      allEntries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return lines;
    }

    const entries = allEntries.filter((entry) => {
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      return !ig.ignores(relPath);
    });

    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < entries.length; i++) {
      if (fileCount >= maxFiles) {
        lines.push(`${prefix}... (truncated, ${String(maxFiles)}+ files)`);
        break;
      }

      const entry = entries[i];
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      if (entry.isDirectory()) {
        lines.push(`${prefix}${connector}${entry.name}/`);
        const childLines = walk(
          path.join(dir, entry.name),
          prefix + childPrefix,
          relPath,
        );
        lines.push(...childLines);
      } else {
        lines.push(`${prefix}${connector}${entry.name}`);
        fileCount++;
      }
    }

    return lines;
  }

  return walk(repoRoot).join('\n');
}

async function formatCommitHistory(gitOps?: GitOperations): Promise<string> {
  if (!gitOps) {
    return 'Commit history could not be determined.';
  }
  const count = await gitOps.getCommitCount();
  if (count === null) {
    return 'Commit history could not be determined.';
  }
  if (count === 0) {
    return 'This repository has no commits yet.';
  }
  return `This repository has ${String(count)} commit${count === 1 ? '' : 's'}.`;
}

export async function buildInitialContext(
  diff: string,
  repoRoot: string,
  gitOps?: GitOperations,
  isStaged = true,
  enableTools = true,
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
): Promise<string> {
  const resolvedCommitOutputOptions =
    normalizeCommitOutputOptions(commitOutputOptions);
  const fileSummary = parseDiffSummary(diff);
  const projectTree = await getProjectStructure(repoRoot, gitOps);
  const commitHistory = await formatCommitHistory(gitOps);

  const changedFilesSection = fileSummary
    .map(
      (f) =>
        `  [${f.type.toUpperCase()}] ${f.path}  (+${String(f.added)} / -${String(f.removed)} lines)`,
    )
    .join('\n');

  if (!enableTools) {
    return `## ${isStaged ? 'Staged' : 'Unstaged'} Changes Summary

The following files have been modified in this commit:

${changedFilesSection}

## Project Structure (tracked files)

${projectTree}

## Commit History

${commitHistory}

---

You have been given the file names and line counts above. The full diff is provided below.
Base your classification on the provided diff and context. Do NOT guess the commit type based solely on file names.

REMINDER: ${buildCommitOutputReminder(resolvedCommitOutputOptions)}`;
  }

  const toolList =
    '`get_diff`, `read_file`, `get_file_outline`, `find_references`, and `search_code`';

  return `## ${isStaged ? 'Staged' : 'Unstaged'} Changes Summary

The following files have been modified in this commit:

${changedFilesSection}

## Project Structure (tracked files)

${projectTree}

## Commit History

${commitHistory}

---

You have ONLY been given the file names and line counts. You do NOT yet know what the actual changes are.
Use your tools to inspect the changes before classifying. You have ${toolList} — use whichever combination is most effective.
If you need to learn the project's commit style, you can call \`get_recent_commits\` to fetch recent commit messages.
Do NOT guess the commit type based solely on file names.

REMINDER: ${buildCommitOutputReminder(resolvedCommitOutputOptions)}`;
}
