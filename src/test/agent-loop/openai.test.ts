import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { clearRequireCache, withModuleMock } from '../helpers/module-mock';

const MODULE_PATH = '../../agent-loop/openai';

type OpenAIModule = typeof import('../../agent-loop/openai');
const expectedToolMessageCount = 2;

interface ToolCallShape {
  name: string;
  arguments: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asToolCallShape(value: unknown): ToolCallShape | null {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return null;
  }
  if (!isRecord(value.arguments)) {
    return null;
  }
  return {
    name: value.name,
    arguments: value.arguments,
  };
}

function getMessagesFromCompletionRequest(value: unknown): unknown[] {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    throw new Error('OpenAI completion request missing messages');
  }
  return value.messages;
}

async function withOpenAIModule<T>(
  openaiMock: unknown,
  agentToolsMock: unknown,
  run: (mod: OpenAIModule) => Promise<T>,
): Promise<T> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock(
    'openai',
    { __esModule: true, default: openaiMock },
    () =>
      withModuleMock('../agent-tools', agentToolsMock, () => {
        const dynamicRequire = createRequire(__filename);
        const mod = dynamicRequire(MODULE_PATH) as OpenAIModule;
        return run(mod);
      }),
  );
}

void test('runOpenAIAgentLoop continues when one tool call has malformed JSON arguments', async () => {
  const completionRequests: unknown[] = [];
  const executedCalls: ToolCallShape[] = [];

  class OpenAIMock {
    chat = {
      completions: {
        create: (params: unknown) => {
          completionRequests.push(params);
          if (completionRequests.length === 1) {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    tool_calls: [
                      {
                        id: 'tool-call-bad',
                        type: 'function',
                        function: {
                          name: 'read_file',
                          arguments: '{"path":"src/a.ts"',
                        },
                      },
                      {
                        id: 'tool-call-good',
                        type: 'function',
                        function: {
                          name: 'get_diff',
                          arguments: '{"path":"src/b.ts"}',
                        },
                      },
                    ],
                  },
                },
              ],
            });
          }

          return Promise.resolve({
            choices: [
              {
                message: {
                  content: 'fix(agent): recover from malformed tool args',
                },
              },
            ],
          });
        },
      },
    };
  }

  const agentToolsMock = {
    buildInitialContext: () => Promise.resolve('mocked initial context'),
    executeToolCall: (toolCall: unknown) => {
      const call = asToolCallShape(toolCall);
      if (!call) {
        throw new Error('Invalid tool call shape');
      }
      executedCalls.push(call);
      return Promise.resolve({ name: call.name, content: 'tool ok' });
    },
    toOpenAITools: () => [],
  };

  try {
    const result = await withOpenAIModule(
      OpenAIMock,
      agentToolsMock,
      async ({ runOpenAIAgentLoop }) =>
        runOpenAIAgentLoop(
          'openai-test-key',
          'gpt-test',
          'diff --git a/a.ts b/a.ts\n+line',
          process.cwd(),
        ),
    );

    assert.equal(result, 'fix(agent): recover from malformed tool args');
  } finally {
    clearRequireCache(MODULE_PATH);
  }

  assert.deepEqual(executedCalls, [
    {
      name: 'get_diff',
      arguments: { path: 'src/b.ts' },
    },
  ]);

  const secondRequestMessages = getMessagesFromCompletionRequest(
    completionRequests[1],
  );
  const toolMessages = secondRequestMessages.filter(
    (message): message is Record<string, unknown> =>
      isRecord(message) && message.role === 'tool',
  );
  assert.equal(toolMessages.length, expectedToolMessageCount);
  assert.equal(toolMessages[0].tool_call_id, 'tool-call-bad');
  assert.match(
    String(toolMessages[0].content),
    /Invalid JSON arguments for read_file/,
  );
  assert.equal(toolMessages[1].tool_call_id, 'tool-call-good');
  assert.equal(toolMessages[1].content, 'tool ok');
});
