interface DiffFileBlock {
  aPath: string;
  bPath: string;
  displayPath: string;
  raw: string;
}

interface LiteralPart {
  kind: 'literal';
  value: string;
}

interface VariablePart {
  kind: 'variable';
  value: string;
}

type TemplatePart = LiteralPart | VariablePart;

interface AnalyzedDiffBlock {
  block: DiffFileBlock;
  parts: TemplatePart[];
  shape: string;
  variables: string[];
}

export interface DiffInvestigationGroup {
  representative: string;
  paths: string[];
}

export interface DiffInvestigationPlan {
  groups: DiffInvestigationGroup[];
  standalonePaths: string[];
}

const diffHeaderPattern = /^diff --git a\/(.+?) b\/(.+)$/;
const quotedDiffHeaderPattern =
  /^diff --git "a\/((?:\\.|[^"])*)" "b\/((?:\\.|[^"])*)"$/;
const aPathMatchIndex = 1;
const bPathMatchIndex = 2;
const minimumGroupSize = 2;
const gitOctalEscapeLength = 3;

function normalizePath(value: string): string {
  return value
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/^[ab][\\/]/, '')
    .replace(/\\/g, '/');
}

function displayPath(aPath: string, bPath: string): string {
  return aPath === bPath ? bPath : `${aPath} → ${bPath}`;
}

function decodeGitQuotedPath(value: string): string {
  const bytes: number[] = [];
  const escapedCharacters: Record<string, string> = {
    a: '\u0007',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\u000b',
    '"': '"',
    '\\': '\\',
  };

  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character !== '\\') {
      const codePoint = value.codePointAt(index);
      const decodedCharacter =
        codePoint === undefined ? character : String.fromCodePoint(codePoint);
      bytes.push(...Buffer.from(decodedCharacter));
      index += decodedCharacter.length - 1;
      continue;
    }

    const next = value[index + 1];
    const octal = value.slice(index + 1, index + 1 + gitOctalEscapeLength);
    if (/^[0-7]{3}$/.test(octal)) {
      bytes.push(Number.parseInt(octal, 8));
      index += gitOctalEscapeLength;
      continue;
    }
    if (next && next in escapedCharacters) {
      bytes.push(...Buffer.from(escapedCharacters[next]));
      index++;
      continue;
    }
    if (next) {
      bytes.push(...Buffer.from(next));
      index++;
    } else {
      bytes.push(...Buffer.from('\\'));
    }
  }

  return Buffer.from(bytes).toString('utf8');
}

function parseDiffHeader(
  line: string,
): { aPath: string; bPath: string } | null {
  const unquoted = diffHeaderPattern.exec(line);
  if (unquoted) {
    return {
      aPath: normalizePath(unquoted[aPathMatchIndex]),
      bPath: normalizePath(unquoted[bPathMatchIndex]),
    };
  }
  const quoted = quotedDiffHeaderPattern.exec(line);
  if (!quoted) {
    return null;
  }
  return {
    aPath: normalizePath(decodeGitQuotedPath(quoted[aPathMatchIndex])),
    bPath: normalizePath(decodeGitQuotedPath(quoted[bPathMatchIndex])),
  };
}

export function parseDiffFileBlocks(diffContent: string): DiffFileBlock[] {
  const lines = diffContent.split('\n');
  const blocks: DiffFileBlock[] = [];
  let currentLines: string[] = [];
  let currentAPath = '';
  let currentBPath = '';

  const flush = (): void => {
    if (currentLines.length === 0 || (!currentAPath && !currentBPath)) {
      currentLines = [];
      return;
    }
    blocks.push({
      aPath: currentAPath,
      bPath: currentBPath,
      displayPath: displayPath(currentAPath, currentBPath),
      raw: currentLines.join('\n'),
    });
    currentLines = [];
  };

  for (const line of lines) {
    const header = parseDiffHeader(line);
    if (header) {
      flush();
      currentAPath = header.aPath;
      currentBPath = header.bPath;
      currentLines.push(line);
      continue;
    }
    if (currentLines.length > 0) {
      currentLines.push(line);
    }
  }
  flush();

  return blocks;
}

function literal(value: string): LiteralPart {
  return { kind: 'literal', value };
}

function variable(value: string): VariablePart {
  return { kind: 'variable', value };
}

