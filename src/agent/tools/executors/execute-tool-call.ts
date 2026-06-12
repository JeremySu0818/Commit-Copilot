import type { GitOperations } from '../../../git/git-operations';
import { ToolCallRequest, ToolCallResult } from '../definitions';
import { getAgentToolRegistration } from '../registry';

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
    const registration = getAgentToolRegistration(toolCall.name);
    if (!registration) {
      return {
        name: toolCall.name,
        content: `Unknown tool: ${toolCall.name}`,
        error: true,
      };
    }

    const content = await registration.executor(toolCall, {
      repoRoot,
      diffContent,
      isStaged,
      gitOps,
    });
    return { name: toolCall.name, content };
  } catch (err: unknown) {
    return {
      name: toolCall.name,
      content: `Tool execution error: ${getErrorMessage(err)}`,
      error: true,
    };
  }
}
