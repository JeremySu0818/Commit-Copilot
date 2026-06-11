import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOllamaToolProtocolPrompt,
  formatOllamaToolResults,
  parseOllamaToolCalls,
} from '../../agent-loop/ollama-tool-protocol';
import { AGENT_TOOLS } from '../../agent-tools/definitions';

void test('Ollama protocol prompt mirrors all agent tool definitions', () => {
  const prompt = buildOllamaToolProtocolPrompt();

  for (const tool of AGENT_TOOLS) {
    assert.match(prompt, new RegExp(`"name":"${tool.name}"`));
  }
  assert.match(prompt, /multiple independent calls/i);
  assert.match(prompt, /application assigns IDs/i);
});

void test('Ollama protocol prompt localizes schema descriptions', () => {
  const prompt = buildOllamaToolProtocolPrompt('zh-TW');

  assert.match(prompt, /不使用 Ollama 原生工具呼叫/);
  assert.match(prompt, /相對於儲存庫根目錄的路徑/);
  assert.doesNotMatch(prompt, /Required\. Relative path/);
});

void test('parseOllamaToolCalls parses a multi-tool batch', () => {
  const parsed = parseOllamaToolCalls(`<tool_calls>
{"calls":[{"name":"get_diff","arguments":{"path":"src/a.ts"}},{"name":"read_file","arguments":{"path":"src/b.ts","startLine":1}}]}
</tool_calls>`);

  if (parsed.kind !== 'calls') {
    assert.fail(`Expected calls, received ${parsed.kind}`);
  }
  assert.deepEqual(parsed.calls, [
    {
      index: 0,
      name: 'get_diff',
      arguments: { path: 'src/a.ts' },
    },
    {
      index: 1,
      name: 'read_file',
      arguments: { path: 'src/b.ts', startLine: 1 },
    },
  ]);
});

void test('parseOllamaToolCalls accepts an outer code fence and single call object', () => {
  const parsed = parseOllamaToolCalls(`\`\`\`json
<tool_calls>
{"calls":{"name":"get_recent_commits","arguments":{"count":5}}}
</tool_calls>
\`\`\``);

  if (parsed.kind !== 'calls') {
    assert.fail(`Expected calls, received ${parsed.kind}`);
  }
  assert.equal(parsed.calls.length, 1);
  assert.equal(parsed.calls[0].name, 'get_recent_commits');
});

void test('parseOllamaToolCalls preserves valid calls when another call is invalid', () => {
  const parsed = parseOllamaToolCalls(`<tool_calls>
{"calls":[{"name":"get_diff","arguments":{"path":"src/a.ts"}},{"name":"missing_tool","arguments":[]}]}
</tool_calls>`);

  if (parsed.kind !== 'calls') {
    assert.fail(`Expected calls, received ${parsed.kind}`);
  }
  assert.equal(parsed.calls[0].error, undefined);
  assert.equal(parsed.calls[1].error, 'invalid_arguments');
});

void test('parseOllamaToolCalls rejects malformed envelopes and JSON', () => {
  const outsideText = parseOllamaToolCalls(
    'First I will inspect.<tool_calls>{"calls":[]}</tool_calls>',
  );
  assert.equal(outsideText.kind, 'malformed');

  const invalidJson = parseOllamaToolCalls(
    '<tool_calls>{"calls":[}</tool_calls>',
  );
  assert.equal(invalidJson.kind, 'malformed');

  const multiple = parseOllamaToolCalls(
    '<tool_calls>{"calls":[]}</tool_calls><tool_calls>{"calls":[]}</tool_calls>',
  );
  assert.equal(multiple.kind, 'malformed');
});

void test('parseOllamaToolCalls returns ordinary text separately', () => {
  assert.deepEqual(parseOllamaToolCalls('fix(core): fallback output'), {
    kind: 'text',
    text: 'fix(core): fallback output',
  });
});

void test('formatOllamaToolResults keeps ids, status, and content structured', () => {
  const formatted = formatOllamaToolResults([
    {
      id: 'step-1-call-1',
      name: 'get_diff',
      success: true,
      content: 'diff content',
    },
  ]);

  assert.match(formatted, /^<tool_results>/);
  assert.match(formatted, /"id":"step-1-call-1"/);
  assert.match(formatted, /"success":true/);
  assert.match(formatted, /diff content/);
});
