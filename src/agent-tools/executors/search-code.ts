import * as path from 'path';
import * as vscode from 'vscode';
import { GitOperations } from '../../commit-copilot';
import { toPosixPath } from '../staged-workspace';
import {
  MAX_SEARCH_FILES,
  MAX_SEARCH_FILE_SIZE_BYTES,
  MAX_SEARCH_LINE_LENGTH,
  MAX_SEARCH_MATCHES_PER_FILE,
  MAX_SEARCH_WORKSPACE_FILES,
  isBinaryContent,
  parseBooleanArg,
  parseIntegerArg,
} from './shared';

const KNOWN_BINARY_EXTENSIONS = new Set([
  '.7z',
  '.a',
  '.avif',
  '.bin',
  '.bmp',
  '.class',
  '.db',
  '.dll',
  '.dylib',
  '.eot',
  '.exe',
  '.flac',
  '.gif',
  '.gz',
  '.heic',
  '.ico',
  '.jar',
  '.jpeg',
  '.jpg',
  '.lockb',
  '.mkv',
  '.mov',
  '.mp3',
  '.mp4',
  '.o',
  '.obj',
  '.otf',
  '.pdf',
  '.png',
  '.pyc',
  '.rar',
  '.so',
  '.tar',
  '.ttf',
  '.war',
  '.wasm',
  '.wav',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
]);

function hasKnownBinaryExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return KNOWN_BINARY_EXTENSIONS.has(ext);
}

async function resolveSearchFiles(
  repoRoot: string,
  gitOps?: GitOperations,
): Promise<vscode.Uri[]> {
  const filesFromGitApi = await gitOps?.listFilesFromGitApi();
  if (filesFromGitApi !== null && filesFromGitApi !== undefined) {
    return filesFromGitApi
      .slice(0, MAX_SEARCH_WORKSPACE_FILES)
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
    MAX_SEARCH_WORKSPACE_FILES,
  );
}

async function executeSearchCode(
  repoRoot: string,
  args: Record<string, unknown>,
  gitOps?: GitOperations,
): Promise<string> {
  const query = args.query as string | undefined;
  if (!query) {
    return "Error: 'query' is required. Provide a keyword or text pattern to search for.";
  }

  const caseSensitive = parseBooleanArg(args.caseSensitive) ?? false;
  const maxResults = parseIntegerArg(args.maxResults) ?? MAX_SEARCH_FILES;
  const effectiveMaxFiles = Math.min(Math.max(1, maxResults), 50);

  let files: vscode.Uri[];
  try {
    files = await resolveSearchFiles(repoRoot, gitOps);
  } catch (err: any) {
    return `Error searching files: ${err.message}`;
  }

  const searchQuery = caseSensitive ? query : query.toLowerCase();

  type FileMatch = {
    relPath: string;
    matches: { line: number; text: string }[];
  };

  const fileMatches: FileMatch[] = [];
  const fsApi = vscode.workspace.fs as vscode.FileSystem & {
    stat?: (uri: vscode.Uri) => Promise<vscode.FileStat>;
  };

  for (const fileUri of files) {
    if (fileMatches.length >= effectiveMaxFiles) break;

    const relPath = path.relative(repoRoot, fileUri.fsPath);
    if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath))
      continue;
    if (hasKnownBinaryExtension(fileUri.fsPath)) continue;

    if (fsApi.stat) {
      try {
        const fileStat = await fsApi.stat(fileUri);
        if (fileStat.size > MAX_SEARCH_FILE_SIZE_BYTES) continue;
      } catch {
        continue;
      }
    }

    let raw: Uint8Array;
    let content: string;
    try {
      raw = await vscode.workspace.fs.readFile(fileUri);
      if (await isBinaryContent(raw)) continue;
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
