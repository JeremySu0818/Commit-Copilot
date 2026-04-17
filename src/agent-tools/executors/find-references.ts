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

interface ParsedReferenceRequest {
  relPath: string;
  line: number;
  character: number;
  includeDeclaration: boolean;
}

interface ParsedReferenceRequestResult {
  error?: string;
  request?: ParsedReferenceRequest;
}

interface PreparedWorkspace {
  workspaceRoot: string;
  stagedWorkspaceRoot: string | null;
  cleanupPath: string | null;
  error?: string;
}

interface ValidatedDocumentPosition {
  document: vscode.TextDocument;
  position: vscode.Position;
}

interface ReferenceEntry {
  uri: vscode.Uri;
  range: vscode.Range;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseReferenceRequest(
  args: Record<string, unknown>,
): ParsedReferenceRequestResult {
  const relPath = asString(args.path);
  if (!relPath) {
    return { error: "Error: 'path' is required." };
  }

  const line = parseIntegerArg(args.line);
  const character = parseIntegerArg(args.character);
  if (!line || line <= 0 || !character || character <= 0) {
    return {
      error:
        "Error: 'line' and 'character' are required and must be positive 1-based numbers.",
    };
  }

  return {
    request: {
      relPath,
      line,
      character,
      includeDeclaration: parseBooleanArg(args.includeDeclaration) ?? false,
    },
  };
}

async function prepareWorkspace(
  repoRoot: string,
  isStaged: boolean,
  diffContent: string,
  gitOps?: GitOperations,
): Promise<PreparedWorkspace> {
  const defaultResult: PreparedWorkspace = {
    workspaceRoot: repoRoot,
    stagedWorkspaceRoot: null,
    cleanupPath: null,
  };
  if (!isStaged) {
    return defaultResult;
  }

  const plannedStagedRoot = path.join(
    repoRoot,
    STAGED_WORKSPACE_DIR_NAME,
    STAGED_WORKSPACE_SUBDIR_NAME,
  );
  try {
    const stagedWorkspaceRoot = await createStagedWorkspaceSnapshot(
      repoRoot,
      diffContent,
      gitOps,
    );
    return {
      workspaceRoot: stagedWorkspaceRoot,
      stagedWorkspaceRoot,
      cleanupPath: null,
    };
  } catch (error: unknown) {
    cleanupStagedWorkspaceSnapshot(plannedStagedRoot);
    return {
      ...defaultResult,
      error: `Error preparing staged workspace for references: ${getErrorMessage(error)}`,
    };
  }
}

async function validateDocumentPosition(
  workspaceRoot: string,
  relPath: string,
  line: number,
  character: number,
): Promise<ValidatedDocumentPosition | string> {
  const absPath = path.resolve(workspaceRoot, relPath);
  if (!isPathWithinRoot(workspaceRoot, absPath)) {
    return 'Error: path traversal is not allowed.';
  }
  if (!fs.existsSync(absPath)) {
    return `Error: file '${relPath}' does not exist on disk.`;
  }

  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(absPath),
  );
  if (line > document.lineCount) {
    return `Error: line ${String(line)} is outside the valid range (1-${String(document.lineCount)}).`;
  }

  const lineText = document.lineAt(line - 1).text;
  if (character > lineText.length + 1) {
    return `Error: character ${String(character)} is outside the line length (${String(lineText.length + 1)}).`;
  }

  return {
    document,
    position: new vscode.Position(line - 1, character - 1),
  };
}

async function requestReferenceLocations(
  document: vscode.TextDocument,
  position: vscode.Position,
  includeDeclaration: boolean,
): Promise<(vscode.Location | vscode.LocationLink)[] | undefined> {
  try {
    return await vscode.commands.executeCommand<
      (vscode.Location | vscode.LocationLink)[] | undefined
    >('vscode.executeReferenceProvider', document.uri, position, {
      includeDeclaration,
    });
  } catch {
    return vscode.commands.executeCommand<
      (vscode.Location | vscode.LocationLink)[] | undefined
    >(
      'vscode.executeReferenceProvider',
      document.uri,
      position,
      includeDeclaration,
    );
  }
}

function isLocation(value: unknown): value is vscode.Location {
  return (
    typeof value === 'object' &&
    value !== null &&
    'uri' in value &&
    'range' in value
  );
}

