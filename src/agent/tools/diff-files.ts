export interface DiffFileBlock {
  aPath: string;
  bPath: string;
  displayPath: string;
  raw: string;
}

const diffHeaderPattern = /^diff --git a\/(.+?) b\/(.+)$/;
const quotedDiffHeaderPattern =
  /^diff --git "a\/((?:\\.|[^"])*)" "b\/((?:\\.|[^"])*)"$/;
const aPathMatchIndex = 1;
const bPathMatchIndex = 2;
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

export function formatSelectedDiff(blocks: DiffFileBlock[]): string {
  return blocks.map(({ raw }) => raw).join('\n');
}
