import * as fs from 'fs';
import * as path from 'path';
import { GitOperations } from '../../commit-copilot';
import { isPathWithinRoot } from '../staged-workspace';
import { MAX_FILE_LINES, parseIntegerArg } from './shared';

async function executeReadFile(
  repoRoot: string,
  args: Record<string, unknown>,
  isStaged: boolean,
  gitOps?: GitOperations,
): Promise<string> {
  const relPath = args.path as string;
  if (!relPath) {
    return "Error: 'path' is required.";
  }

  const absPath = path.resolve(repoRoot, relPath);

  if (!isPathWithinRoot(repoRoot, absPath)) {
    return 'Error: path traversal is not allowed.';
  }

  let content: string;
  try {
    if (isStaged && gitOps) {
      const { content: indexContent, found } =
        await gitOps.showIndexFile(relPath);
      if (found) {
        content = indexContent;
      } else {
        if (!fs.existsSync(absPath)) {
          return `Error: file '${relPath}' does not exist in index or disk.`;
        }
        content = fs.readFileSync(absPath, 'utf-8');
      }
    } else {
      if (!fs.existsSync(absPath)) {
        return `Error: file '${relPath}' does not exist.`;
      }
      content = fs.readFileSync(absPath, 'utf-8');
    }

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
        `File: ${relPath} (lines ${startLine}-${startLine + MAX_FILE_LINES - 1} of ${lines.length}, truncated)\n\n` +
        truncated.map((line, i) => `${startLine + i}: ${line}`).join('\n') +
        `\n\n... (${selectedLines.length - MAX_FILE_LINES} more lines, use startLine/endLine to read them)`
      );
    }

    return (
      `File: ${relPath} (lines ${startLine}-${endLine} of ${lines.length})\n\n` +
      selectedLines.map((line, i) => `${startLine + i}: ${line}`).join('\n')
    );
  } catch (err: any) {
    return `Error reading file: ${err.message}`;
  }
}

export { executeReadFile };
