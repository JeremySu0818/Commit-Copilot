import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';

const MODULE_PATH = '../../agent-loop/anthropic';

async function withAnthropicModule<T>(
  anthropicMock: unknown,
  agentToolsMock: unknown,
  run: (mod: typeof import('../../agent-loop/anthropic')) => Promise<T>,
): Promise<T> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock(
    '@anthropic-ai/sdk',
    { __esModule: true, default: anthropicMock },
    async () => {
      return withModuleMock('../agent-tools', agentToolsMock, async () => {
        const dynamicRequire = createRequire(__filename);
        const mod = dynamicRequire(
          MODULE_PATH,
        ) as typeof import('../../agent-loop/anthropic');
        return run(mod);
      });
    },
  );
}

test('runAnthropicAgentLoop executes tool_use blocks and sends tool_result messages', async () => {
  const streamRequests: any[] = [];
  const executedCalls: any[] = [];

  class AnthropicMock {
    messages = {
      stream: (params: any) => {
        streamRequests.push(params);
        const currentCall = streamRequests.length;
        return {
          finalMessage: async () => {
            if (currentCall === 1) {
              return {
                content: [
                  {
                    type: 'tool_use',
                    id: 'tool-1',
                    name: 'read_file',
                    input: { path: 'src/a.ts' },
                  },
                ],
                stop_reason: 'tool_use',
              };
            }

            return {
              content: [
                { type: 'text', text: 'feat(agent): anthropic tool ok' },
              ],
              stop_reason: 'end_turn',
            };
          },
        };
      },
    };

    constructor(_options: { apiKey: string }) {}
  }

  const agentToolsMock = {
    buildInitialContext: async () => 'initial context',
    executeToolCall: async (toolCall: any) => {
      executedCalls.push(toolCall);
      return { name: toolCall.name, content: 'tool result ok' };
    },
    toAnthropicTools: () => [],
  };

  try {
    const result = await withAnthropicModule(
      AnthropicMock,
      agentToolsMock,
      async ({ runAnthropicAgentLoop }) =>
        runAnthropicAgentLoop(
          'anthropic-test-key',
          'claude-test',
          'diff --git a/a.ts b/a.ts\n+line',
          process.cwd(),
        ),
    );

    assert.equal(result, 'feat(agent): anthropic tool ok');
  } finally {
    clearRequireCache(MODULE_PATH);
  }

  assert.deepEqual(executedCalls, [
    {
      name: 'read_file',
      arguments: { path: 'src/a.ts' },
    },
  ]);

  const secondRequestMessages = streamRequests[1].messages;
  const lastMessage = secondRequestMessages[secondRequestMessages.length - 1];
  assert.equal(lastMessage.role, 'user');
  assert.deepEqual(lastMessage.content, [
    {
      type: 'tool_result',
      tool_use_id: 'tool-1',
      content: 'tool result ok',
    },
  ]);
});

test('runAnthropicAgentLoop maps 401 errors to APIKeyInvalidError', async () => {
  class AnthropicErrorMock {
    messages = {
      stream: (_params: any) => ({
        finalMessage: async () => {
          const err = Object.assign(new Error('bad key'), { status: 401 });
          throw err;
        },
      }),
    };

    constructor(_options: { apiKey: string }) {}
  }

  const agentToolsMock = {
    buildInitialContext: async () => 'initial context',
    executeToolCall: async () => ({ content: '' }),
    toAnthropicTools: () => [],
  };

  try {
    await withAnthropicModule(
      AnthropicErrorMock,
      agentToolsMock,
      async ({ runAnthropicAgentLoop }) => {
        await assert.rejects(
          () =>
            runAnthropicAgentLoop(
              'anthropic-test-key',
              'claude-test',
              'diff --git a/a.ts b/a.ts\n+line',
              process.cwd(),
            ),
          (error: any) =>
            error?.name === 'APIKeyInvalidError' &&
            /bad key/.test(error.message),
        );
      },
    );
  } finally {
    clearRequireCache(MODULE_PATH);
  }
});
