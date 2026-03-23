import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitOperations } from './commit-copilot';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  name: string;
  content: string;
  error?: boolean;
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_diff',
    description:
      'Get the actual git diff content for a specific file. You MUST specify the file path. Call this tool for each file you want to investigate. You MUST call this tool at least once to understand what was actually changed before making a classification decision.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            "Required. Relative path to the file from the repository root. Example: 'src/index.ts'",
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description:
      'Read the current contents of a file in the repository. Use this to understand the full context around changes — e.g., whether removed lines were comments, dead code, or functional logic. You can specify a line range to read a portion of the file.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            "Required. Relative path to the file from the repository root. Example: 'src/index.ts'",
        },
        startLine: {
          type: 'number',
          description:
            'Optional. 1-indexed start line to read from. If omitted, reads from the beginning.',
        },
        endLine: {
          type: 'number',
          description:
            'Optional. 1-indexed end line to read to (inclusive). If omitted, reads to the end.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_file_outline',
    description:
      'Get the structural outline of a file — its top-level functions, classes, exports, and imports. Use this to understand what role a file plays in the codebase without reading all its contents, which helps determine the appropriate commit type and scope.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            "Required. Relative path to the file from the repository root. Example: 'src/index.ts'",
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'find_references',
    description:
      'Find all references for a symbol at a specific file position using the VS Code Language Server (LSP). This is syntax-aware reference lookup, not a text search. Provide the file path plus 1-based line and character.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            "Required. Relative path to the file from the repository root. Example: 'src/index.ts'",
        },
        line: {
          type: 'number',
          description:
            'Required. 1-based line number of the symbol to analyze.',
        },
        character: {
          type: 'number',
          description:
            'Required. 1-based character (column) number of the symbol to analyze.',
        },
        includeDeclaration: {
          type: 'boolean',
          description:
            'Optional. Whether to include the symbol declaration itself in the results. Defaults to false.',
        },
      },
      required: ['path', 'line', 'character'],
    },
  },
  {
    name: 'get_recent_commits',
    description:
      'Get recent git commit messages to learn the repository commit style (e.g., scope naming, tense, use of emojis). Provide how many commit messages you want. Returns newest first.',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description:
            'Required. Number of recent commit messages to return. Use a positive integer (recommended 5-10). No maximum.',
        },
      },
      required: ['count'],
    },
  },
  {
    name: 'search_code',
    description:
      'Search for a keyword or pattern across the entire project (similar to grep/ripgrep). Use this to discover hidden relationships that are not expressed through imports — such as environment variable references (e.g. process.env.DB_URL), string-based event names, configuration keys in .env or config.yaml, or duplicated magic strings. Also useful for consistency checks (e.g. verifying an API endpoint path is updated everywhere).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Required. The keyword or text pattern to search for across the project.',
        },
        caseSensitive: {
          type: 'boolean',
          description:
            'Optional. Whether the search should be case-sensitive. Defaults to false.',
        },
        maxResults: {
          type: 'number',
          description:
            'Optional. Maximum number of matching files to return. Defaults to 20.',
        },
      },
      required: ['query'],
    },
  },
];

const STAGED_WORKSPACE_DIR_NAME = 'commit-copilot-temp';
const STAGED_WORKSPACE_SUBDIR_NAME = 'staged-workspace';
const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  '.cache',
  'coverage',
  '__pycache__',
  '.vscode',
  '.idea',
  STAGED_WORKSPACE_DIR_NAME,
]);

const MAX_FILE_LINES = Infinity;
const MAX_OUTLINE_LINES = Infinity;
const MAX_REFERENCE_SNIPPET_LENGTH = 200;
const MAX_SEARCH_MATCHES_PER_FILE = 10;
const MAX_SEARCH_FILES = 20;
const MAX_SEARCH_LINE_LENGTH = 200;
const MAX_SEARCH_WORKSPACE_FILES = 10000;
const BINARY_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'ico',
  'svg',
  'webp',
  'avif',
  'mp3',
  'mp4',
  'wav',
  'ogg',
  'webm',
  'avi',
  'mov',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'otf',
  'zip',
  'gz',
  'tar',
  'rar',
  '7z',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'vsix',
  'lock',
]);

