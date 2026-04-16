import { LOCALES } from '../i18n/locales';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  normalizeCommitOutputOptions,
} from '../models';

const MAX_AGENT_STEPS = Infinity;

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

const CLASSIFICATION_RULES = `## Classification Rules (STRICT)
Apply these rules IN ORDER. The first matching rule wins:

| Condition | Type |
|-----------|------|
| Only adds/updates \`.md\`, \`.txt\`, JSDoc/docstrings, or documentation files | \`docs\` |
| Only adds/modifies test files (\`*.test.*\`, \`*.spec.*\`, \`__tests__/\`) | \`test\` |
| Only changes CI config (\`.github/workflows\`, \`.gitlab-ci.yml\`, Jenkinsfile) | \`ci\` |
| Only changes build config (\`webpack\`, \`esbuild\`, \`tsconfig\`, \`Dockerfile\`, \`Makefile\`) | \`build\` |
| Adds a new user-facing feature or capability | \`feat\` |
| Fixes a bug (corrects incorrect behavior) | \`fix\` |
| Improves performance without changing behavior | \`perf\` |
| Changes ONLY whitespace, formatting, semicolons, trailing commas (no logic change) | \`style\` |
| Restructures existing code logic WITHOUT changing external behavior | \`refactor\` |
| Everything else: deleting comments, removing dead code, removing console.log, updating dependencies, renaming without logic change, housekeeping | \`chore\` |

### Critical Distinctions
- **chore vs refactor**: If the ONLY change is removing comments, TODO notes, console.logs, unused imports, or deprecated dead code — this is \`chore\`, NOT \`refactor\`. \`refactor\` requires restructuring of actual program logic (e.g., extracting functions, reorganizing class hierarchy).
- **chore vs style**: Removing comments is \`chore\`. Reformatting existing code (indentation, bracket style) is \`style\`.
- **feat vs refactor**: If the change exposes new functionality to the user/API, it's \`feat\`. If it only reorganizes internals, it's \`refactor\`.`;

function buildScopeRule(options: CommitOutputOptions): string {
  if (options.includeScope) {
    return 'Scope is MANDATORY: first line MUST be `type(scope): description`. Never output `type: description` without scope.';
  }
  return 'Scope is FORBIDDEN: first line MUST be `type: description`. Do NOT include scope parentheses like `type(scope): ...`.';
}

function buildBodyAndFooterRule(options: CommitOutputOptions): string {
  if (options.includeBody && options.includeFooter) {
    return 'Body is MANDATORY and footer is MANDATORY. Format: subject line, blank line, body text, blank line, footer line(s).';
  }
  if (options.includeBody && !options.includeFooter) {
    return 'Body is MANDATORY. Add a blank line after the subject and write the body. Footer is FORBIDDEN.';
  }
  if (!options.includeBody && options.includeFooter) {
    return 'Body is FORBIDDEN and footer is MANDATORY. Format: subject line, blank line, then footer line(s).';
  }
  return 'Body and footer are both FORBIDDEN. Output exactly one subject line with no extra blank lines.';
}

function buildCommitLayout(options: CommitOutputOptions): string {
  if (options.includeScope && options.includeBody && options.includeFooter) {
    return `type(scope): description

Body explaining what changed and why.

Refs: #123`;
  }
  if (options.includeScope && options.includeBody && !options.includeFooter) {
    return `type(scope): description

Body explaining what changed and why.`;
  }
  if (options.includeScope && !options.includeBody && options.includeFooter) {
    return `type(scope): description

Refs: #123`;
  }
  if (options.includeScope && !options.includeBody && !options.includeFooter) {
    return 'type(scope): description';
  }
  if (!options.includeScope && options.includeBody && options.includeFooter) {
    return `type: description

Body explaining what changed and why.

Refs: #123`;
  }
  if (!options.includeScope && options.includeBody && !options.includeFooter) {
    return `type: description

Body explaining what changed and why.`;
  }
  if (!options.includeScope && !options.includeBody && options.includeFooter) {
    return `type: description

Refs: #123`;
  }
  return 'type: description';
}

function buildOutputFormatRules(options: CommitOutputOptions): string {
  const commitTypes = CONVENTIONAL_COMMIT_TYPES.map(
    (type) => `\`${type}\``,
  ).join(', ');
  const strictRules = [
    `First line MUST start with one of: ${commitTypes}.`,
    buildScopeRule(options),
    'First line max 72 characters, ideally under 50.',
    buildBodyAndFooterRule(options),
    'English only, no emojis.',
    'Do NOT wrap in markdown code blocks (no ```).',
  ];

  return `## Output Format (MANDATORY — ZERO TOLERANCE FOR VIOLATIONS)

### Strict Rules
${strictRules.map((rule, index) => `${String(index + 1)}. ${rule}`).join('\n')}

### Required Layout
${buildCommitLayout(options)}

### CRITICAL OUTPUT CONSTRAINT
**Your ENTIRE final text output MUST be the commit message and NOTHING ELSE.**
- Do NOT include any analysis, reasoning, investigation notes, summaries, or explanations.
- Do NOT include bullet points, numbered lists, or headers describing what you found.
- Do NOT precede the commit message with phrases like "Based on...", "Here is...", "The commit message is...", or any introductory text.
- Do NOT follow the commit message with any concluding remarks or justification.
- The FIRST character of your output must be the start of the commit type (e.g., \`f\` in \`feat\`, \`c\` in \`chore\`).
- The output must be PARSEABLE as a commit message directly — no surrounding text whatsoever.

VIOLATING THESE OUTPUT RULES IS A CRITICAL FAILURE.`;
}

