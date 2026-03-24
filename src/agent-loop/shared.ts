const MAX_AGENT_STEPS = Infinity;

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

const CLASSIFICATION_AND_OUTPUT_RULES = `## Classification Rules (STRICT)
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
- **feat vs refactor**: If the change exposes new functionality to the user/API, it's \`feat\`. If it only reorganizes internals, it's \`refactor\`.

## Output Format (MANDATORY — ZERO TOLERANCE FOR VIOLATIONS)

### Strict Rules
1. **Scope parentheses are MANDATORY**: The format is \`type(scope): description\`. You MUST always include a scope in parentheses. Never output \`type: description\` without a scope.
   - The scope should describe the affected module, component, or area (e.g., \`auth\`, \`api\`, \`ui\`, \`config\`, \`deps\`, \`core\`).
   - For initial project setup or changes spanning the entire project, use \`project\` as the scope.
2. First line max 72 characters, ideally under 50.
3. **Commit body is MANDATORY**: You MUST provide a body separated by a blank line after the description. The body should explain *what* and *why* (not just *how*). Footer is optional.
4. English only, no emojis.
5. Do NOT wrap in markdown code blocks (no \`\`\`).  

### CRITICAL OUTPUT CONSTRAINT
**Your ENTIRE final text output MUST be the commit message and NOTHING ELSE.**
- Do NOT include any analysis, reasoning, investigation notes, summaries, or explanations.
- Do NOT include bullet points, numbered lists, or headers describing what you found.
- Do NOT precede the commit message with phrases like "Based on...", "Here is...", "The commit message is...", or any introductory text.
- Do NOT follow the commit message with any concluding remarks or justification.
- The FIRST character of your output must be the start of the commit type (e.g., \`f\` in \`feat\`, \`c\` in \`chore\`).
- The output must be PARSEABLE as a commit message directly — no surrounding text whatsoever.

### Examples of CORRECT output (entire response is just this):
feat(auth): add OAuth2 login flow with Google provider

Implemented the standard OAuth2 authorization code grant to allow
users to log in via their Google accounts. Stored session tokens
securely in HttpOnly cookies.

fix(api): resolve null pointer in user query handler

Added a null check for the user metadata object before attempting
to access the nested role property during database querying.

### Examples of WRONG output (NEVER do this):
"Based on my investigation..." followed by the commit message
"Here's the commit message:" followed by the commit message
Any text before or after the commit message
A commit message without scope parentheses like "feat: add login"

VIOLATING THESE OUTPUT RULES IS A CRITICAL FAILURE.`;

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
      return lines
        .slice(i)
        .map((l) => l.trimStart())
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
}): string {
  if (options.enableTools === false) {
    return `You are a senior software engineer acting as an autonomous commit message agent.
You are given the full diff inline. You do NOT have access to any tools.
Base your decision solely on the provided diff and context.

## Required Workflow
1. Review the provided diff and context.
2. Classify the change type based on the Classification Rules below.
3. Determine the appropriate scope from the affected module/area.
4. Output ONLY the commit message. Nothing else.

${CLASSIFICATION_AND_OUTPUT_RULES}`;
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
1. Investigate the changes using your tools (${investigationTools} — use any combination).
   Prioritize the most important or ambiguous files. You do NOT need to inspect every file if the changes are clearly related.
2. If necessary, check recent commit messages with \`get_recent_commits\` to match the project's writing style.
3. Classify the change type based on the Classification Rules below.
4. Determine the appropriate scope from the affected module/area.
5. Output ONLY the commit message. Nothing else.

${CLASSIFICATION_AND_OUTPUT_RULES}`;
}

function formatProgressMessage(
  step: number,
  toolName: string,
  args: any,
): string {
  const stepPrefix = `[Step ${step}] `;
  switch (toolName) {
    case 'get_diff':
      return `${stepPrefix}Analyzing diff: ${args.path || 'unknown file'}`;
    case 'read_file':
      return `${stepPrefix}Reading file: ${args.path || 'unknown file'}`;
    case 'get_file_outline':
      return `${stepPrefix}Getting outline: ${args.path || 'unknown file'}`;
    case 'find_references': {
      const line = args.line ?? 'unknown line';
      const character = args.character ?? 'unknown char';
      return `${stepPrefix}Finding references: ${args.path || 'unknown file'}:${line}:${character}`;
    }
    case 'get_recent_commits':
      return `${stepPrefix}Fetching recent commits: ${args.count || 'default'} entries`;
    case 'search_code':
      return `${stepPrefix}Searching project for: ${args.query || 'unknown keyword'}`;
    default:
      return `${stepPrefix}Calling ${toolName}...`;
  }
}

function formatBatchProgressMessage(
  step: number,
  toolCalls: { name: string; args: any }[],
): string {
  if (toolCalls.length === 0) return '';
  if (toolCalls.length === 1) {
    return formatProgressMessage(step, toolCalls[0].name, toolCalls[0].args);
  }

  const stepPrefix = `[Step ${step}] `;
  const toolNames = Array.from(new Set(toolCalls.map((tc) => tc.name)));

  if (toolNames.length === 1) {
    const name = toolNames[0];
    const paths = toolCalls.map((tc) => tc.args.path).filter(Boolean);

    if (name === 'get_diff') {
      if (paths.length <= 2)
        return `${stepPrefix}Analyzing diffs: ${paths.join(', ')}`;
      return `${stepPrefix}Analyzing diffs for ${paths.length} files...`;
    }
    if (name === 'read_file') {
      if (paths.length <= 2)
        return `${stepPrefix}Reading files: ${paths.join(', ')}`;
      return `${stepPrefix}Reading ${paths.length} files...`;
    }
    if (name === 'get_file_outline') {
      if (paths.length <= 2)
        return `${stepPrefix}Getting outlines: ${paths.join(', ')}`;
      return `${stepPrefix}Getting outlines for ${paths.length} files...`;
    }
    if (name === 'find_references') {
      const targets = toolCalls
        .map((tc) => {
          const path = tc.args.path;
          const line = tc.args.line;
          const character = tc.args.character;
          if (!path) return null;
          if (typeof line !== 'undefined' && typeof character !== 'undefined') {
            return `${path}:${line}:${character}`;
          }
          return path;
        })
        .filter(Boolean) as string[];
      if (targets.length <= 2) {
        return `${stepPrefix}Finding references: ${targets.join(', ')}`;
      }
      return `${stepPrefix}Finding references for ${targets.length} symbols...`;
    }
    if (name === 'get_recent_commits') {
      const counts = toolCalls
        .map((tc) => tc.args.count)
        .filter((count) => typeof count !== 'undefined');
      if (counts.length === 1) {
        return `${stepPrefix}Fetching recent commits: ${counts[0]} entries`;
      }
      return `${stepPrefix}Fetching recent commits...`;
    }
    if (name === 'search_code') {
      const queries = toolCalls
        .map((tc) => tc.args.query)
        .filter(Boolean) as string[];
      if (queries.length <= 2) {
        return `${stepPrefix}Searching project for: ${queries.join(', ')}`;
      }
      return `${stepPrefix}Searching project for ${queries.length} keywords...`;
    }
  }

  return `${stepPrefix}Executing ${toolCalls.length} investigation tools...`;
}

export {
  MAX_AGENT_STEPS,
  extractCommitMessage,
  buildAgentSystemPrompt,
  formatProgressMessage,
  formatBatchProgressMessage,
};