function generalizeDiffMetadataLine(
  line: string,
  block: DiffFileBlock,
): TemplatePart[] | null {
  if (line.startsWith('diff --git ')) {
    return [
      literal('diff --git a/'),
      variable(block.aPath),
      literal(' b/'),
      variable(block.bPath),
    ];
  }
  if (line === `--- a/${block.aPath}` || line === '--- /dev/null') {
    return line === '--- /dev/null'
      ? [literal(line)]
      : [literal('--- a/'), variable(block.aPath)];
  }
  if (line === `+++ b/${block.bPath}` || line === '+++ /dev/null') {
    return line === '+++ /dev/null'
      ? [literal(line)]
      : [literal('+++ b/'), variable(block.bPath)];
  }
  if (line === `rename from ${block.aPath}`) {
    return [literal('rename from '), variable(block.aPath)];
  }
  if (line === `rename to ${block.bPath}`) {
    return [literal('rename to '), variable(block.bPath)];
  }
  if (line === `copy from ${block.aPath}`) {
    return [literal('copy from '), variable(block.aPath)];
  }
  if (line === `copy to ${block.bPath}`) {
    return [literal('copy to '), variable(block.bPath)];
  }
  if (line.startsWith('index ')) {
    return [literal('index '), variable(line.slice('index '.length))];
  }
  return null;
}

function isQuote(character: string): boolean {
  return character === '"' || character === "'" || character === '`';
}

function readQuotedValue(line: string, start: number): number {
  const quote = line[start];
  let escaped = false;
  for (let index = start + 1; index < line.length; index++) {
    const character = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === quote) {
      return index + 1;
    }
  }
  return line.length;
}

function appendLiteral(parts: TemplatePart[], value: string): void {
  if (!value) return;
  const previous = parts[parts.length - 1] as TemplatePart | undefined;
  if (previous?.kind === 'literal') {
    previous.value += value;
    return;
  }
  parts.push(literal(value));
}

function generalizeRegularLine(line: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    const character = line[cursor];
    if (isQuote(character)) {
      const end = readQuotedValue(line, cursor);
      parts.push(variable(line.slice(cursor, end)));
      cursor = end;
      continue;
    }
    if (/\d/.test(character)) {
      let end = cursor + 1;
      while (end < line.length && /\d/.test(line[end])) {
        end++;
      }
      parts.push(variable(line.slice(cursor, end)));
      cursor = end;
      continue;
    }
    appendLiteral(parts, character);
    cursor++;
  }

  return parts;
}

