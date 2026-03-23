import * as path from 'path';
import * as vscode from 'vscode';
import { DEFAULT_IGNORED_DIRS, toPosixPath } from '../staged-workspace';
import {
  BINARY_EXT,
  MAX_SEARCH_FILES,
  MAX_SEARCH_LINE_LENGTH,
  MAX_SEARCH_MATCHES_PER_FILE,
  MAX_SEARCH_WORKSPACE_FILES,
  parseBooleanArg,
  parseIntegerArg,
} from './shared';

async function executeSearchCode(
  repoRoot: string,
  args: Record<string, unknown>,
): Promise<string> {
  const query = args.query as string | undefined;
  if (!query) {
    return "Error: 'query' is required. Provide a keyword or text pattern to search for.";
  }

  const caseSensitive = parseBooleanArg(args.caseSensitive) ?? false;
  const maxResults = parseIntegerArg(args.maxResults) ?? MAX_SEARCH_FILES;
  const effectiveMaxFiles = Math.min(Math.max(1, maxResults), 50);

  const excludePattern = `{${[...DEFAULT_IGNORED_DIRS].join(',')}}`;

  let files: vscode.Uri[];
  try {
    files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(repoRoot, '**/*'),
      new vscode.RelativePattern(repoRoot, `**/${excludePattern}/**`),
      MAX_SEARCH_WORKSPACE_FILES,
    );
  } catch (err: any) {
    return `Error searching files: ${err.message}`;
  }

  const searchQuery = caseSensitive ? query : query.toLowerCase();

  type FileMatch = {
    relPath: string;
    matches: { line: number; text: string }[];
  };

  const fileMatches: FileMatch[] = [];

  for (const fileUri of files) {
    if (fileMatches.length >= effectiveMaxFiles) break;

    const ext = path.extname(fileUri.fsPath).replace(/^\./, '').toLowerCase();
    if (BINARY_EXT.has(ext)) continue;

    const relPath = path.relative(repoRoot, fileUri.fsPath);
    if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath))
      continue;

    let content: string;
    try {
      const raw = await vscode.workspace.fs.readFile(fileUri);
      content = Buffer.from(raw).toString('utf-8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const matches: { line: number; text: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const target = caseSensitive ? lineText : lineText.toLowerCase();
      if (target.includes(searchQuery)) {
        const displayText =
          lineText.length > MAX_SEARCH_LINE_LENGTH
            ? `${lineText.slice(0, MAX_SEARCH_LINE_LENGTH)}...`
            : lineText;
        matches.push({ line: i + 1, text: displayText });
        if (matches.length >= MAX_SEARCH_MATCHES_PER_FILE) break;
      }
    }

    if (matches.length > 0) {
      fileMatches.push({ relPath: toPosixPath(relPath), matches });
    }
  }

  if (fileMatches.length === 0) {
    return `No matches found for "${query}" in the project.`;
  }

  const outputLines: string[] = [];
  let totalMatches = 0;
  for (const fm of fileMatches) {
    totalMatches += fm.matches.length;
  }

  outputLines.push(
    `Search results for "${query}" (case-${caseSensitive ? 'sensitive' : 'insensitive'}): ${totalMatches} match${totalMatches === 1 ? '' : 'es'} in ${fileMatches.length} file${fileMatches.length === 1 ? '' : 's'}`,
  );
  outputLines.push('');

  for (const fm of fileMatches) {
    outputLines.push(fm.relPath);
    for (const m of fm.matches) {
      outputLines.push(`  L${m.line}: ${m.text}`);
    }
    outputLines.push('');
  }

  if (fileMatches.length >= effectiveMaxFiles) {
    outputLines.push(`... (results capped at ${effectiveMaxFiles} files)`);
  }

  return outputLines.join('\n').trimEnd();
}

export { executeSearchCode };
