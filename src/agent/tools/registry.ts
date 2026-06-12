import type { GitOperations } from '../../git/git-operations';
import type { EffectiveDisplayLanguage } from '../../i18n/types';

import {
  FINAL_COMMIT_MESSAGE_TOOL_NAME,
  ToolCallRequest,
  ToolCallResult,
  ToolDefinition,
  getAgentTools,
} from './definitions';
import { executeFindReferences } from './executors/find-references';
import { executeGetDiff } from './executors/get-diff';
import { executeGetFileOutline } from './executors/get-file-outline';
import { executeGetRecentCommits } from './executors/get-recent-commits';
import { executeReadFile } from './executors/read-file';
import { executeSearchCode } from './executors/search-code';

export interface AgentToolExecutionContext {
  repoRoot: string;
  diffContent: string;
  isStaged: boolean;
  gitOps?: GitOperations;
}

export interface AgentToolRegistration extends ToolDefinition {
  executor(
    request: ToolCallRequest,
    context: AgentToolExecutionContext,
  ): string | Promise<string>;
}

type AgentToolExecutor = AgentToolRegistration['executor'];

const executors: Record<string, AgentToolExecutor> = {
  get_diff: (request, context) =>
    executeGetDiff(context.repoRoot, request.arguments, context.diffContent),
  read_file: (request, context) =>
    executeReadFile(
      context.repoRoot,
      request.arguments,
      context.isStaged,
      context.gitOps,
    ),
  get_file_outline: (request, context) =>
    executeGetFileOutline(
      context.repoRoot,
      request.arguments,
      context.isStaged,
      context.gitOps,
    ),
  find_references: (request, context) =>
    executeFindReferences(
      context.repoRoot,
      request.arguments,
      context.isStaged,
      context.diffContent,
      context.gitOps,
    ),
  get_recent_commits: (request, context) =>
    executeGetRecentCommits(request.arguments, context.gitOps),
  search_code: (request, context) =>
    executeSearchCode(
      context.repoRoot,
      request.arguments,
      context.gitOps,
      context.isStaged,
    ),
  [FINAL_COMMIT_MESSAGE_TOOL_NAME]: () => 'Final commit message received.',
};

export function getRegisteredAgentTools(
  language: EffectiveDisplayLanguage = 'en',
): AgentToolRegistration[] {
  return getAgentTools(language).map((definition) => ({
    ...definition,
    executor: executors[definition.name],
  }));
}

export function getAgentToolRegistration(
  name: string,
  language: EffectiveDisplayLanguage = 'en',
): AgentToolRegistration | undefined {
  return getRegisteredAgentTools(language).find((tool) => tool.name === name);
}

export type { ToolCallResult };
