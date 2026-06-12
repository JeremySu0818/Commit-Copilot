import { LOCALIZED_PROMPTS } from '../../i18n/prompts/index';
import type {
  AgentToolPromptBundle,
  EffectiveDisplayLanguage,
  LocalePromptBundle,
} from '../../i18n/types';

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

export const FINAL_COMMIT_MESSAGE_TOOL_NAME = 'write_commit_message';

function buildAgentTools(
  bundle: LocalePromptBundle,
  descriptions: AgentToolPromptBundle,
): ToolDefinition[] {
  const toSchemaDescription = (value: string): string =>
    value.replace(/^-\s*`[^`]+`\s*[—-]\s*/, '').replace(/\{0\}/g, '');
  const finalCommitMessageTool: ToolDefinition = {
    name: FINAL_COMMIT_MESSAGE_TOOL_NAME,
    description: toSchemaDescription(bundle.toolDescWriteCommitMessage),
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: descriptions.messageArgument,
        },
      },
      required: ['message'],
    },
  };

  return [
    {
      name: 'get_diff',
      description: toSchemaDescription(bundle.toolDescGetDiff),
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: descriptions.pathArgument,
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'read_file',
      description: toSchemaDescription(bundle.toolDescReadFile),
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: descriptions.pathArgument,
          },
          startLine: {
            type: 'number',
            description: descriptions.startLineArgument,
          },
          endLine: {
            type: 'number',
            description: descriptions.endLineArgument,
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'get_file_outline',
      description: toSchemaDescription(bundle.toolDescGetFileOutline),
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: descriptions.pathArgument,
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'find_references',
      description: toSchemaDescription(bundle.toolDescFindReferences),
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: descriptions.pathArgument,
          },
          line: {
            type: 'number',
            description: descriptions.lineArgument,
          },
          character: {
            type: 'number',
            description: descriptions.characterArgument,
          },
          includeDeclaration: {
            type: 'boolean',
            description: descriptions.includeDeclarationArgument,
          },
        },
        required: ['path', 'line', 'character'],
      },
    },
    {
      name: 'get_recent_commits',
      description: toSchemaDescription(bundle.toolDescGetRecentCommits),
      parameters: {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            description: descriptions.countArgument,
          },
        },
        required: ['count'],
      },
    },
    {
      name: 'search_code',
      description: toSchemaDescription(bundle.toolDescSearchCode),
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: descriptions.queryArgument,
          },
          caseSensitive: {
            type: 'boolean',
            description: descriptions.caseSensitiveArgument,
          },
          maxResults: {
            type: 'number',
            description: descriptions.maxResultsArgument,
          },
        },
        required: ['query'],
      },
    },
    finalCommitMessageTool,
  ];
}

export function getAgentTools(
  language: EffectiveDisplayLanguage = 'en',
): ToolDefinition[] {
  const bundle = LOCALIZED_PROMPTS[language];
  return buildAgentTools(bundle, bundle.agentTools);
}

export const AGENT_TOOLS = getAgentTools();
export const FINAL_COMMIT_MESSAGE_TOOL =
  AGENT_TOOLS.find((tool) => tool.name === FINAL_COMMIT_MESSAGE_TOOL_NAME) ??
  AGENT_TOOLS[AGENT_TOOLS.length - 1];

function getAvailableTools(
  _isStaged: boolean,
  language: EffectiveDisplayLanguage,
): ToolDefinition[] {
  return getAgentTools(language);
}

export function toGeminiFunctionDeclarations(
  isStaged = false,
  language: EffectiveDisplayLanguage = 'en',
): object[] {
  return getAvailableTools(isStaged, language).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export function toOpenAITools(
  isStaged = false,
  language: EffectiveDisplayLanguage = 'en',
): object[] {
  return getAvailableTools(isStaged, language).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function toAnthropicTools(
  isStaged = false,
  language: EffectiveDisplayLanguage = 'en',
): object[] {
  return getAvailableTools(isStaged, language).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}
