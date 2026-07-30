import {
  formatSelectedDiff,
  getRequestedDiffPaths,
  selectDiffFileBlocks,
} from '../diff-groups';

function executeGetDiff(
  _repoRoot: string,
  args: Record<string, unknown>,
  diffContent: string,
): string {
  const requestedPaths = getRequestedDiffPaths(args);
  if (requestedPaths.length === 0) {
    return "Error: 'path' is required unless a non-empty 'paths' array is provided. Use file paths from the staged changes summary.";
  }

  const blocks = selectDiffFileBlocks(diffContent, requestedPaths);
  if (blocks.length === 0) {
    if (typeof args.path === 'string' && !Array.isArray(args.paths)) {
      return `No diff found for file: ${args.path}`;
    }
    return `No diff found for requested path(s): ${requestedPaths.join(', ')}`;
  }

  return formatSelectedDiff(blocks, requestedPaths.length > 1);
}

export { executeGetDiff };