function normalizeReferenceEntries(
  locations: (vscode.Location | vscode.LocationLink)[],
): ReferenceEntry[] {
  const entries: ReferenceEntry[] = [];
  const seen = new Set<string>();

  for (const location of locations) {
    const uri = isLocation(location) ? location.uri : location.targetUri;
    const range = isLocation(location) ? location.range : location.targetRange;
    const key = `${uri.toString()}#${String(range.start.line)}:${String(range.start.character)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push({ uri, range });
  }

  return entries;
}

function groupEntriesByFile(
  entries: ReferenceEntry[],
): Map<string, ReferenceEntry[]> {
  const grouped = new Map<string, ReferenceEntry[]>();
  for (const entry of entries) {
    const fileKey =
      entry.uri.scheme === 'file' ? entry.uri.fsPath : entry.uri.toString();
    const existing = grouped.get(fileKey);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(fileKey, [entry]);
    }
  }
  return grouped;
}

function isPathWithin(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function resolveDisplayPath(
  fileKey: string,
  repoRoot: string,
  stagedWorkspaceRoot: string | null,
): string {
  const isFilePath = path.isAbsolute(fileKey) || /^[a-zA-Z]:\\/.test(fileKey);
  if (!isFilePath) {
    return fileKey;
  }

  if (stagedWorkspaceRoot && isPathWithin(stagedWorkspaceRoot, fileKey)) {
    const relative = path.relative(stagedWorkspaceRoot, fileKey);
    return relative && !relative.startsWith('..') ? relative : fileKey;
  }

  if (isPathWithin(repoRoot, fileKey)) {
    const relative = path.relative(repoRoot, fileKey);
    return relative && !relative.startsWith('..') ? relative : fileKey;
  }

  return fileKey;
}

async function getCachedDocument(
  fileKey: string,
  cache: Map<string, vscode.TextDocument>,
): Promise<vscode.TextDocument | undefined> {
  const isFilePath = path.isAbsolute(fileKey) || /^[a-zA-Z]:\\/.test(fileKey);
  if (!isFilePath) {
    return undefined;
  }

  const cached = cache.get(fileKey);
  if (cached) {
    return cached;
  }

  try {
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(fileKey),
    );
    cache.set(fileKey, document);
    return document;
  } catch {
    return undefined;
  }
}

async function buildReferenceOutput(params: {
  relPath: string;
  line: number;
  character: number;
  includeDeclaration: boolean;
  entries: ReferenceEntry[];
  repoRoot: string;
  stagedWorkspaceRoot: string | null;
}): Promise<string> {
  const grouped = groupEntriesByFile(params.entries);
  const sortedFiles = Array.from(grouped.keys()).sort((a, b) =>
    a.localeCompare(b),
  );
  const outputLines: string[] = [];
  const totalRefs = params.entries.length;
  const totalFiles = sortedFiles.length;

  outputLines.push(
    `References for ${params.relPath}:${String(params.line)}:${String(params.character)} (includeDeclaration: ${String(params.includeDeclaration)})`,
  );
  outputLines.push(
    `Found ${String(totalRefs)} reference${totalRefs === 1 ? '' : 's'} in ${String(totalFiles)} file${totalFiles === 1 ? '' : 's'}.`,
  );
  outputLines.push('');

  const docCache = new Map<string, vscode.TextDocument>();
  for (const fileKey of sortedFiles) {
    const displayPath = resolveDisplayPath(
      fileKey,
      params.repoRoot,
      params.stagedWorkspaceRoot,
    );
    outputLines.push(displayPath);

    const fileEntries = grouped.get(fileKey) ?? [];
    fileEntries.sort((a, b) => {
      if (a.range.start.line !== b.range.start.line) {
        return a.range.start.line - b.range.start.line;
      }
      return a.range.start.character - b.range.start.character;
    });

    const document = await getCachedDocument(fileKey, docCache);
    for (const entry of fileEntries) {
      const refLine = entry.range.start.line + 1;
      const refChar = entry.range.start.character + 1;
      let snippet = '';
      if (document && refLine - 1 < document.lineCount) {
        const text = document.lineAt(refLine - 1).text;
        snippet = truncateSnippet(text, MAX_REFERENCE_SNIPPET_LENGTH);
      }
      const snippetSuffix = snippet ? `  ${snippet}` : '';
      outputLines.push(
        `  L${String(refLine)}:C${String(refChar)}${snippetSuffix}`,
      );
    }

    outputLines.push('');
  }

  return outputLines.join('\n').trimEnd();
}

async function executeFindReferences(
  repoRoot: string,
  args: Record<string, unknown>,
  isStaged: boolean,
  diffContent: string,
  gitOps?: GitOperations,
): Promise<string> {
  const parsedRequestResult = parseReferenceRequest(args);
  if (parsedRequestResult.error) {
    return parsedRequestResult.error;
  }
  if (!parsedRequestResult.request) {
    return 'Error: failed to parse reference request.';
  }
  const parsedRequest = parsedRequestResult.request;

  const prepared = await prepareWorkspace(
    repoRoot,
    isStaged,
    diffContent,
    gitOps,
  );
  if (prepared.error) {
    return prepared.error;
  }

  try {
    const validated = await validateDocumentPosition(
      prepared.workspaceRoot,
      parsedRequest.relPath,
      parsedRequest.line,
      parsedRequest.character,
    );
    if (typeof validated === 'string') {
      return validated;
    }

    const locations = await requestReferenceLocations(
      validated.document,
      validated.position,
      parsedRequest.includeDeclaration,
    );
    if (!locations) {
      return `No reference provider available for language "${validated.document.languageId}" or no references found for ${parsedRequest.relPath}:${String(parsedRequest.line)}:${String(parsedRequest.character)}.`;
    }
    if (locations.length === 0) {
      return `No references found for ${parsedRequest.relPath}:${String(parsedRequest.line)}:${String(parsedRequest.character)}.`;
    }

    const entries = normalizeReferenceEntries(locations);
    return await buildReferenceOutput({
      relPath: parsedRequest.relPath,
      line: parsedRequest.line,
      character: parsedRequest.character,
      includeDeclaration: parsedRequest.includeDeclaration,
      entries,
      repoRoot,
      stagedWorkspaceRoot: prepared.stagedWorkspaceRoot,
    });
  } catch (error: unknown) {
    return `Error finding references: ${getErrorMessage(error)}`;
  } finally {
    if (prepared.stagedWorkspaceRoot) {
      cleanupStagedWorkspaceSnapshot(prepared.stagedWorkspaceRoot);
    } else if (prepared.cleanupPath) {
      cleanupStagedWorkspaceSnapshot(prepared.cleanupPath);
    }
  }
}

export { executeFindReferences };
