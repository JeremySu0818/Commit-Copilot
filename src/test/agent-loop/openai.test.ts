import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';

const MODULE_PATH = '../../agent-loop/openai';

async function withOpenAIModule<T>(
  openaiMock: unknown,
  agentToolsMock: unknown,
  run: (mod: typeof import('../../agent-loop/openai')) => Promise<T>,
): Promise<T> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock(
    'openai',
    { __esModule: true, default: openaiMock },
    async () => {
      return withModuleMock('../agent-tools', agentToolsMock, async () => {
        const dynamicRequire = createRequire(__filename);
        const mod = dynamicRequire(
          MODULE_PATH,
        ) as typeof import('../../agent-loop/openai');
        return run(mod);
      });
    },
  );
}

test('runOpenAIAgentLoop continues when one tool call has malformed JSON arguments', async () => {
  const completionRequests: any[] = [];
  const executedCalls: any[] = [];

  class OpenAIMock {
    chat = {
      completions: {
        create: async (params: any) => {
          completionRequests.push(params);
          if (completionRequests.length === 1) {
            return {
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
            };
          }

          return {
            choices: [
              {
                message: {
                  content: 'fix(agent): recover from malformed tool args',
                },
              },
            ],
          };
        },
      },
    };

    constructor(_options: { apiKey: string; baseURL?: string }) {}
  }

  const agentToolsMock = {
    buildInitialContext: async () => 'mocked initial context',
    executeToolCall: async (toolCall: any) => {
      executedCalls.push(toolCall);
      return { name: toolCall.name, content: 'tool ok' };
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

  const secondRequestMessages = completionRequests[1].messages;
  const toolMessages = secondRequestMessages.filter(
    (message: any) => message.role === 'tool',
  );
  assert.equal(toolMessages.length, 2);
  assert.equal(toolMessages[0].tool_call_id, 'tool-call-bad');
  assert.match(toolMessages[0].content, /Invalid JSON arguments for read_file/);
  assert.equal(toolMessages[1].tool_call_id, 'tool-call-good');
  assert.equal(toolMessages[1].content, 'tool ok');
});