function getAvailableTools(isStaged: boolean): ToolDefinition[] {
  void isStaged;
  return AGENT_TOOLS;
}

const OUTLINE_KIND_LABELS: Partial<Record<vscode.SymbolKind, string>> = {
  [vscode.SymbolKind.Class]: 'Class',
  [vscode.SymbolKind.Method]: 'Method',
  [vscode.SymbolKind.Function]: 'Function',
  [vscode.SymbolKind.Interface]: 'Interface',
  [vscode.SymbolKind.Enum]: 'Enum',
  [vscode.SymbolKind.Constructor]: 'Constructor',
  [vscode.SymbolKind.Property]: 'Property',
  [vscode.SymbolKind.Field]: 'Field',
  [vscode.SymbolKind.Module]: 'Module',
  [vscode.SymbolKind.Namespace]: 'Namespace',
  [vscode.SymbolKind.Package]: 'Package',
  [vscode.SymbolKind.Struct]: 'Struct',
  [vscode.SymbolKind.EnumMember]: 'EnumMember',
  [vscode.SymbolKind.Event]: 'Event',
  [vscode.SymbolKind.Variable]: 'Variable',
  [vscode.SymbolKind.Constant]: 'Constant',
};

function labelForSymbol(kind: vscode.SymbolKind): string {
  return OUTLINE_KIND_LABELS[kind] ?? 'Symbol';
}

function parseIntegerArg(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function parseBooleanArg(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    if (['true', '1', 'yes', 'y'].includes(trimmed)) return true;
    if (['false', '0', 'no', 'n'].includes(trimmed)) return false;
  }
  return null;
}

