export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  name: string;
  content: string;
  error?: boolean;
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_diff',
    description:
      'Get the actual git diff content for a specific file. You MUST specify the file path. Call this tool for each file you want to investigate. You MUST call this tool at least once to understand what was actually changed before making a classification decision.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            "Required. Relative path to the file from the repository root. Example: 'src/index.ts'",
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description:
      'Read the current contents of a file in the repository. Use this to understand the full context around changes — e.g., whether removed lines were comments, dead code, or functional logic. You can specify a line range to read a portion of the file.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            "Required. Relative path to the file from the repository root. Example: 'src/index.ts'",
        },
        startLine: {
          type: 'number',
          description:
            'Optional. 1-indexed start line to read from. If omitted, reads from the beginning.',
        },
        endLine: {
          type: 'number',
          description:
            'Optional. 1-indexed end line to read to (inclusive). If omitted, reads to the end.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_file_outline',
    description:
      'Get the structural outline of a file — its top-level functions, classes, exports, and imports. Use this to understand what role a file plays in the codebase without reading all its contents, which helps determine the appropriate commit type and scope.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            "Required. Relative path to the file from the repository root. Example: 'src/index.ts'",
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'find_references',
    description:
      'Find all references for a symbol at a specific file position using the VS Code Language Server (LSP). This is syntax-aware reference lookup, not a text search. Provide the file path plus 1-based line and character.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            "Required. Relative path to the file from the repository root. Example: 'src/index.ts'",
        },
        line: {
          type: 'number',
          description:
            'Required. 1-based line number of the symbol to analyze.',
        },
        character: {
          type: 'number',
          description:
            'Required. 1-based character (column) number of the symbol to analyze.',
        },
        includeDeclaration: {
          type: 'boolean',
          description:
            'Optional. Whether to include the symbol declaration itself in the results. Defaults to false.',
        },
      },
      required: ['path', 'line', 'character'],
    },
  },
  {
    name: 'get_recent_commits',
    description:
      'Get recent git commit messages to learn the repository commit style (e.g., scope naming, tense, use of emojis). Provide how many commit messages you want. Returns newest first.',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description:
            'Required. Number of recent commit messages to return. Use a positive integer (recommended 5-10). No maximum.',
        },
      },
      required: ['count'],
    },
  },
  {
    name: 'search_code',
    description:
      'Search for a keyword or pattern across the entire project (similar to grep/ripgrep). Use this to discover hidden relationships that are not expressed through imports — such as environment variable references (e.g. process.env.DB_URL), string-based event names, configuration keys in .env or config.yaml, or duplicated magic strings. Also useful for consistency checks (e.g. verifying an API endpoint path is updated everywhere).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Required. The keyword or text pattern to search for across the project.',
        },
        caseSensitive: {
          type: 'boolean',
          description:
            'Optional. Whether the search should be case-sensitive. Defaults to false.',
        },
        maxResults: {
          type: 'number',
          description:
            'Optional. Maximum number of matching files to return. Defaults to 20.',
        },
      },
      required: ['query'],
    },
  },
];

function getAvailableTools(isStaged: boolean): ToolDefinition[] {
  void isStaged;
  return AGENT_TOOLS;
}

export function toGeminiFunctionDeclarations(
  isStaged: boolean = false,
): object[] {
  return getAvailableTools(isStaged).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export function toOpenAITools(isStaged: boolean = false): object[] {
  return getAvailableTools(isStaged).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function toAnthropicTools(isStaged: boolean = false): object[] {
  return getAvailableTools(isStaged).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}
