import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';

const MODULE_PATH = '../../agent-loop/gemini';

async function withGeminiModule<T>(
  geminiMock: unknown,
  agentToolsMock: unknown,
  run: (mod: typeof import('../../agent-loop/gemini')) => Promise<T>,
): Promise<T> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('@google/genai', geminiMock, async () => {
    return withModuleMock('../agent-tools', agentToolsMock, async () => {
      const dynamicRequire = createRequire(__filename);
      const mod = dynamicRequire(
        MODULE_PATH,
      ) as typeof import('../../agent-loop/gemini');
      return run(mod);
    });
  });
}

test('runGeminiAgentLoop handles functionCall parts and sends functionResponse', async () => {
  const generateRequests: any[] = [];
  const executedCalls: any[] = [];

  class GoogleGenAIMock {
    models = {
      generateContent: async (params: any) => {
        generateRequests.push(params);
        if (generateRequests.length === 1) {
          return {
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
          };
        }

        return {
          candidates: [{ content: { role: 'model', parts: [] } }],
          text: 'feat(gemini): parsed function call response',
        };
      },
    };

    constructor(_options: { apiKey: string }) {}
  }

  const agentToolsMock = {
    buildInitialContext: async () => 'initial context',
    executeToolCall: async (toolCall: any) => {
      executedCalls.push(toolCall);
      return { name: toolCall.name, content: 'tool response ok' };
    },
    toGeminiFunctionDeclarations: () => [],
  };

  try {
    const result = await withGeminiModule(
      { GoogleGenAI: GoogleGenAIMock },
      agentToolsMock,
      async ({ runGeminiAgentLoop }) =>
        runGeminiAgentLoop(
          'gemini-test-key',
          'models/gemini-2.5-pro',
          'diff --git a/a.ts b/a.ts\n+line',
          process.cwd(),
        ),
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

  const secondRequestContents = generateRequests[1].contents;
  const toolResponseMessage =
    secondRequestContents[secondRequestContents.length - 1];
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

test('runGeminiAgentLoop maps API_KEY_INVALID to APIKeyInvalidError', async () => {
  class GoogleGenAIErrorMock {
    models = {
      generateContent: async (_params: any) => {
        throw { code: 'API_KEY_INVALID', message: 'invalid key' };
      },
    };

    constructor(_options: { apiKey: string }) {}
  }

  const agentToolsMock = {
    buildInitialContext: async () => 'initial context',
    executeToolCall: async () => ({ content: '' }),
    toGeminiFunctionDeclarations: () => [],
  };

  try {
    await withGeminiModule(
      { GoogleGenAI: GoogleGenAIErrorMock },
      agentToolsMock,
      async ({ runGeminiAgentLoop }) => {
        await assert.rejects(
          () =>
            runGeminiAgentLoop(
              'gemini-test-key',
              'gemini-test',
              'diff --git a/a.ts b/a.ts\n+line',
              process.cwd(),
            ),
          (error: any) =>
            error?.name === 'APIKeyInvalidError' &&
            /invalid key/.test(error.message),
        );
      },
    );
  } finally {
    clearRequireCache(MODULE_PATH);
  }
});
