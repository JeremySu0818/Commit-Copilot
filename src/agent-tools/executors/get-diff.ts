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

export { executeGetDiff };
