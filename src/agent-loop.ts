import {
  executeToolCall,
  buildInitialContext,
  toGeminiFunctionDeclarations,
  toOpenAITools,
  toAnthropicTools,
} from './agent-tools';
import { APIProvider, DEFAULT_MODELS, OLLAMA_DEFAULT_HOST } from './models';
import {
  APIKeyMissingError,
  APIKeyInvalidError,
  APIQuotaExceededError,
  APIRequestError,
  NoChangesError,
} from './errors';
import { ProgressCallback } from './llm-clients';
import { GitOperations } from './commit-copilot';

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
}): string {
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
  usageLines.push('- Combine multiple tools as needed for a thorough investigation.');

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

## Classification Rules (STRICT)
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
}

interface AgentLoopOptions {
  provider: APIProvider;
  apiKey: string;
  model?: string;
  diff: string;
  repoRoot: string;
  onProgress?: ProgressCallback;
  isStaged: boolean;
  gitOps: GitOperations;
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

export async function runAgentLoop(options: AgentLoopOptions): Promise<string> {
  const {
    provider,
    apiKey,
    model,
    diff,
    repoRoot,
    onProgress,
    isStaged,
    gitOps,
  } = options;

  switch (provider) {
    case 'google':
      return runGeminiAgentLoop(
        apiKey,
        model,
        diff,
        repoRoot,
        onProgress,
        isStaged,
        gitOps,
      );
    case 'openai':
      return runOpenAIAgentLoop(
        apiKey,
        model,
        diff,
        repoRoot,
        onProgress,
        isStaged,
        gitOps,
      );
    case 'anthropic':
      return runAnthropicAgentLoop(
        apiKey,
        model,
        diff,
        repoRoot,
        onProgress,
        isStaged,
        gitOps,
      );
    case 'ollama':
      return runOllamaAgentLoop(
        apiKey,
        model,
        diff,
        repoRoot,
        onProgress,
        isStaged,
        gitOps,
      );
    default:
      throw new Error(`Unsupported provider for agent loop: ${provider}`);
  }
}

async function runGeminiAgentLoop(
  apiKey: string,
  model: string | undefined,
  diff: string,
  repoRoot: string,
  onProgress?: ProgressCallback,
  isStaged: boolean = true,
  gitOps?: GitOperations,
): Promise<string> {
  if (!apiKey) {
    throw new APIKeyMissingError();
  }
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const client = new GoogleGenerativeAI(apiKey);
    const modelName = (model || DEFAULT_MODELS.google).replace(/^models\//, '');

    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
    });
    const generativeModel = client.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      tools: [
        {
          functionDeclarations: toGeminiFunctionDeclarations(isStaged) as any,
        },
      ],
    });

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
    );
    const chat = generativeModel.startChat({ history: [] });

    if (onProgress) {
      onProgress('Agent analyzing changes...');
    }

    let response = await chat.sendMessage(initialContext);
    let step = 0;

    while (step < MAX_AGENT_STEPS) {
      const candidate = response.response.candidates?.[0];
      if (!candidate) {
        throw new APIRequestError('Empty response from Gemini API');
      }

      const functionCalls = candidate.content?.parts?.filter(
        (p: any) => p.functionCall,
      );

      if (!functionCalls || functionCalls.length === 0) {
        const text = response.response.text();
        if (!text) {
          throw new APIRequestError('Empty text response from Gemini API');
        }
        return extractCommitMessage(text);
      }

      const toolResults: any[] = [];
      if (onProgress && functionCalls.length > 0) {
        const calls = functionCalls.map((p: any) => ({
          name: p.functionCall.name,
          args: p.functionCall.args || {},
        }));
        onProgress(formatBatchProgressMessage(step + 1, calls));
      }

      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        const result = await executeToolCall(
          { name: fc.name, arguments: fc.args || {} },
          repoRoot,
          diff,
          isStaged,
          gitOps,
        );

        toolResults.push({
          functionResponse: {
            name: fc.name,
            response: { content: result.content },
          },
        });
      }

      response = await chat.sendMessage(toolResults);
      step++;
    }

    const finalResponse = await chat.sendMessage(
      'You have used all available investigation steps. Output ONLY the final commit message now in type(scope): description format. Scope parentheses are MANDATORY. Do NOT include any explanation or analysis — just the commit message.',
    );
    const text = finalResponse.response.text();
    return text ? extractCommitMessage(text) : 'chore(project): update files';
  } catch (error: any) {
    if (
      error instanceof NoChangesError ||
      error instanceof APIKeyMissingError
    ) {
      throw error;
    }
    const message = error?.message || String(error);
    if (
      message.includes('API_KEY_INVALID') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      throw new APIKeyInvalidError(message);
    } else if (message.includes('429') || message.includes('quota')) {
      throw new APIQuotaExceededError(message);
    }
    throw new APIRequestError(message);
  }
}

