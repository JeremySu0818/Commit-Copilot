import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGENT_TOOLS,
  toAnthropicTools,
  toGeminiFunctionDeclarations,
  toOpenAITools,
} from '../../agent-tools/definitions';

void test('AGENT_TOOLS includes all expected tool names', () => {
  const names = AGENT_TOOLS.map((tool) => tool.name).sort((a, b) =>
    a.localeCompare(b),
  );
  assert.deepEqual(names, [
    'find_references',
    'get_diff',
    'get_file_outline',
    'get_recent_commits',
    'read_file',
    'search_code',
  ]);
});

void test('toGeminiFunctionDeclarations mirrors tool definitions', () => {
  const declarations = toGeminiFunctionDeclarations();
  assert.equal(declarations.length, AGENT_TOOLS.length);
  assert.deepEqual(declarations[0], {
    name: AGENT_TOOLS[0].name,
    description: AGENT_TOOLS[0].description,
    parameters: AGENT_TOOLS[0].parameters,
  });
});

void test('toOpenAITools wraps each tool as function type', () => {
  const tools = toOpenAITools();
  assert.equal(tools.length, AGENT_TOOLS.length);
  const first = tools[0] as {
    type: string;
    function: { name: string; description: string; parameters: unknown };
  };
  assert.equal(first.type, 'function');
  assert.equal(first.function.name, AGENT_TOOLS[0].name);
});

void test('toAnthropicTools maps parameters to input_schema', () => {
  const tools = toAnthropicTools();
  assert.equal(tools.length, AGENT_TOOLS.length);
  const first = tools[0] as {
    name: string;
    description: string;
    input_schema: unknown;
  };
  assert.equal(first.name, AGENT_TOOLS[0].name);
  assert.deepEqual(first.input_schema, AGENT_TOOLS[0].parameters);
});
