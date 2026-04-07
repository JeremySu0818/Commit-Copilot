import { GitOperations } from '../../commit-copilot';
import { ToolCallRequest, ToolCallResult } from '../definitions';
import { executeGetDiff } from './get-diff';
import { executeReadFile } from './read-file';
import { executeGetFileOutline } from './get-file-outline';
import { executeFindReferences } from './find-references';
import { executeGetRecentCommits } from './get-recent-commits';
import { executeSearchCode } from './search-code';

export async function executeToolCall(
  toolCall: ToolCallRequest,
  repoRoot: string,
  diffContent: string,
  isStaged: boolean = true,
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
        content = await executeSearchCode(repoRoot, toolCall.arguments, gitOps);
        break;
      default:
        content = `Unknown tool: ${toolCall.name}`;
        return { name: toolCall.name, content, error: true };
    }

    return { name: toolCall.name, content };
  } catch (err: any) {
    return {
      name: toolCall.name,
      content: `Tool execution error: ${err.message}`,
      error: true,
    };
  }
}