function analyzeDiffBlock(block: DiffFileBlock): AnalyzedDiffBlock {
  const parts: TemplatePart[] = [];
  const rawLines = block.raw.split('\n');
  const changedLines = rawLines.filter(
    (line) =>
      ((line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---'))) &&
      !line.startsWith('diff --git '),
  );
  const structuralMetadataLines = rawLines.filter((line) =>
    /^(?:(?:new|deleted) file mode |(?:old|new) mode |(?:rename|copy) (?:from|to) |Binary files |GIT binary patch$)/.test(
      line,
    ),
  );
  const lines =
    changedLines.length > 0 || structuralMetadataLines.length > 0
      ? [...structuralMetadataLines, ...changedLines]
      : rawLines;

  lines.forEach((line, index) => {
    const lineParts =
      generalizeDiffMetadataLine(line, block) ?? generalizeRegularLine(line);
    parts.push(...lineParts);
    if (index < lines.length - 1) {
      appendLiteral(parts, '\n');
    }
  });

  const variables: string[] = [];
  const shapeParts: string[] = [];
  for (const part of parts) {
    if (part.kind === 'literal') {
      shapeParts.push(`L${String(part.value.length)}:${part.value}`);
    } else {
      shapeParts.push('V');
      variables.push(part.value);
    }
  }

  return {
    block,
    parts,
    shape: shapeParts.join('\u0000'),
    variables,
  };
}

function groupAnalyzedBlocks(
  blocks: DiffFileBlock[],
): Map<string, AnalyzedDiffBlock[]> {
  const grouped = new Map<string, AnalyzedDiffBlock[]>();
  for (const block of blocks) {
    const analyzed = analyzeDiffBlock(block);
    const group = grouped.get(analyzed.shape);
    if (group) {
      group.push(analyzed);
    } else {
      grouped.set(analyzed.shape, [analyzed]);
    }
  }
  return grouped;
}

export function buildDiffInvestigationPlan(
  diffContent: string,
): DiffInvestigationPlan {
  const grouped = groupAnalyzedBlocks(parseDiffFileBlocks(diffContent));
  const groups: DiffInvestigationGroup[] = [];
  const standalonePaths: string[] = [];

  for (const members of grouped.values()) {
    const paths = members.map(({ block }) => block.displayPath);
    if (members.length < minimumGroupSize) {
      standalonePaths.push(...paths);
      continue;
    }
    groups.push({
      representative: members[0].block.displayPath,
      paths,
    });
  }

  groups.sort((left, right) => right.paths.length - left.paths.length);
  standalonePaths.sort((left, right) => left.localeCompare(right));
  return { groups, standalonePaths };
}

function formatCompressedGroup(
  members: AnalyzedDiffBlock[],
  groupNumber: number,
): string | null {
  const first = members[0];
  if (
    members.some(
      (member) =>
        member.shape !== first.shape ||
        member.variables.length !== first.variables.length,
    )
  ) {
    return null;
  }

  const paths = members.map(({ block }) => block.displayPath);
  const exactPatchDigest = createHash('sha256')
    .update(
      members
        .map(({ block }) => `${block.displayPath}\u0000${block.raw}`)
        .join('\u0000'),
    )
    .digest('hex');
  const encoded = [
    `## Harness-verified structural diff group ${String(groupNumber)} (${String(paths.length)} files)`,
    `Files: ${paths.join(', ')}`,
    `Exact-patch set SHA-256: ${exactPatchDigest}`,
    'The harness inspected every exact patch in this group. Each has the same ordered changed-line structure after only file paths, quoted values, and numeric runs are treated as variable payload. Unchanged context is ignored for grouping. An extra, missing, reordered, or otherwise structured changed line cannot be covered by this group.',
    'Representative exact diff:',
    '```diff',
    first.block.raw,
    '```',
    'Other members differ only in the variable payload described above. Their payload is intentionally omitted to reduce input tokens; do not infer that the omitted values are semantically identical.',
  ].join('\n');
  const original = members.map(({ block }) => block.raw).join('\n');
  return encoded.length < original.length ? encoded : null;
}

function expandRequestedPath(value: string): string[] {
  const renameSeparators = ['→', '->', '=>'];
  const trimmed = value.trim();
  if (!trimmed) return [];

  for (const separator of renameSeparators) {
    const separatorIndex = trimmed.indexOf(separator);
    if (separatorIndex >= 0) {
      return [
        normalizePath(trimmed.slice(0, separatorIndex)),
        normalizePath(trimmed.slice(separatorIndex + separator.length)),
      ].filter(Boolean);
    }
  }
  return [normalizePath(trimmed)];
}

export function getRequestedDiffPaths(args: Record<string, unknown>): string[] {
  const values: string[] = [];
  if (typeof args.path === 'string') {
    values.push(args.path);
  }
  if (Array.isArray(args.paths)) {
    for (const value of args.paths) {
      if (typeof value === 'string') {
        values.push(value);
      }
    }
  }
  return [...new Set(values.flatMap(expandRequestedPath))];
}

export function selectDiffFileBlocks(
  diffContent: string,
  requestedPaths: string[],
): DiffFileBlock[] {
  const requested = new Set(requestedPaths.map(normalizePath));
  return parseDiffFileBlocks(diffContent).filter(
    ({ aPath, bPath }) => requested.has(aPath) || requested.has(bPath),
  );
}

export function formatSelectedDiff(
  blocks: DiffFileBlock[],
  preferCompression: boolean,
): string {
  if (!preferCompression || blocks.length < minimumGroupSize) {
    return blocks.map(({ raw }) => raw).join('\n');
  }

  const grouped = groupAnalyzedBlocks(blocks);
  const sections: string[] = [];
  let groupNumber = 1;
  for (const members of grouped.values()) {
    const compressed =
      members.length >= minimumGroupSize
        ? formatCompressedGroup(members, groupNumber)
        : null;
    if (compressed) {
      sections.push(compressed);
      groupNumber++;
    } else {
      sections.push(...members.map(({ block }) => block.raw));
    }
  }
  return sections.join('\n\n');
}

export type { DiffFileBlock };
import { createHash } from 'crypto';
