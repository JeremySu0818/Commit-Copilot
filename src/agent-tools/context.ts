import * as fs from 'fs';
import * as path from 'path';
import { GitOperations } from '../commit-copilot';
import { DEFAULT_IGNORED_DIRS } from './staged-workspace';

export function parseDiffSummary(
  diff: string,
): { path: string; type: string; added: number; removed: number }[] {
  const files: {
    path: string;
    type: string;
    added: number;
    removed: number;
  }[] = [];
  const lines = diff.split('\n');

  let currentFile: {
    path: string;
    type: string;
    added: number;
    removed: number;
  } | null = null;
  let currentAPath = '';
  let currentBPath = '';

  for (const line of lines) {
    const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (diffMatch) {
      if (currentFile) {
        files.push(currentFile);
      }

      currentAPath = diffMatch[1];
      currentBPath = diffMatch[2];

      let type = 'modified';
      let filePath = currentBPath;
      if (currentAPath !== currentBPath) {
        type = 'renamed';
        filePath = `${currentAPath} → ${currentBPath}`;
      }

      currentFile = { path: filePath, type, added: 0, removed: 0 };
      continue;
    }

    if (!currentFile) continue;

    if (line.startsWith('new file mode') || line.startsWith('--- /dev/null')) {
      currentFile.type = 'added';
      currentFile.path = currentBPath;
      continue;
    }
    if (
      line.startsWith('deleted file mode') ||
      line.startsWith('+++ /dev/null')
    ) {
      currentFile.type = 'deleted';
      currentFile.path = currentAPath;
      continue;
    }
    if (line.startsWith('rename from') || line.startsWith('rename to')) {
      currentFile.type = 'renamed';
      currentFile.path = `${currentAPath} → ${currentBPath}`;
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentFile.added++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      currentFile.removed++;
    }
  }

  if (currentFile) {
    files.push(currentFile);
  }

  return files;
}

export function getProjectStructure(repoRoot: string): string {
  const MAX_FILES = Infinity;
  let fileCount = 0;

  function walk(dir: string, prefix: string = ''): string[] {
    const lines: string[] = [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return lines;
    }

    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < entries.length; i++) {
      if (fileCount >= MAX_FILES) {
        lines.push(`${prefix}... (truncated, ${MAX_FILES}+ files)`);
        break;
      }

      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        lines.push(`${prefix}${connector}${entry.name}/`);
        const childLines = walk(
          path.join(dir, entry.name),
          prefix + childPrefix,
        );
        lines.push(...childLines);
      } else {
        lines.push(`${prefix}${connector}${entry.name}`);
        fileCount++;
      }
    }

    return lines;
  }

  const treeLines = walk(repoRoot);
  return treeLines.join('\n');
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
  return `This repository has ${count} commit${count === 1 ? '' : 's'}.`;
}

export async function buildInitialContext(
  diff: string,
  repoRoot: string,
  gitOps?: GitOperations,
  isStaged: boolean = true,
  enableTools: boolean = true,
): Promise<string> {
  const fileSummary = parseDiffSummary(diff);
  const projectTree = getProjectStructure(repoRoot);
  const commitHistory = await formatCommitHistory(gitOps);

  const changedFilesSection = fileSummary
    .map(
      (f) =>
        `  [${f.type.toUpperCase()}] ${f.path}  (+${f.added} / -${f.removed} lines)`,
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

REMINDER: When you are done, your ENTIRE text output must be ONLY the commit message in \`type(scope): description\` format — scope parentheses are MANDATORY. No analysis, no explanation, no commentary.`;
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

REMINDER: When you are done investigating, your ENTIRE text output must be ONLY the commit message in \`type(scope): description\` format — scope parentheses are MANDATORY. No analysis, no explanation, no commentary.`;
}