function truncateSnippet(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 3))}...`;
}

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

function copyWorkspaceSnapshot(repoRoot: string, destRoot: string): void {
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
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
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
  copyWorkspaceSnapshot(repoRoot, workspaceRoot);
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

function formatOutlineLine(
  depth: number,
  line: number,
  label: string,
  name: string,
): string {
  const indent = '  '.repeat(depth);
  return `${indent}L${line} [${label}] ${name}`;
}

function collectOutlineFromDocumentSymbols(
  symbols: vscode.DocumentSymbol[],
  lines: string[],
  depth: number,
  maxLines: number,
): boolean {
  for (const symbol of symbols) {
    const label = labelForSymbol(symbol.kind);
    const name = symbol.name.trim();
    lines.push(
      formatOutlineLine(depth, symbol.range.start.line + 1, label, name),
    );
    if (lines.length >= maxLines) {
      return false;
    }

    const nextDepth = depth + 1;
    if (symbol.children?.length) {
      const ok = collectOutlineFromDocumentSymbols(
        symbol.children,
        lines,
        nextDepth,
        maxLines,
      );
      if (!ok) {
        return false;
      }
    }
  }

  return true;
}

function collectOutlineFromSymbolInformation(
  symbols: vscode.SymbolInformation[],
  lines: string[],
  maxLines: number,
): void {
  const sorted = [...symbols].sort((a, b) => {
    if (a.location.range.start.line !== b.location.range.start.line) {
      return a.location.range.start.line - b.location.range.start.line;
    }
    return a.name.localeCompare(b.name);
  });

  for (const symbol of sorted) {
    const label = labelForSymbol(symbol.kind);
    const name = symbol.name.trim();
    lines.push(
      formatOutlineLine(0, symbol.location.range.start.line + 1, label, name),
    );
    if (lines.length >= maxLines) {
      lines.push('... (outline truncated)');
      return;
    }
  }
}

function executeGetDiff(
  _repoRoot: string,
  args: Record<string, unknown>,
  diffContent: string,
): string {
  const filePath = args.path as string | undefined;

  if (!filePath) {
    return "Error: 'path' is required. Please specify a file path to get its diff. Use the file paths from the staged changes summary.";
  }

  const lines = diffContent.split('\n');
  const fileBlocks: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (match) {
      const aPath = match[1];
      const bPath = match[2];
      capturing = aPath === filePath || bPath === filePath;
    }
    if (capturing) {
      fileBlocks.push(line);
    }
  }

  if (fileBlocks.length === 0) {
    return `No diff found for file: ${filePath}`;
  }

  return fileBlocks.join('\n');
}

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

    const startLine = Math.max(1, (args.startLine as number) || 1);
    const endLine = Math.min(
      lines.length,
      (args.endLine as number) || lines.length,
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

async function executeGetFileOutline(
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

  try {
    let content: string;
    if (isStaged && gitOps) {
      content = await gitOps.show(relPath);
      if (!content) {
        if (!fs.existsSync(absPath))
          return `Error: file '${relPath}' does not exist.`;
        content = fs.readFileSync(absPath, 'utf-8');
      }
    } else {
      if (!fs.existsSync(absPath)) {
        return `Error: file '${relPath}' does not exist.`;
      }
      content = fs.readFileSync(absPath, 'utf-8');
    }

    const lines = content.split(/\r?\n/);
    const outlineLines: string[] = [];

    outlineLines.push(`File: ${relPath} (${lines.length} total lines)`);
    outlineLines.push('');

    let document: vscode.TextDocument;
    if (isStaged) {
      document = await vscode.workspace.openTextDocument({
        content,
      });
    } else {
      document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(absPath),
      );
    }

    const symbolResult = await vscode.commands.executeCommand<
      vscode.DocumentSymbol[] | vscode.SymbolInformation[] | undefined
    >('vscode.executeDocumentSymbolProvider', document.uri);

    if (!symbolResult || symbolResult.length === 0) {
      outlineLines.push(
        `No document symbols available for language "${document.languageId}".`,
      );
      outlineLines.push('Consider using read_file for details.');
      return outlineLines.join('\n');
    }

    if (symbolResult[0] instanceof vscode.DocumentSymbol) {
      const completed = collectOutlineFromDocumentSymbols(
        symbolResult as vscode.DocumentSymbol[],
        outlineLines,
        0,
        MAX_OUTLINE_LINES,
      );
      if (!completed) {
        outlineLines.push('... (outline truncated)');
      }
    } else {
      collectOutlineFromSymbolInformation(
        symbolResult as vscode.SymbolInformation[],
        outlineLines,
        MAX_OUTLINE_LINES,
      );
    }

    return outlineLines.join('\n');
  } catch (err: any) {
    const message = err?.message || String(err);
    return `Error generating outline: ${message}`;
  }
}

async function executeFindReferences(
  repoRoot: string,
  args: Record<string, unknown>,
  isStaged: boolean,
  diffContent: string,
  gitOps?: GitOperations,
): Promise<string> {
  const relPath = args.path as string | undefined;
  if (!relPath) {
    return "Error: 'path' is required.";
  }

  const line = parseIntegerArg(args.line);
  const character = parseIntegerArg(args.character);
  if (!line || line <= 0 || !character || character <= 0) {
    return "Error: 'line' and 'character' are required and must be positive 1-based numbers.";
  }

  let workspaceRoot = repoRoot;
  let stagedWorkspaceRoot: string | null = null;
  let plannedStagedRoot: string | null = null;
  if (isStaged) {
    plannedStagedRoot = path.join(
      repoRoot,
      STAGED_WORKSPACE_DIR_NAME,
      STAGED_WORKSPACE_SUBDIR_NAME,
    );
    try {
      stagedWorkspaceRoot = await createStagedWorkspaceSnapshot(
        repoRoot,
        diffContent,
        gitOps,
      );
      workspaceRoot = stagedWorkspaceRoot;
    } catch (err: any) {
      const message = err?.message || String(err);
      if (plannedStagedRoot) {
        cleanupStagedWorkspaceSnapshot(plannedStagedRoot);
      }
      return `Error preparing staged workspace for references: ${message}`;
    }
  }

  const absPath = path.resolve(workspaceRoot, relPath);
  if (!isPathWithinRoot(workspaceRoot, absPath)) {
    return 'Error: path traversal is not allowed.';
  }
  if (!fs.existsSync(absPath)) {
    return `Error: file '${relPath}' does not exist on disk.`;
  }

  const includeDeclaration = parseBooleanArg(args.includeDeclaration) ?? false;

  try {
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(absPath),
    );

    if (line > document.lineCount) {
      return `Error: line ${line} is outside the valid range (1-${document.lineCount}).`;
    }

    const lineText = document.lineAt(line - 1).text;
    if (character > lineText.length + 1) {
      return `Error: character ${character} is outside the line length (${lineText.length + 1}).`;
    }

    const position = new vscode.Position(line - 1, character - 1);

    let locations: (vscode.Location | vscode.LocationLink)[] | undefined =
      undefined;
    try {
      locations = await vscode.commands.executeCommand<
        (vscode.Location | vscode.LocationLink)[] | undefined
      >('vscode.executeReferenceProvider', document.uri, position, {
        includeDeclaration,
      });
    } catch {
      locations = await vscode.commands.executeCommand<
        (vscode.Location | vscode.LocationLink)[] | undefined
      >(
        'vscode.executeReferenceProvider',
        document.uri,
        position,
        includeDeclaration,
      );
    }

    if (!locations) {
      return `No reference provider available for language "${document.languageId}" or no references found for ${relPath}:${line}:${character}.`;
    }
    if (locations.length === 0) {
      return `No references found for ${relPath}:${line}:${character}.`;
    }

    type ReferenceEntry = {
      uri: vscode.Uri;
      range: vscode.Range;
    };

    const entries: ReferenceEntry[] = [];
    const seen = new Set<string>();

    const isLocation = (loc: any): loc is vscode.Location =>
      !!loc && typeof loc === 'object' && 'uri' in loc && 'range' in loc;

    for (const loc of locations) {
      const uri = isLocation(loc) ? loc.uri : loc.targetUri;
      const range = isLocation(loc) ? loc.range : loc.targetRange;

      const key = `${uri.toString()}#${range.start.line}:${range.start.character}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ uri, range });
    }

    const byFile = new Map<string, ReferenceEntry[]>();
    for (const entry of entries) {
      const fileKey =
        entry.uri.scheme === 'file' ? entry.uri.fsPath : entry.uri.toString();
      const list = byFile.get(fileKey);
      if (list) {
        list.push(entry);
      } else {
        byFile.set(fileKey, [entry]);
      }
    }

    const sortedFiles = Array.from(byFile.keys()).sort((a, b) =>
      a.localeCompare(b),
    );
    const totalRefs = entries.length;
    const totalFiles = sortedFiles.length;

    const outputLines: string[] = [];
    outputLines.push(
      `References for ${relPath}:${line}:${character} (includeDeclaration: ${includeDeclaration})`,
    );
    outputLines.push(
      `Found ${totalRefs} reference${totalRefs === 1 ? '' : 's'} in ${totalFiles} file${totalFiles === 1 ? '' : 's'}.`,
    );
    outputLines.push('');

    const docCache = new Map<string, vscode.TextDocument>();

    const isPathWithin = (basePath: string, targetPath: string): boolean => {
      const relative = path.relative(basePath, targetPath);
      return (
        relative === '' ||
        (!relative.startsWith('..') && !path.isAbsolute(relative))
      );
    };

    const resolveDisplayPath = (fileKey: string): string => {
      const isFilePath =
        path.isAbsolute(fileKey) || /^[a-zA-Z]:\\/.test(fileKey);
      if (!isFilePath) return fileKey;

      if (stagedWorkspaceRoot && isPathWithin(stagedWorkspaceRoot, fileKey)) {
        const rel = path.relative(stagedWorkspaceRoot, fileKey);
        return rel && !rel.startsWith('..') ? rel : fileKey;
      }

      if (isPathWithin(repoRoot, fileKey)) {
        const rel = path.relative(repoRoot, fileKey);
        return rel && !rel.startsWith('..') ? rel : fileKey;
      }

      return fileKey;
    };

    for (const fileKey of sortedFiles) {
      const isFilePath =
        path.isAbsolute(fileKey) || /^[a-zA-Z]:\\/.test(fileKey);
      const displayPath = resolveDisplayPath(fileKey);
      outputLines.push(displayPath);

      const fileEntries = byFile.get(fileKey) ?? [];
      fileEntries.sort((a, b) => {
        if (a.range.start.line !== b.range.start.line) {
          return a.range.start.line - b.range.start.line;
        }
        return a.range.start.character - b.range.start.character;
      });

      let doc: vscode.TextDocument | undefined = undefined;
      if (isFilePath) {
        doc = docCache.get(fileKey);
        if (!doc) {
          try {
            doc = await vscode.workspace.openTextDocument(
              vscode.Uri.file(fileKey),
            );
            docCache.set(fileKey, doc);
          } catch {
            doc = undefined;
          }
        }
      }

      for (const entry of fileEntries) {
        const refLine = entry.range.start.line + 1;
        const refChar = entry.range.start.character + 1;
        let snippet = '';
        if (doc && refLine - 1 < doc.lineCount) {
          const text = doc.lineAt(refLine - 1).text;
          snippet = truncateSnippet(text, MAX_REFERENCE_SNIPPET_LENGTH);
        }
        const snippetSuffix = snippet ? `  ${snippet}` : '';
        outputLines.push(`  L${refLine}:C${refChar}${snippetSuffix}`);
      }

      outputLines.push('');
    }

    return outputLines.join('\n').trimEnd();
  } catch (err: any) {
    const message = err?.message || String(err);
    return `Error finding references: ${message}`;
  } finally {
    if (stagedWorkspaceRoot) {
      cleanupStagedWorkspaceSnapshot(stagedWorkspaceRoot);
    }
  }
}

function parseCommitCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return null;
}

async function executeGetRecentCommits(
  args: Record<string, unknown>,
  gitOps?: GitOperations,
): Promise<string> {
  if (!gitOps) {
    return 'Error: git operations are not available to retrieve commit history.';
  }

  const count = parseCommitCount(args.count);
  if (!count || count <= 0) {
    return "Error: 'count' is required and must be a positive integer.";
  }

  const messages = await gitOps.getRecentCommitMessages(count);
  if (messages.length === 0) {
    return 'No recent commits found.';
  }

  const lines: string[] = [
    `Recent commits (last ${messages.length}, newest first):`,
  ];

  messages.forEach((message, index) => {
    lines.push('');
    lines.push(`[${index + 1}]`);
    const msgLines = message.split(/\r?\n/);
    for (const line of msgLines) {
      lines.push(`  ${line}`);
    }
  });

  return lines.join('\n');
}

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
      MAX_SEARCH_WORKSPACE_FILES
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

export async function executeToolCall(
  toolCall: ToolCallRequest,
  repoRoot: string,
  diffContent: string,
  isStaged: boolean = true,
  gitOps?: GitOperations,
): Promise<ToolCallResult> {
  try {
    let content: string;

    switch (toolCall.name) {
      case 'get_diff':
        content = executeGetDiff(repoRoot, toolCall.arguments, diffContent);
        break;
      case 'read_file':
        content = await executeReadFile(
          repoRoot,
          toolCall.arguments,
          isStaged,
          gitOps,
        );
        break;
      case 'get_file_outline':
        content = await executeGetFileOutline(
          repoRoot,
          toolCall.arguments,
          isStaged,
          gitOps,
        );
        break;
      case 'find_references':
        content = await executeFindReferences(
          repoRoot,
          toolCall.arguments,
          isStaged,
          diffContent,
          gitOps,
        );
        break;
      case 'get_recent_commits':
        content = await executeGetRecentCommits(toolCall.arguments, gitOps);
        break;
      case 'search_code':
        content = await executeSearchCode(repoRoot, toolCall.arguments);
        break;
      default:
        content = `Unknown tool: ${toolCall.name}`;
        return { name: toolCall.name, content, error: true };
    }

    return { name: toolCall.name, content };
  } catch (err: any) {
    return {
      name: toolCall.name,
      content: `Tool execution error: ${err.message}`,
      error: true,
    };
  }
}

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

export function toGeminiFunctionDeclarations(
  isStaged: boolean = false,
): object[] {
  return getAvailableTools(isStaged).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export function toOpenAITools(isStaged: boolean = false): object[] {
  return getAvailableTools(isStaged).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function toAnthropicTools(isStaged: boolean = false): object[] {
  return getAvailableTools(isStaged).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}
