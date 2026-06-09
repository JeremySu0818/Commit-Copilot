import { FINAL_COMMIT_MESSAGE_TOOL_NAME } from '../agent-tools/definitions';
import {
  buildAgentSystemPrompt,
  buildCommitOutputReminder,
  buildFinalOutputReminder,
  buildFinalToolRequiredReminder,
} from '../i18n/prompts';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import { LOCALES } from '../i18n/ui';
const MAX_AGENT_STEPS = Infinity;
const compactBatchSizeThreshold = 2;

type UnknownRecord = Record<string, unknown>;

interface ToolArgs {
  path?: string;
  line?: number;
  character?: number;
  count?: number;
  query?: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function normalizeToolArgs(args: unknown): ToolArgs {
  if (!isRecord(args)) {
    return {};
  }

  return {
    path: asString(args.path),
    line: asNumber(args.line),
    character: asNumber(args.character),
    count: asNumber(args.count),
    query: asString(args.query),
  };
}

const CONVENTIONAL_COMMIT_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

function extractCommitMessage(raw: string): string {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```[^\n]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
  const candidate = (unfenced.length > 0 ? unfenced : trimmed).replace(
    /\\n/g,
    '\n',
  );

  const typesPattern = CONVENTIONAL_COMMIT_TYPES.join('|');
  const commitRegex = new RegExp(
    `^(?:\\S+\\s+)?(${typesPattern})(\\([^)]+\\))?(!)?:\\s*.+`,
    'm',
  );

  const firstLine = candidate.split('\n')[0];
  if (commitRegex.test(firstLine)) {
    return candidate;
  }

  const lines = candidate.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (commitRegex.test(line)) {
      const indent = lines[i].length - lines[i].trimStart().length;
      return lines
        .slice(i)
        .map((l) => l.slice(Math.min(indent, l.length - l.trimStart().length)))
        .join('\n')
        .trim();
    }
  }

  return trimmed;
}

function extractFinalCommitMessageFromArgs(
  args: Record<string, unknown>,
): string | null {
  const message =
    asString(args.message) ??
    asString(args.commitMessage) ??
    asString(args.commit_message);
  if (!message || message.trim().length === 0) {
    return null;
  }
  return extractCommitMessage(message);
}

function formatProgressMessage(
  step: number,
  toolName: string,
  args: unknown,
  language: EffectiveDisplayLanguage = 'en',
): string {
  const normalizedArgs = normalizeToolArgs(args);
  const msgs = LOCALES[language].progressMessages;
  switch (toolName) {
    case 'get_diff':
      return msgs.stepAnalyzingDiff(
        step,
        normalizedArgs.path ?? 'unknown file',
      );
    case 'read_file':
      return msgs.stepReadingFile(step, normalizedArgs.path ?? 'unknown file');
    case 'get_file_outline':
      return msgs.stepGettingOutline(
        step,
        normalizedArgs.path ?? 'unknown file',
      );
    case 'find_references': {
      const line =
        typeof normalizedArgs.line === 'number'
          ? String(normalizedArgs.line)
          : 'unknown line';
      const character =
        typeof normalizedArgs.character === 'number'
          ? String(normalizedArgs.character)
          : 'unknown char';
      return msgs.stepFindingReferences(
        step,
        `${normalizedArgs.path ?? 'unknown file'}:${line}:${character}`,
      );
    }
    case 'get_recent_commits':
      return msgs.stepFetchingRecentCommits(step, normalizedArgs.count);
    case 'search_code':
      return msgs.stepSearchingProject(
        step,
        normalizedArgs.query ?? 'unknown keyword',
      );
    case 'write_commit_message':
      return msgs.stepWritingCommitMessage(step);
    default:
      return msgs.stepCalling(step, toolName);
  }
}

function getToolCallPaths(
  toolCalls: { name: string; args: unknown }[],
): string[] {
  return toolCalls
    .map((toolCall) => normalizeToolArgs(toolCall.args).path)
    .filter((path): path is string => typeof path === 'string');
}

function getReferenceTargets(
  toolCalls: { name: string; args: unknown }[],
): string[] {
  return toolCalls
    .map((toolCall) => {
      const args = normalizeToolArgs(toolCall.args);
      if (!args.path) {
        return null;
      }
      if (typeof args.line === 'number' && typeof args.character === 'number') {
        return `${args.path}:${String(args.line)}:${String(args.character)}`;
      }
      return args.path;
    })
    .filter((target): target is string => typeof target === 'string');
}

function getRecentCommitCounts(
  toolCalls: { name: string; args: unknown }[],
): number[] {
  return toolCalls
    .map((toolCall) => normalizeToolArgs(toolCall.args).count)
    .filter((count): count is number => typeof count === 'number');
}

function getSearchQueries(
  toolCalls: { name: string; args: unknown }[],
): string[] {
  return toolCalls
    .map((toolCall) => normalizeToolArgs(toolCall.args).query)
    .filter((query): query is string => typeof query === 'string');
}

function isCompactBatch(values: unknown[]): boolean {
  return values.length <= compactBatchSizeThreshold;
}

function formatToolNameList(
  toolCalls: { name: string; args: unknown }[],
): string {
  const uniqueToolNames = Array.from(new Set(toolCalls.map((tc) => tc.name)));
  return uniqueToolNames.join(', ');
}

function appendToolNamesSuffix(
  message: string,
  toolCalls: { name: string; args: unknown }[],
): string {
  const toolList = formatToolNameList(toolCalls);
  if (!toolList) {
    return message;
  }
  return `${message} [tools: ${toolList}]`;
}

function formatSingleToolBatchProgress(
  step: number,
  toolName: string,
  toolCalls: { name: string; args: unknown }[],
  msgs: typeof LOCALES.en.progressMessages,
): string | null {
  const paths = getToolCallPaths(toolCalls);

  switch (toolName) {
    case 'get_diff':
      return isCompactBatch(paths)
        ? msgs.stepAnalyzingMultipleDiffs(step, paths.join(', '))
        : msgs.stepAnalyzingDiffsForCount(step, paths.length);
    case 'read_file':
      return isCompactBatch(paths)
        ? msgs.stepReadingMultipleFiles(step, paths.join(', '))
        : msgs.stepReadingFilesForCount(step, paths.length);
    case 'get_file_outline':
      return isCompactBatch(paths)
        ? msgs.stepGettingMultipleOutlines(step, paths.join(', '))
        : msgs.stepGettingOutlinesForCount(step, paths.length);
    case 'find_references': {
      const targets = getReferenceTargets(toolCalls);
      return isCompactBatch(targets)
        ? msgs.stepFindingReferencesForMultiple(step, targets.join(', '))
        : msgs.stepFindingReferencesForCount(step, targets.length);
    }
    case 'get_recent_commits': {
      const counts = getRecentCommitCounts(toolCalls);
      return counts.length === 1
        ? msgs.stepFetchingRecentCommits(step, counts[0])
        : msgs.stepFetchingRecentCommits(step);
    }
    case 'search_code': {
      const queries = getSearchQueries(toolCalls);
      return isCompactBatch(queries)
        ? msgs.stepSearchingProjectForMultiple(step, queries.join(', '))
        : msgs.stepSearchingProjectForCount(step, queries.length);
    }
    default:
      return null;
  }
}

function formatBatchProgressMessage(
  step: number,
  toolCalls: { name: string; args: unknown }[],
  language: EffectiveDisplayLanguage = 'en',
): string {
  if (toolCalls.length === 0) return '';
  const msgs = LOCALES[language].progressMessages;

  if (toolCalls.length === 1) {
    return appendToolNamesSuffix(
      formatProgressMessage(
        step,
        toolCalls[0].name,
        toolCalls[0].args,
        language,
      ),
      toolCalls,
    );
  }

  const toolNames = Array.from(new Set(toolCalls.map((tc) => tc.name)));

  if (toolNames.length === 1) {
    const formatted = formatSingleToolBatchProgress(
      step,
      toolNames[0],
      toolCalls,
      msgs,
    );
    if (formatted) {
      return appendToolNamesSuffix(formatted, toolCalls);
    }
  }

  return appendToolNamesSuffix(
    msgs.stepExecutingMultipleTools(step, toolCalls.length),
    toolCalls,
  );
}

export {
  MAX_AGENT_STEPS,
  FINAL_COMMIT_MESSAGE_TOOL_NAME,
  extractCommitMessage,
  extractFinalCommitMessageFromArgs,
  buildFinalToolRequiredReminder,
  buildAgentSystemPrompt,
  buildCommitOutputReminder,
  buildFinalOutputReminder,
  formatProgressMessage,
  formatBatchProgressMessage,
};
