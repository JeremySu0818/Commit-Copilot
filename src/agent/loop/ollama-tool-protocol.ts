import { LOCALIZED_PROMPTS } from '../../i18n/prompts/index';
import type { EffectiveDisplayLanguage } from '../../i18n/types';
import {
  FINAL_COMMIT_MESSAGE_TOOL_NAME,
  getAgentTools,
  ToolDefinition,
} from '../tools/definitions';

type UnknownRecord = Record<string, unknown>;

interface ParsedOllamaToolCall {
  index: number;
  name: string;
  arguments: Record<string, unknown>;
  error?: OllamaToolCallError;
}

type OllamaToolCallError =
  | 'invalid_call'
  | 'missing_name'
  | 'unknown_tool'
  | 'invalid_arguments';

type OllamaProtocolError =
  | 'multiple_envelopes'
  | 'text_outside_envelope'
  | 'invalid_json'
  | 'invalid_payload'
  | 'empty_calls';

type OllamaToolCallParseResult =
  | { kind: 'calls'; calls: ParsedOllamaToolCall[] }
  | { kind: 'text'; text: string }
  | { kind: 'malformed'; error: OllamaProtocolError };

interface OllamaToolResult {
  id: string;
  name: string;
  success: boolean;
  content: string;
}

const toolCallsOpenTag = '<tool_calls>';
const toolCallsCloseTag = '</tool_calls>';
const toolCallsPattern = /<tool_calls>([\s\S]*?)<\/tool_calls>/g;
const codeFenceMarkerLength = 3;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripOuterCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('```') || !trimmed.endsWith('```')) {
    return trimmed;
  }
  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline < 0) {
    return trimmed;
  }
  const fenceLabel = trimmed
    .slice(codeFenceMarkerLength, firstNewline)
    .trim()
    .toLowerCase();
  if (fenceLabel !== '' && fenceLabel !== 'json' && fenceLabel !== 'text') {
    return trimmed;
  }
  return trimmed.slice(firstNewline + 1, -codeFenceMarkerLength).trim();
}

function formatToolDefinition(tool: ToolDefinition): string {
  return JSON.stringify({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  });
}

function buildOllamaToolProtocolPrompt(
  language: EffectiveDisplayLanguage = 'en',
): string {
  const bundle = LOCALIZED_PROMPTS[language];
  const tools = getAgentTools(language);
  return `${bundle.ollamaProtocol.instructions}

${toolCallsOpenTag}
{"calls":[{"name":"get_diff","arguments":{"path":"src/a.ts"}},{"name":"read_file","arguments":{"path":"src/b.ts","startLine":1,"endLine":80}}]}
${toolCallsCloseTag}

${toolCallsOpenTag}
{"calls":[{"name":"${FINAL_COMMIT_MESSAGE_TOOL_NAME}","arguments":{"message":"feat(agent): add Ollama tool protocol"}}]}
${toolCallsCloseTag}

${bundle.availableToolsTitle}
${tools.map(formatToolDefinition).join('\n')}`;
}

function normalizeCall(
  value: unknown,
  index: number,
  availableToolNames: ReadonlySet<string>,
): ParsedOllamaToolCall {
  if (!isRecord(value)) {
    return {
      index,
      name: 'invalid_call',
      arguments: {},
      error: 'invalid_call',
    };
  }

  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const args = isRecord(value.arguments) ? value.arguments : {};
  if (!name) {
    return {
      index,
      name: 'invalid_call',
      arguments: args,
      error: 'missing_name',
    };
  }
  if (!isRecord(value.arguments)) {
    return {
      index,
      name,
      arguments: {},
      error: 'invalid_arguments',
    };
  }
  if (!availableToolNames.has(name)) {
    return {
      index,
      name,
      arguments: args,
      error: 'unknown_tool',
    };
  }

  return {
    index,
    name,
    arguments: args,
  };
}

function parseOllamaToolCalls(
  raw: string,
  tools: ToolDefinition[] = getAgentTools(),
): OllamaToolCallParseResult {
  const text = stripOuterCodeFence(raw);
  const matches = Array.from(text.matchAll(toolCallsPattern));
  if (matches.length === 0) {
    return { kind: 'text', text };
  }
  if (matches.length !== 1) {
    return {
      kind: 'malformed',
      error: 'multiple_envelopes',
    };
  }

  const fullMatch = matches[0][0];
  if (text.replace(fullMatch, '').trim().length > 0) {
    return {
      kind: 'malformed',
      error: 'text_outside_envelope',
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(matches[0][1]);
  } catch {
    return { kind: 'malformed', error: 'invalid_json' };
  }
  if (!isRecord(payload)) {
    return {
      kind: 'malformed',
      error: 'invalid_payload',
    };
  }

  let rawCalls: unknown[] = [];
  if (Array.isArray(payload.calls)) {
    rawCalls = payload.calls;
  } else if (isRecord(payload.calls)) {
    rawCalls = [payload.calls];
  }
  if (rawCalls.length === 0) {
    return {
      kind: 'malformed',
      error: 'empty_calls',
    };
  }

  const availableToolNames = new Set(tools.map((tool) => tool.name));
  return {
    kind: 'calls',
    calls: rawCalls.map((call, index) =>
      normalizeCall(call, index, availableToolNames),
    ),
  };
}

function formatOllamaToolResults(results: OllamaToolResult[]): string {
  return `<tool_results>
${JSON.stringify({ results })}
</tool_results>`;
}

function buildOllamaProtocolCorrection(
  error: string,
  language: EffectiveDisplayLanguage = 'en',
): string {
  const bundle = LOCALIZED_PROMPTS[language].ollamaProtocol;
  return `${bundle.protocolError.replace('{0}', error)}
${bundle.correction}`;
}

function buildOllamaFinalToolReminder(
  language: EffectiveDisplayLanguage = 'en',
): string {
  return `${LOCALIZED_PROMPTS[language].ollamaProtocol.finalReminder}
${toolCallsOpenTag}
{"calls":[{"name":"${FINAL_COMMIT_MESSAGE_TOOL_NAME}","arguments":{"message":"type(scope): description"}}]}
${toolCallsCloseTag}`;
}

export {
  OllamaToolCallParseResult,
  OllamaToolCallError,
  OllamaToolResult,
  ParsedOllamaToolCall,
  buildOllamaFinalToolReminder,
  buildOllamaProtocolCorrection,
  buildOllamaToolProtocolPrompt,
  formatOllamaToolResults,
  parseOllamaToolCalls,
};
