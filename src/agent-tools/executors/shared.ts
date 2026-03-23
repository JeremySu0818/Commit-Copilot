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

export {
  MAX_FILE_LINES,
  MAX_OUTLINE_LINES,
  MAX_REFERENCE_SNIPPET_LENGTH,
  MAX_SEARCH_MATCHES_PER_FILE,
  MAX_SEARCH_FILES,
  MAX_SEARCH_LINE_LENGTH,
  MAX_SEARCH_WORKSPACE_FILES,
  BINARY_EXT,
  parseIntegerArg,
  parseBooleanArg,
  truncateSnippet,
};
