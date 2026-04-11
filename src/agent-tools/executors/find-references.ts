import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitOperations } from '../../commit-copilot';
import {
  STAGED_WORKSPACE_DIR_NAME,
  STAGED_WORKSPACE_SUBDIR_NAME,
  createStagedWorkspaceSnapshot,
  cleanupStagedWorkspaceSnapshot,
  isPathWithinRoot,
} from '../staged-workspace';
import {
  MAX_REFERENCE_SNIPPET_LENGTH,
  parseBooleanArg,
  parseIntegerArg,
  truncateSnippet,
} from './shared';

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

  try {
    const absPath = path.resolve(workspaceRoot, relPath);
    if (!isPathWithinRoot(workspaceRoot, absPath)) {
      return 'Error: path traversal is not allowed.';
    }
    if (!fs.existsSync(absPath)) {
      return `Error: file '${relPath}' does not exist on disk.`;
    }

    const includeDeclaration =
      parseBooleanArg(args.includeDeclaration) ?? false;

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

    interface ReferenceEntry {
      uri: vscode.Uri;
      range: vscode.Range;
    }

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

export { executeFindReferences };