async function runOpenAIAgentLoop(
  apiKey: string,
  model: string | undefined,
  diff: string,
  repoRoot: string,
  onProgress?: ProgressCallback,
  isStaged: boolean = true,
  gitOps?: GitOperations,
): Promise<string> {
  if (!apiKey) {
    throw new APIKeyMissingError();
  }
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey });
    const modelName = model || DEFAULT_MODELS.openai;

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
    );
    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
    });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: initialContext },
    ];

    if (onProgress) {
      onProgress('Agent analyzing changes...');
    }

    let step = 0;

    while (step < MAX_AGENT_STEPS) {
      const completion = await client.chat.completions.create({
        model: modelName,
        messages,
        tools: toOpenAITools(isStaged) as any,
        tool_choice: 'auto',
      });

      const choice = completion.choices[0];
      if (!choice) {
        throw new APIRequestError('Empty response from OpenAI API');
      }

      const assistantMessage = choice.message;
      messages.push(assistantMessage);

      if (
        choice.finish_reason === 'tool_calls' &&
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        if (onProgress) {
          const calls = assistantMessage.tool_calls.map((tc: any) => ({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || '{}'),
          }));
          onProgress(formatBatchProgressMessage(step + 1, calls));
        }

        for (const toolCall of assistantMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments || '{}');
          const result = await executeToolCall(
            { name: toolCall.function.name, arguments: args },
            repoRoot,
            diff,
            isStaged,
            gitOps,
          );

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.content,
          });
        }
        step++;
      } else {
        const text = assistantMessage.content;
        if (!text) {
          throw new APIRequestError('Empty text response from OpenAI API');
        }
        return extractCommitMessage(text);
      }
    }

    messages.push({
      role: 'user',
      content:
        'You have used all available investigation steps. Output ONLY the final commit message now in type(scope): description format. Scope parentheses are MANDATORY. Do NOT include any explanation or analysis — just the commit message.',
    });
    const finalCompletion = await client.chat.completions.create({
      model: modelName,
      messages,
    });
    const text = finalCompletion.choices[0]?.message?.content;
    return text ? extractCommitMessage(text) : 'chore(project): update files';
  } catch (error: any) {
    if (
      error instanceof NoChangesError ||
      error instanceof APIKeyMissingError
    ) {
      throw error;
    }
    const message = error?.message || String(error);
    const status = error?.status;
    if (
      status === 401 ||
      status === 403 ||
      message.includes('Invalid API Key')
    ) {
      throw new APIKeyInvalidError(message);
    } else if (status === 429 || message.includes('rate limit')) {
      throw new APIQuotaExceededError(message);
    }
    throw new APIRequestError(message);
  }
}

