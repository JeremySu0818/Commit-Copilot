function executeGetDiff(
  _repoRoot: string,
  args: Record<string, unknown>,
  diffContent: string,
): string {
  const filePath = args.path as string | undefined;

  if (!filePath) {
    return "Error: 'path' is required. Please specify a file path to get its diff. Use the file paths from the staged changes summary.";
  }

  const normalizePath = (value: string): string =>
    value.trim().replace(/^[ab][\\/]/, '').replace(/\\/g, '/');

  const expandPathInput = (value: string): string[] => {
    const trimmed = value.trim();
    if (!trimmed) return [];
    const arrowSplit = trimmed.split(/\s*(?:→|->|=>)\s*/);
    if (arrowSplit.length >= 2) {
      return [
        normalizePath(arrowSplit[0]),
        normalizePath(arrowSplit[1]),
      ].filter(Boolean);
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
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (match) {
      const aPath = normalizePath(match[1]);
      const bPath = normalizePath(match[2]);
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
