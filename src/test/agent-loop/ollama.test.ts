import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { OLLAMA_DEFAULT_HOST } from '../../models';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';

const MODULE_PATH = '../../agent-loop/ollama';

async function withOllamaModule<T>(
  ollamaMock: unknown,
  agentToolsMock: unknown,
  run: (mod: typeof import('../../agent-loop/ollama')) => Promise<T>,
): Promise<T> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('ollama', ollamaMock, async () => {
    return withModuleMock('../agent-tools', agentToolsMock, async () => {
      const dynamicRequire = createRequire(__filename);
      const mod = dynamicRequire(
        MODULE_PATH,
      ) as typeof import('../../agent-loop/ollama');
      return run(mod);
    });
  });
}

test('runOllamaAgentLoop pulls model, reports progress, and generates from inline diff', async () => {
  const pullRequests: any[] = [];
  const chatRequests: any[] = [];
  const progressEvents: Array<{ message: string; increment?: number }> = [];

  class OllamaMock {
    private readonly host: string;

    constructor(options: { host: string }) {
      this.host = options.host;
    }

    async pull(params: any) {
      pullRequests.push({ ...params, host: this.host });
      return {
        async *[Symbol.asyncIterator]() {
          yield { status: 'pulling manifest' };
          yield { status: 'downloading', total: 100, completed: 50 };
          yield { status: 'downloading', total: 100, completed: 100 };
        },
      };
    }

    async chat(params: any) {
      chatRequests.push(params);
      return {
        message: { content: 'fix(ollama): generate commit message' },
      };
    }
  }

  const agentToolsMock = {
    buildInitialContext: async () => 'initial context',
  };

  try {
    const result = await withOllamaModule(
      { Ollama: OllamaMock },
      agentToolsMock,
      async ({ runOllamaAgentLoop }) =>
        runOllamaAgentLoop(
          undefined,
          'llama3-test',
          'diff --git a/a.ts b/a.ts\n+line',
          process.cwd(),
          (message: string, increment?: number) => {
            progressEvents.push({ message, increment });
          },
          false,
        ),
    );

    assert.equal(result, 'fix(ollama): generate commit message');
  } finally {
    clearRequireCache(MODULE_PATH);
  }

  assert.equal(pullRequests[0].host, OLLAMA_DEFAULT_HOST);
  assert.equal(pullRequests[0].model, 'llama3-test');
  assert.equal(pullRequests[0].stream, true);
  assert.match(chatRequests[0].messages[1].content, /Full Diff/);
  assert.match(chatRequests[0].messages[1].content, /\+line/);
  assert.ok(progressEvents.length >= 3);
  assert.equal(
    progressEvents.some((event) => event.increment === 50),
    true,
  );
});

test('runOllamaAgentLoop maps connection failures to friendly host error', async () => {
  class OllamaConnectErrorMock {
    constructor(_options: { host: string }) {}

    async pull(_params: any) {
      return {
        async *[Symbol.asyncIterator]() {},
      };
    }

    async chat(_params: any) {
      throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
    }
  }

  const agentToolsMock = {
    buildInitialContext: async () => 'initial context',
  };

  const host = 'http://127.0.0.1:11434';
  try {
    await withOllamaModule(
      { Ollama: OllamaConnectErrorMock },
      agentToolsMock,
      async ({ runOllamaAgentLoop }) => {
        await assert.rejects(
          () =>
            runOllamaAgentLoop(
              host,
              'llama3-test',
              'diff --git a/a.ts b/a.ts\n+line',
              process.cwd(),
              undefined,
              true,
            ),
          (error: any) =>
            error?.name === 'APIRequestError' &&
            String(error.message).includes(
              `Make sure Ollama is running at ${host}`,
            ),
        );
      },
    );
  } finally {
    clearRequireCache(MODULE_PATH);
  }
});
