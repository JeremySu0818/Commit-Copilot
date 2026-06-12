import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import { DEFAULT_MODELS } from '../../../llm/provider-registry';
import { clearRequireCache, withModulesMock } from '../../helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '../../../agent/loop/gemini');

type GeminiModule = typeof import('../../../agent/loop/gemini');

interface ToolCallShape {
  name: string;
  arguments: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asToolCallShape(value: unknown): ToolCallShape | null {
  if (!isRecord(value)) {
    return null;
  }
  const args = value.arguments;
  if (typeof value.name !== 'string' || !isRecord(args)) {
    return null;
  }
  return {
    name: value.name,
    arguments: args,
  };
}

function getContentsFromGenerateRequest(value: unknown): unknown[] {
  if (!isRecord(value) || !Array.isArray(value.contents)) {
    throw new Error('Gemini generate request does not contain contents array');
  }
  return value.contents;
}

function isApiKeyInvalidError(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.name === 'APIKeyInvalidError' &&
    typeof value.message === 'string' &&
    value.message.includes('invalid key')
  );
}

async function withGeminiModule<T>(
  geminiMock: unknown,
  agentToolsMock: unknown,
  run: (mod: GeminiModule) => Promise<T>,
): Promise<T> {
  clearRequireCache(MODULE_PATH);
  return withModulesMock(
    {
      '@google/genai': geminiMock,
      '../tools/context': agentToolsMock,
      '../tools/executors/execute-tool-call': agentToolsMock,
    },
    () => {
      const dynamicRequire = createRequire(__filename);
      const mod = dynamicRequire(MODULE_PATH) as GeminiModule;
      return run(mod);
    },
  );
}

void test('runGeminiAgentLoop handles functionCall parts and sends functionResponse', async () => {
  const generateRequests: unknown[] = [];
  const executedCalls: ToolCallShape[] = [];

  class GoogleGenAIMock {
    models = {
      generateContent: (params: unknown) => {
        generateRequests.push(params);
        if (generateRequests.length === 1) {
          return Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        id: 'fc-1',
                        name: 'search_code',
                        args: { query: 'TODO' },
                      },
                    },
                  ],
                },
              },
            ],
            text: '',
          });
        }

        return Promise.resolve({
          candidates: [{ content: { role: 'model', parts: [] } }],
          text: 'feat(gemini): parsed function call response',
        });
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
      return Promise.resolve({ name: call.name, content: 'tool response ok' });
    },
    toGeminiFunctionDeclarations: () => [],
  };

  try {
    const result = await withGeminiModule(
      { GoogleGenAI: GoogleGenAIMock },
      agentToolsMock,
      async ({ runGeminiAgentLoop }) =>
        runGeminiAgentLoop({
          apiKey: 'gemini-test-key',
          model: `models/${DEFAULT_MODELS.google}`,
          diff: 'diff --git a/a.ts b/a.ts\n+line',
          repoRoot: process.cwd(),
        }),
    );

    assert.equal(result, 'feat(gemini): parsed function call response');
  } finally {
    clearRequireCache(MODULE_PATH);
  }

  assert.deepEqual(executedCalls, [
    {
      name: 'search_code',
      arguments: { query: 'TODO' },
    },
  ]);

  const secondRequestContents = getContentsFromGenerateRequest(
    generateRequests[1],
  );
  const toolResponseMessage =
    secondRequestContents[secondRequestContents.length - 1];
  if (!isRecord(toolResponseMessage)) {
    throw new Error('Expected tool response message object');
  }
  assert.equal(toolResponseMessage.role, 'user');
  assert.deepEqual(toolResponseMessage.parts, [
    {
      functionResponse: {
        name: 'search_code',
        response: { content: 'tool response ok' },
      },
    },
  ]);
});

void test('runGeminiAgentLoop returns write_commit_message argument without functionResponse', async () => {
  const generateRequests: unknown[] = [];
  const executedCalls: ToolCallShape[] = [];
  const progressMessages: string[] = [];

  class GoogleGenAIMock {
    models = {
      generateContent: (params: unknown) => {
        generateRequests.push(params);
        return Promise.resolve({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    functionCall: {
                      id: 'fc-final',
                      name: 'write_commit_message',
                      args: {
                        message: 'fix(gemini): submit structured message',
                      },
                    },
                  },
                ],
              },
            },
          ],
          text: '',
        });
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
      return Promise.resolve({ name: call.name, content: 'tool response ok' });
    },
    toGeminiFunctionDeclarations: () => [],
  };

  try {
    const result = await withGeminiModule(
      { GoogleGenAI: GoogleGenAIMock },
      agentToolsMock,
      async ({ runGeminiAgentLoop }) =>
        runGeminiAgentLoop({
          apiKey: 'gemini-test-key',
          model: `models/${DEFAULT_MODELS.google}`,
          diff: 'diff --git a/a.ts b/a.ts\n+line',
          repoRoot: process.cwd(),
          onProgress: (message) => {
            progressMessages.push(message);
          },
        }),
    );

    assert.equal(result, 'fix(gemini): submit structured message');
  } finally {
    clearRequireCache(MODULE_PATH);
  }

  assert.deepEqual(executedCalls, []);
  assert.equal(generateRequests.length, 1);
  const finalProgressMessage = progressMessages.find((message) =>
    message.includes('write_commit_message'),
  );
  assert.ok(finalProgressMessage);
  assert.match(finalProgressMessage, /^\[Step 1\]/);
});

void test('runGeminiAgentLoop maps API_KEY_INVALID to APIKeyInvalidError', async () => {
  class GoogleGenAIErrorMock {
    models = {
      generateContent: (_params: unknown) => {
        const error = new Error('invalid key') as Error & { code?: string };
        error.code = 'API_KEY_INVALID';
        return Promise.reject(error);
      },
    };
  }

  const agentToolsMock = {
    buildInitialContext: () => Promise.resolve('initial context'),
    executeToolCall: () => Promise.resolve({ content: '' }),
    toGeminiFunctionDeclarations: () => [],
  };

  try {
    await withGeminiModule(
      { GoogleGenAI: GoogleGenAIErrorMock },
      agentToolsMock,
      async ({ runGeminiAgentLoop }) => {
        await assert.rejects(
          () =>
            runGeminiAgentLoop({
              apiKey: 'gemini-test-key',
              model: 'gemini-test',
              diff: 'diff --git a/a.ts b/a.ts\n+line',
              repoRoot: process.cwd(),
            }),
          (error) => isApiKeyInvalidError(error),
        );
      },
    );
  } finally {
    clearRequireCache(MODULE_PATH);
  }
});
