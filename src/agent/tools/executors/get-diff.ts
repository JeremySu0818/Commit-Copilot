function executeGetDiff(
  _repoRoot: string,
  args: Record<string, unknown>,
  diffContent: string,
): string {
  const aPathMatchIndex = 1;
  const bPathMatchIndex = 2;
  const renameSeparators = ['→', '->', '=>'];
  const filePath = args.path as string | undefined;

  if (!filePath) {
    return "Error: 'path' is required. Please specify a file path to get its diff. Use the file paths from the staged changes summary.";
  }

  const normalizePath = (value: string): string =>
    value
      .trim()
      .replace(/^[ab][\\/]/, '')
      .replace(/\\/g, '/');

  const expandPathInput = (value: string): string[] => {
    const trimmed = value.trim();
    if (!trimmed) return [];

    for (const separator of renameSeparators) {
      const separatorIndex = trimmed.indexOf(separator);
      if (separatorIndex < 0) {
        continue;
      }

      const left = normalizePath(trimmed.slice(0, separatorIndex));
      const right = normalizePath(
        trimmed.slice(separatorIndex + separator.length),
      );
      return [left, right].filter(Boolean);
    }

    return [normalizePath(trimmed)];
  };

  const requestedPaths = expandPathInput(filePath);
  if (requestedPaths.length === 0) {
    return "Error: 'path' is required. Please specify a file path to get its diff. Use the file paths from the staged changes summary.";
  }

  const requestedPathSet = new Set(requestedPaths);

  const lines = diffContent.split('\n');
  const fileBlocks: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (match) {
      const aPath = normalizePath(match[aPathMatchIndex]);
      const bPath = normalizePath(match[bPathMatchIndex]);
      capturing = requestedPathSet.has(aPath) || requestedPathSet.has(bPath);
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

export { executeGetDiff };