function buildCommitOutputReminder(
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
): string {
  const options = normalizeCommitOutputOptions(commitOutputOptions);
  const subjectFormat = options.includeScope
    ? '`type(scope): description`'
    : '`type: description`';
  const scopeRule = options.includeScope
    ? 'Scope parentheses are MANDATORY.'
    : 'Scope parentheses are FORBIDDEN.';
  const bodyRule = options.includeBody
    ? 'A body section is MANDATORY.'
    : 'A body section is FORBIDDEN.';
  const footerRule = options.includeFooter
    ? 'At least one footer line is MANDATORY.'
    : 'Footer lines are FORBIDDEN.';

  return `When you are done, your ENTIRE text output must be ONLY the commit message. First-line format: ${subjectFormat}. ${scopeRule} ${bodyRule} ${footerRule} No analysis, no explanation, no commentary.`;
}

function buildFinalOutputReminder(
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
): string {
  return `You have used all available investigation steps. Output ONLY the final commit message now. ${buildCommitOutputReminder(
    commitOutputOptions,
  )}`;
}

function extractCommitMessage(raw: string): string {
  const trimmed = raw.trim();

  const typesPattern = CONVENTIONAL_COMMIT_TYPES.join('|');
  const commitRegex = new RegExp(
    `^(${typesPattern})(\\([^)]+\\))?(!)?:\\s*.+`,
    'm',
  );

  const firstLine = trimmed.split('\n')[0];
  if (commitRegex.test(firstLine)) {
    return trimmed;
  }

  const lines = trimmed.split('\n');
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

  const stripped = trimmed
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim();
  const strippedFirstLine = stripped.split('\n')[0];
  if (commitRegex.test(strippedFirstLine)) {
    return stripped;
  }

  return trimmed;
}

