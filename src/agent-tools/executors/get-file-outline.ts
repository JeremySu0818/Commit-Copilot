import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';

import { GitOperations } from '../../commit-copilot';
import { isPathWithinRoot } from '../staged-workspace';

import { MAX_OUTLINE_LINES } from './shared';

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

const LANGUAGE_ID_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.c': 'c',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.css': 'css',
  '.go': 'go',
  '.h': 'c',
  '.hpp': 'cpp',
  '.html': 'html',
  '.java': 'java',
  '.js': 'javascript',
  '.json': 'json',
  '.jsx': 'javascriptreact',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.md': 'markdown',
  '.mjs': 'javascript',
  '.php': 'php',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.scss': 'scss',
  '.sh': 'shellscript',
  '.sql': 'sql',
  '.swift': 'swift',
  '.toml': 'toml',
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.vue': 'vue',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

const LANGUAGE_ID_BY_FILENAME: Readonly<Record<string, string>> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
};

function labelForSymbol(kind: vscode.SymbolKind): string {
  return OUTLINE_KIND_LABELS[kind] ?? 'Symbol';
}

function formatOutlineLine(
  depth: number,
  line: number,
  label: string,
  name: string,
): string {
  const indent = '  '.repeat(depth);
  return `${indent}L${String(line)} [${label}] ${name}`;
}

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

async function resolveLanguageId(absPath: string): Promise<string | undefined> {
  if (fs.existsSync(absPath)) {
    const diskDoc = await vscode.workspace.openTextDocument(
      vscode.Uri.file(absPath),
    );
    return diskDoc.languageId;
  }

  try {
    const untitledUri = vscode.Uri.file(absPath).with({ scheme: 'untitled' });
    const untitledDoc = await vscode.workspace.openTextDocument(untitledUri);
    return untitledDoc.languageId;
  } catch (err) {
    void err;
  }

  const baseName = path.basename(absPath).toLowerCase();
  const byName = LANGUAGE_ID_BY_FILENAME[baseName];
  if (byName) {
    return byName;
  }

  const extension = path.extname(baseName).toLowerCase();
  return LANGUAGE_ID_BY_EXTENSION[extension];
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
    if (symbol.children.length > 0) {
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

async function executeGetFileOutline(
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

  try {
    let content: string;
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

    const lines = content.split(/\r?\n/);
    const outlineLines: string[] = [];

    outlineLines.push(`File: ${relPath} (${String(lines.length)} total lines)`);
    outlineLines.push('');

    let document: vscode.TextDocument;
    if (isStaged) {
      const languageId = await resolveLanguageId(absPath);
      document = await vscode.workspace.openTextDocument({
        content,
        language: languageId,
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
  } catch (err: unknown) {
    return `Error generating outline: ${getErrorMessage(err)}`;
  }
}

export { executeGetFileOutline };