async function runAnthropicAgentLoop(
  apiKey: string,
  model: string | undefined,
  diff: string,
  repoRoot: string,
  onProgress?: ProgressCallback,
  isStaged: boolean = true,
  gitOps?: GitOperations,
): Promise<string> {
  if (!apiKey) {
    throw new APIKeyMissingError();
  }
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const modelName = model || DEFAULT_MODELS.anthropic;

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
    );
    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
    });

    const messages: any[] = [{ role: 'user', content: initialContext }];

    if (onProgress) {
      onProgress('Agent analyzing changes...');
    }

    let step = 0;

    while (step < MAX_AGENT_STEPS) {
      const response = await client.messages.create({
        model: modelName,
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools: toAnthropicTools(isStaged) as any,
      });

      const textBlocks = response.content.filter((b: any) => b.type === 'text');
      const toolUseBlocks = response.content.filter(
        (b: any) => b.type === 'tool_use',
      );

      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        const text = textBlocks.map((b: any) => b.text).join('');
        if (!text) {
          throw new APIRequestError('Empty response from Anthropic API');
        }
        return extractCommitMessage(text);
      }

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: any[] = [];
      if (onProgress && toolUseBlocks.length > 0) {
        const calls = toolUseBlocks.map((b: any) => ({
          name: b.name,
          args: b.input || {},
        }));
        onProgress(formatBatchProgressMessage(step + 1, calls));
      }

      for (const block of toolUseBlocks) {
        const toolUse = block as any;
        const result = await executeToolCall(
          { name: toolUse.name, arguments: toolUse.input || {} },
          repoRoot,
          diff,
          isStaged,
          gitOps,
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result.content,
        });
      }

      messages.push({ role: 'user', content: toolResults });
      step++;
    }

    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'You have used all available investigation steps. Output ONLY the final commit message now in type(scope): description format. Scope parentheses are MANDATORY. Do NOT include any explanation or analysis — just the commit message.',
        },
      ],
    });

    const finalResponse = await client.messages.create({
      model: modelName,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });
    const text = finalResponse.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
    return text ? extractCommitMessage(text) : 'chore(project): update files';
  } catch (error: any) {
    if (
      error instanceof NoChangesError ||
      error instanceof APIKeyMissingError
    ) {
      throw error;
    }
    const message = error?.message || String(error);
    const status = error?.status;
    if (
      status === 401 ||
      status === 403 ||
      message.includes('invalid_api_key')
    ) {
      throw new APIKeyInvalidError(message);
    } else if (status === 429 || message.includes('rate_limit')) {
      throw new APIQuotaExceededError(message);
    }
    throw new APIRequestError(message);
  }
}

async function runOllamaAgentLoop(
  host: string | undefined,
  model: string | undefined,
  diff: string,
  repoRoot: string,
  onProgress: ProgressCallback | undefined,
  isStaged: boolean,
  gitOps?: GitOperations,
): Promise<string> {
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  const resolvedHost = host || OLLAMA_DEFAULT_HOST;

  try {
    const { Ollama } = await import('ollama');
    const client = new Ollama({ host: resolvedHost });
    const modelName = model || DEFAULT_MODELS.ollama;

    const pullStream = await client.pull({ model: modelName, stream: true });
    let lastPercent = 0;
    for await (const part of pullStream) {
      if (part.total && part.completed) {
        const percent = Math.round((part.completed / part.total) * 100);
        if (percent > lastPercent) {
          const increment = percent - lastPercent;
          lastPercent = percent;
          if (onProgress) {
            onProgress(
              `Pulling ${modelName}: ${part.status} (${percent}%)`,
              increment,
            );
          }
        }
      } else if (part.status && onProgress) {
        onProgress(`Pulling ${modelName}: ${part.status}`);
      }
    }

    if (onProgress) {
      onProgress('Generating commit message...', 0);
    }

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
    );
    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
    });
    const enhancedPrompt = `${initialContext}\n\n## Full Diff (provided inline for local model)\n\n${diff}`;

    const response = await client.chat({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: enhancedPrompt },
      ],
      options: {
        temperature: 0.7,
        top_p: 0.95,
      },
    });

    const text = response.message?.content;
    if (!text) {
      throw new APIRequestError('Empty response from Ollama');
    }
    return extractCommitMessage(text);
  } catch (error: any) {
    if (error instanceof NoChangesError) {
      throw error;
    }
    const message = error?.message || String(error);
    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      throw new APIRequestError(
        `Cannot connect to Ollama. Make sure Ollama is running at ${resolvedHost}`,
      );
    } else if (message.includes('model') && message.includes('not found')) {
      throw new APIRequestError(
        `Model "${model || DEFAULT_MODELS.ollama}" not found. Please pull it first.`,
      );
    }
    throw new APIRequestError(message);
  }
}
