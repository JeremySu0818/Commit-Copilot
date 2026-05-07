import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { DEFAULT_MODELS } from '../../models';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';

const MODULE_PATH = '../../agent-loop/anthropic';

type AnthropicModule = typeof import('../../agent-loop/anthropic');

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
  const args = value.arguments;
  if (!isRecord(args)) {
    return null;
  }
  return {
    name: value.name,
    arguments: args,
  };
}

function isApiKeyInvalidError(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.name === 'APIKeyInvalidError' &&
    typeof value.message === 'string' &&
    value.message.includes('bad key')
  );
}

function getMessagesFromStreamRequest(value: unknown): unknown[] {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    throw new Error('Anthropic stream request does not include messages');
  }
  return value.messages;
}

async function withAnthropicModule<T>(
  anthropicMock: unknown,
  agentToolsMock: unknown,
  run: (mod: AnthropicModule) => Promise<T>,
): Promise<T> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock(
    '@anthropic-ai/sdk',
    { __esModule: true, default: anthropicMock },
    () =>
      withModuleMock('../agent-tools', agentToolsMock, () => {
        const dynamicRequire = createRequire(__filename);
        const mod = dynamicRequire(MODULE_PATH) as AnthropicModule;
        return run(mod);
      }),
  );
}

void test('runAnthropicAgentLoop executes tool_use blocks and sends tool_result messages', async () => {
  const streamRequests: unknown[] = [];
  const executedCalls: ToolCallShape[] = [];

  class AnthropicMock {
    messages = {
      stream: (params: unknown) => {
        streamRequests.push(params);
        const currentCall = streamRequests.length;
        return {
          finalMessage: () => {
            if (currentCall === 1) {
              return Promise.resolve({
                content: [
                  {
                    type: 'tool_use',
                    id: 'tool-1',
                    name: 'read_file',
                    input: { path: 'src/a.ts' },
                  },
                ],
                stop_reason: 'tool_use',
              });
            }

            return Promise.resolve({
              content: [
                { type: 'text', text: 'feat(agent): anthropic tool ok' },
              ],
              stop_reason: 'end_turn',
            });
          },
        };
      },
    };
  }

  const agentToolsMock = {
    buildInitialContext: () => Promise.resolve('initial context'),
    executeToolCall: (toolCall: unknown) => {
      const call = asToolCallShape(toolCall);
      if (!call) {
        throw new Error('Invalid tool call shape');
      }
      executedCalls.push(call);
      return Promise.resolve({ name: call.name, content: 'tool result ok' });
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
          DEFAULT_MODELS.anthropic,
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

  const secondRequestMessages = getMessagesFromStreamRequest(streamRequests[1]);
  const lastMessage = secondRequestMessages[secondRequestMessages.length - 1];
  if (!isRecord(lastMessage)) {
    throw new Error('Expected final user message');
  }
  assert.equal(lastMessage.role, 'user');
  assert.deepEqual(lastMessage.content, [
    {
      type: 'tool_result',
      tool_use_id: 'tool-1',
      content: 'tool result ok',
    },
  ]);
});

void test('runAnthropicAgentLoop maps 401 errors to APIKeyInvalidError', async () => {
  class AnthropicErrorMock {
    messages = {
      stream: (_params: unknown) => ({
        finalMessage: () => {
          const err = Object.assign(new Error('bad key'), { status: 401 });
          return Promise.reject(err);
        },
      }),
    };
  }

  const agentToolsMock = {
    buildInitialContext: () => Promise.resolve('initial context'),
    executeToolCall: () => Promise.resolve({ content: '' }),
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
              DEFAULT_MODELS.anthropic,
              'diff --git a/a.ts b/a.ts\n+line',
              process.cwd(),
            ),
          (error) => isApiKeyInvalidError(error),
        );
      },
    );
  } finally {
    clearRequireCache(MODULE_PATH);
  }
});
