import * as path from 'path';

import * as vscode from 'vscode';

import { GitOperations } from '../../commit-copilot';
import { toPosixPath } from '../staged-workspace';

import {
  MAX_SEARCH_FILES,
  MAX_SEARCH_LINE_LENGTH,
  MAX_SEARCH_MATCHES_PER_FILE,
  isBinaryContent,
  parseBooleanArg,
  parseIntegerArg,
} from './shared';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

async function resolveSearchFiles(
  repoRoot: string,
  gitOps?: GitOperations,
): Promise<vscode.Uri[]> {
  const filesFromGitApi = await gitOps?.listFilesFromGitApi();
  if (filesFromGitApi !== null && filesFromGitApi !== undefined) {
    return filesFromGitApi
      .map((relPath) => relPath.trim())
      .filter(Boolean)
      .map((relPath) =>
        vscode.Uri.file(
          path.resolve(repoRoot, relPath.replace(/\//g, path.sep)),
        ),
      );
  }

  return vscode.workspace.findFiles(
    new vscode.RelativePattern(repoRoot, '**/*'),
    null,
  );
}

interface SearchLineMatch {
  line: number;
  text: string;
}

interface FileMatch {
  relPath: string;
  matches: SearchLineMatch[];
}

function isValidRelativePath(relPath: string): boolean {
  return (
    relPath.length > 0 && !relPath.startsWith('..') && !path.isAbsolute(relPath)
  );
}

async function loadSearchableContent(
  fileUri: vscode.Uri,
  relPath: string,
  isStaged: boolean,
  gitOps?: GitOperations,
): Promise<string | null> {
  try {
    if (isStaged && gitOps) {
      const { content: indexContent, found } =
        await gitOps.showIndexFile(relPath);
      if (!found) {
        return null;
      }
      if (await isBinaryContent(Buffer.from(indexContent))) {
        return null;
      }
      return indexContent;
    }

    const raw = await vscode.workspace.fs.readFile(fileUri);
    if (await isBinaryContent(raw)) {
      return null;
    }
    return Buffer.from(raw).toString('utf-8');
  } catch {
    return null;
  }
}

function collectSearchMatches(
  content: string,
  searchQuery: string,
  caseSensitive: boolean,
): SearchLineMatch[] {
  const lines = content.split(/\r?\n/);
  const matches: SearchLineMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    const target = caseSensitive ? lineText : lineText.toLowerCase();
    if (!target.includes(searchQuery)) {
      continue;
    }

    const displayText =
      lineText.length > MAX_SEARCH_LINE_LENGTH
        ? `${lineText.slice(0, MAX_SEARCH_LINE_LENGTH)}...`
        : lineText;
    matches.push({ line: i + 1, text: displayText });
    if (matches.length >= MAX_SEARCH_MATCHES_PER_FILE) {
      break;
    }
  }

  return matches;
}

async function collectFileMatches(params: {
  files: vscode.Uri[];
  repoRoot: string;
  effectiveMaxFiles: number;
  isStaged: boolean;
  gitOps?: GitOperations;
  searchQuery: string;
  caseSensitive: boolean;
}): Promise<FileMatch[]> {
  const fileMatches: FileMatch[] = [];
  for (const fileUri of params.files) {
    if (fileMatches.length >= params.effectiveMaxFiles) {
      break;
    }

    const relPath = path.relative(params.repoRoot, fileUri.fsPath);
    if (!isValidRelativePath(relPath)) {
      continue;
    }

    const content = await loadSearchableContent(
      fileUri,
      relPath,
      params.isStaged,
      params.gitOps,
    );
    if (!content) {
      continue;
    }

    const matches = collectSearchMatches(
      content,
      params.searchQuery,
      params.caseSensitive,
    );
    if (matches.length > 0) {
      fileMatches.push({ relPath: toPosixPath(relPath), matches });
    }
  }

  return fileMatches;
}

function formatSearchOutput(params: {
  query: string;
  caseSensitive: boolean;
  fileMatches: FileMatch[];
  effectiveMaxFiles: number;
}): string {
  const outputLines: string[] = [];
  const totalMatches = params.fileMatches.reduce(
    (total, fileMatch) => total + fileMatch.matches.length,
    0,
  );

  outputLines.push(
    `Search results for "${params.query}" (case-${params.caseSensitive ? 'sensitive' : 'insensitive'}): ${String(totalMatches)} match${totalMatches === 1 ? '' : 'es'} in ${String(params.fileMatches.length)} file${params.fileMatches.length === 1 ? '' : 's'}`,
  );
  outputLines.push('');

  for (const fileMatch of params.fileMatches) {
    outputLines.push(fileMatch.relPath);
    for (const match of fileMatch.matches) {
      outputLines.push(`  L${String(match.line)}: ${match.text}`);
    }
    outputLines.push('');
  }

  if (params.fileMatches.length >= params.effectiveMaxFiles) {
    outputLines.push(
      `... (results capped at ${String(params.effectiveMaxFiles)} files)`,
    );
  }

  return outputLines.join('\n').trimEnd();
}

async function executeSearchCode(
  repoRoot: string,
  args: Record<string, unknown>,
  gitOps?: GitOperations,
  isStaged = false,
): Promise<string> {
  const maxSearchFileCap = 50;
  const query = asString(args.query);
  if (!query) {
    return "Error: 'query' is required. Provide a keyword or text pattern to search for.";
  }

  const caseSensitive = parseBooleanArg(args.caseSensitive) ?? false;
  const maxResults = parseIntegerArg(args.maxResults) ?? MAX_SEARCH_FILES;
  const effectiveMaxFiles = Math.min(Math.max(1, maxResults), maxSearchFileCap);

  let files: vscode.Uri[];
  try {
    files = await resolveSearchFiles(repoRoot, gitOps);
  } catch (err: unknown) {
    return `Error searching files: ${getErrorMessage(err)}`;
  }

  const searchQuery = caseSensitive ? query : query.toLowerCase();
  const fileMatches = await collectFileMatches({
    files,
    repoRoot,
    effectiveMaxFiles,
    isStaged,
    gitOps,
    searchQuery,
    caseSensitive,
  });

  if (fileMatches.length === 0) {
    return `No matches found for "${query}" in the project.`;
  }

  return formatSearchOutput({
    query,
    caseSensitive,
    fileMatches,
    effectiveMaxFiles,
  });
}

export { executeSearchCode };
