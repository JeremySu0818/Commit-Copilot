import * as fs from 'fs';
import * as path from 'path';

import type { GitOperations } from '../../../git/git-operations';
import { isPathWithinRoot, isRealPathWithinRoot } from '../staged-workspace';

import { MAX_FILE_LINES, parseIntegerArg } from './shared';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function validateReadableDiskPath(
  repoRoot: string,
  absPath: string,
): string | null {
  if (!fs.existsSync(absPath)) {
    return 'missing';
  }
  if (!isRealPathWithinRoot(repoRoot, absPath)) {
    return 'unsafe';
  }
  return null;
}

function readDiskFileForTool(
  repoRoot: string,
  absPath: string,
  missingMessage: string,
): { content?: string; error?: string } {
  const diskPathError = validateReadableDiskPath(repoRoot, absPath);
  if (diskPathError === 'missing') {
    return { error: missingMessage };
  }
  if (diskPathError === 'unsafe') {
    return { error: 'Error: resolved file path escapes the workspace root.' };
  }
  return { content: fs.readFileSync(absPath, 'utf-8') };
}

async function readFileContentForTool(
  repoRoot: string,
  relPath: string,
  absPath: string,
  isStaged: boolean,
  gitOps?: GitOperations,
): Promise<{ content?: string; error?: string }> {
  if (!isStaged || !gitOps) {
    return readDiskFileForTool(
      repoRoot,
      absPath,
      `Error: file '${relPath}' does not exist.`,
    );
  }

  const { content: indexContent, found } = await gitOps.showIndexFile(relPath);
  if (found) {
    return { content: indexContent };
  }

  return readDiskFileForTool(
    repoRoot,
    absPath,
    `Error: file '${relPath}' does not exist in index or disk.`,
  );
}

async function executeReadFile(
  repoRoot: string,
  args: Record<string, unknown>,
  isStaged: boolean,
  gitOps?: GitOperations,
): Promise<string> {
  const relPath = asString(args.path);
  if (!relPath) {
    return "Error: 'path' is required.";
  }

  const absPath = path.resolve(repoRoot, relPath);

  if (!isPathWithinRoot(repoRoot, absPath)) {
    return 'Error: path traversal is not allowed.';
  }

  let content: string;
  try {
    const result = await readFileContentForTool(
      repoRoot,
      relPath,
      absPath,
      isStaged,
      gitOps,
    );
    if (result.error) {
      return result.error;
    }
    content = result.content ?? '';

    const lines = content.split('\n');

    const parsedStartLine = parseIntegerArg(args.startLine);
    const startLine = Math.max(1, parsedStartLine ?? 1);
    const parsedEndLine = parseIntegerArg(args.endLine);
    const endLine = Math.max(
      startLine,
      Math.min(lines.length, parsedEndLine ?? lines.length),
    );

    const selectedLines = lines.slice(startLine - 1, endLine);

    if (selectedLines.length > MAX_FILE_LINES) {
      const truncated = selectedLines.slice(0, MAX_FILE_LINES);
      return (
        `File: ${relPath} (lines ${String(startLine)}-${String(startLine + MAX_FILE_LINES - 1)} of ${String(lines.length)}, truncated)\n\n` +
        truncated
          .map((line, i) => `${String(startLine + i)}: ${line}`)
          .join('\n') +
        `\n\n... (${String(selectedLines.length - MAX_FILE_LINES)} more lines, use startLine/endLine to read them)`
      );
    }

    return (
      `File: ${relPath} (lines ${String(startLine)}-${String(endLine)} of ${String(lines.length)})\n\n` +
      selectedLines
        .map((line, i) => `${String(startLine + i)}: ${line}`)
        .join('\n')
    );
  } catch (err: unknown) {
    return `Error reading file: ${getErrorMessage(err)}`;
  }
}

export { executeReadFile };