function buildAgentSystemPrompt(options: {
  includeFindReferences: boolean;
  enableTools?: boolean;
  commitOutputOptions?: CommitOutputOptions;
  maxAgentSteps?: number;
}): string {
  const commitOutputOptions = normalizeCommitOutputOptions(
    options.commitOutputOptions,
  );
  const maxAgentStepsLine =
    typeof options.maxAgentSteps === 'number' && options.maxAgentSteps > 0
      ? `You may use at most ${String(options.maxAgentSteps)} investigation steps. To use these steps efficiently, batch multiple tool calls in the same step whenever possible.`
      : '';
  const scopeWorkflowLine = commitOutputOptions.includeScope
    ? 'Determine the appropriate scope from the affected module/area.'
    : 'Do NOT choose a scope. The subject line must omit scope parentheses.';
  const outputRules = `${CLASSIFICATION_RULES}

${buildOutputFormatRules(commitOutputOptions)}`;

  if (options.enableTools === false) {
    return `You are a senior software engineer acting as an autonomous commit message agent.
You are given the full diff inline. You do NOT have access to any tools.
Base your decision solely on the provided diff and context.

## Required Workflow
1. Review the provided diff and context.
2. Classify the change type based on the Classification Rules below.
3. ${scopeWorkflowLine}
4. Output ONLY the commit message. Nothing else.

${outputRules}`;
  }

  const toolLines = [
    '- `get_diff` — Get the actual git diff for a specific file. You MUST provide the `path` argument.',
    '- `read_file` — Read the current contents of a file, optionally specifying a line range.',
    '- `get_file_outline` — Get the structural outline (functions, classes, exports) of a file.',
  ];
  if (options.includeFindReferences) {
    toolLines.push(
      '- `find_references` — Find all references for a symbol at a specific file position (LSP-based, syntax-aware).',
    );
  }
  toolLines.push(
    "- `get_recent_commits` — Fetch recent commit messages to learn the project's commit style.",
  );
  toolLines.push(
    '- `search_code` — Search for a keyword or pattern across the entire project (like grep). Useful for discovering hidden relationships not expressed through imports, such as environment variable references, string-based event names, config keys, or verifying consistency across modules.',
  );

  const usageLines = [
    '- Use `read_file` to understand context around changes.',
    "- Use `get_file_outline` to understand a file's role before reading its diff.",
  ];
  if (options.includeFindReferences) {
    usageLines.push(
      '- Use `find_references` to understand how a changed symbol is used across the workspace.',
    );
  }
  usageLines.push(
    "- Use `get_recent_commits` if you need to mirror the project's commit message conventions.",
  );
  usageLines.push(
    '- Use `search_code` to find hidden references to changed identifiers, environment variables, config keys, or string constants across the entire project.',
  );
  usageLines.push(
    '- Combine multiple tools as needed for a thorough investigation.',
  );

  const investigationTools = options.includeFindReferences
    ? '`get_diff`, `read_file`, `get_file_outline`, `find_references`, `search_code`'
    : '`get_diff`, `read_file`, `get_file_outline`, `search_code`';
  const workflowLines = [
    `1. Investigate the changes using your tools (${investigationTools} — use any combination).
   Prioritize the most important or ambiguous files. You do NOT need to inspect every file if the changes are clearly related.`,
    ...(maxAgentStepsLine ? [`2. ${maxAgentStepsLine}`] : []),
    `${maxAgentStepsLine ? '3' : '2'}. If necessary, check recent commit messages with \`get_recent_commits\` to match the project's writing style.`,
    `${maxAgentStepsLine ? '4' : '3'}. Classify the change type based on the Classification Rules below.`,
    `${maxAgentStepsLine ? '5' : '4'}. ${scopeWorkflowLine}`,
    `${maxAgentStepsLine ? '6' : '5'}. Output ONLY the commit message. Nothing else.`,
  ];

  return `You are a senior software engineer acting as an autonomous commit message agent.
You have access to tools that let you inspect the repository to make informed decisions.

## IMPORTANT: You receive LIMITED information initially
You are given ONLY the names of changed files, line counts, and the project structure.
You do NOT see the actual changes. You MUST use your tools to investigate before classifying.

## Available Tools
You have multiple tools at your disposal. Use whichever tools are needed for accurate investigation:
${toolLines.join('\n')}

You are NOT limited to \`get_diff\`. Choose the best tool(s) for the situation. For example:
${usageLines.join('\n')}

## Required Workflow
${workflowLines.join('\n')}

${outputRules}`;
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
    default:
      return msgs.stepCalling(step, toolName);
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
    return formatProgressMessage(
      step,
      toolCalls[0].name,
      toolCalls[0].args,
      language,
    );
  }

  const toolNames = Array.from(new Set(toolCalls.map((tc) => tc.name)));

  if (toolNames.length === 1) {
    const name = toolNames[0];
    const paths = toolCalls
      .map((toolCall) => normalizeToolArgs(toolCall.args).path)
      .filter((path): path is string => typeof path === 'string');

    if (name === 'get_diff') {
      if (paths.length <= 2)
        return msgs.stepAnalyzingMultipleDiffs(step, paths.join(', '));
      return msgs.stepAnalyzingDiffsForCount(step, paths.length);
    }
    if (name === 'read_file') {
      if (paths.length <= 2)
        return msgs.stepReadingMultipleFiles(step, paths.join(', '));
      return msgs.stepReadingFilesForCount(step, paths.length);
    }
    if (name === 'get_file_outline') {
      if (paths.length <= 2)
        return msgs.stepGettingMultipleOutlines(step, paths.join(', '));
      return msgs.stepGettingOutlinesForCount(step, paths.length);
    }
    if (name === 'find_references') {
      const targets = toolCalls
        .map((toolCall) => {
          const args = normalizeToolArgs(toolCall.args);
          const path = args.path;
          const line = args.line;
          const character = args.character;
          if (!path) return null;
          if (typeof line !== 'undefined' && typeof character !== 'undefined') {
            return `${path}:${String(line)}:${String(character)}`;
          }
          return path;
        })
        .filter((target): target is string => typeof target === 'string');
      if (targets.length <= 2) {
        return msgs.stepFindingReferencesForMultiple(step, targets.join(', '));
      }
      return msgs.stepFindingReferencesForCount(step, targets.length);
    }
    if (name === 'get_recent_commits') {
      const counts = toolCalls
        .map((toolCall) => normalizeToolArgs(toolCall.args).count)
        .filter((count): count is number => typeof count === 'number');
      if (counts.length === 1) {
        return msgs.stepFetchingRecentCommits(step, counts[0]);
      }
      return msgs.stepFetchingRecentCommits(step);
    }
    if (name === 'search_code') {
      const queries = toolCalls
        .map((toolCall) => normalizeToolArgs(toolCall.args).query)
        .filter((query): query is string => typeof query === 'string');
      if (queries.length <= 2) {
        return msgs.stepSearchingProjectForMultiple(step, queries.join(', '));
      }
      return msgs.stepSearchingProjectForCount(step, queries.length);
    }
  }

  return msgs.stepExecutingMultipleTools(step, toolCalls.length);
}

export {
  MAX_AGENT_STEPS,
  extractCommitMessage,
  buildAgentSystemPrompt,
  buildCommitOutputReminder,
  buildFinalOutputReminder,
  formatProgressMessage,
  formatBatchProgressMessage,
};
