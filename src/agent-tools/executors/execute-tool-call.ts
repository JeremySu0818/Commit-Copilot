import { GitOperations } from '../../commit-copilot';
import { ToolCallRequest, ToolCallResult } from '../definitions';

import { executeFindReferences } from './find-references';
import { executeGetDiff } from './get-diff';
import { executeGetFileOutline } from './get-file-outline';
import { executeGetRecentCommits } from './get-recent-commits';
import { executeReadFile } from './read-file';
import { executeSearchCode } from './search-code';

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

export async function executeToolCall(
  toolCall: ToolCallRequest,
  repoRoot: string,
  diffContent: string,
  isStaged = true,
  gitOps?: GitOperations,
): Promise<ToolCallResult> {
  try {
    let content: string;

    switch (toolCall.name) {
      case 'get_diff':
        content = executeGetDiff(repoRoot, toolCall.arguments, diffContent);
        break;
      case 'read_file':
        content = await executeReadFile(
          repoRoot,
          toolCall.arguments,
          isStaged,
          gitOps,
        );
        break;
      case 'get_file_outline':
        content = await executeGetFileOutline(
          repoRoot,
          toolCall.arguments,
          isStaged,
          gitOps,
        );
        break;
      case 'find_references':
        content = await executeFindReferences(
          repoRoot,
          toolCall.arguments,
          isStaged,
          diffContent,
          gitOps,
        );
        break;
      case 'get_recent_commits':
        content = await executeGetRecentCommits(toolCall.arguments, gitOps);
        break;
      case 'search_code':
        content = await executeSearchCode(
          repoRoot,
          toolCall.arguments,
          gitOps,
          isStaged,
        );
        break;
      default:
        content = `Unknown tool: ${toolCall.name}`;
        return { name: toolCall.name, content, error: true };
    }

    return { name: toolCall.name, content };
  } catch (err: unknown) {
    return {
      name: toolCall.name,
      content: `Tool execution error: ${getErrorMessage(err)}`,
      error: true,
    };
  }
}
