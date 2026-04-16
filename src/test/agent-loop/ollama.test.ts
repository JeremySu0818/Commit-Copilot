import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { OLLAMA_DEFAULT_HOST } from '../../models';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';

const MODULE_PATH = '../../agent-loop/ollama';

type OllamaModule = typeof import('../../agent-loop/ollama');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiRequestErrorWithHostMessage(
  value: unknown,
  host: string,
): boolean {
  return (
    isRecord(value) &&
    value.name === 'APIRequestError' &&
    typeof value.message === 'string' &&
    value.message.includes(`Make sure Ollama is running at ${host}`)
  );
}

async function withOllamaModule<T>(
  ollamaMock: unknown,
  agentToolsMock: unknown,
  run: (mod: OllamaModule) => Promise<T>,
): Promise<T> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('ollama', ollamaMock, () =>
    withModuleMock('../agent-tools', agentToolsMock, () => {
      const dynamicRequire = createRequire(__filename);
      const mod = dynamicRequire(MODULE_PATH) as OllamaModule;
      return run(mod);
    }),
  );
}

void test('runOllamaAgentLoop pulls model, reports progress, and generates from inline diff', async () => {
  const pullRequests: Record<string, unknown>[] = [];
  const chatRequests: Record<string, unknown>[] = [];
  const progressEvents: { message: string; increment?: number }[] = [];

  class OllamaMock {
    private readonly host: string;

    constructor(options: { host: string }) {
      this.host = options.host;
    }

    pull(params: Record<string, unknown>) {
      pullRequests.push({ ...params, host: this.host });
      const updates: Record<string, unknown>[] = [
        { status: 'pulling manifest' },
        { status: 'downloading', total: 100, completed: 50 },
        { status: 'downloading', total: 100, completed: 100 },
      ];
      return Promise.resolve({
        [Symbol.asyncIterator]() {
          let index = 0;
          return {
            next: () =>
              Promise.resolve(
                index < updates.length
                  ? { done: false, value: updates[index++] }
                  : { done: true, value: undefined },
              ),
          };
        },
      });
    }

    chat(params: Record<string, unknown>) {
      chatRequests.push(params);
      return Promise.resolve({
        message: { content: 'fix(ollama): generate commit message' },
      });
    }
  }

  const agentToolsMock = {
    buildInitialContext: () => Promise.resolve('initial context'),
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

  assert.equal(pullRequests[0]?.host, OLLAMA_DEFAULT_HOST);
  assert.equal(pullRequests[0]?.model, 'llama3-test');
  assert.equal(pullRequests[0]?.stream, true);

  const chatMessages = isRecord(chatRequests[0])
    ? chatRequests[0].messages
    : null;
  if (!Array.isArray(chatMessages) || !isRecord(chatMessages[1])) {
    throw new Error('Expected second chat message to exist');
  }
  assert.match(String(chatMessages[1].content), /Full Diff/);
  assert.match(String(chatMessages[1].content), /\+line/);
  assert.ok(progressEvents.length >= 3);
  assert.equal(
    progressEvents.some((event) => event.increment === 50),
    true,
  );
});

void test('runOllamaAgentLoop maps connection failures to friendly host error', async () => {
  class OllamaConnectErrorMock {
    pull(_params: unknown) {
      return Promise.resolve({
        [Symbol.asyncIterator]() {
          return {
            next: () => Promise.resolve({ done: true, value: undefined }),
          };
        },
      });
    }

    chat(_params: unknown) {
      return Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:11434'));
    }
  }

  const agentToolsMock = {
    buildInitialContext: () => Promise.resolve('initial context'),
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
          (error) => isApiRequestErrorWithHostMessage(error, host),
        );
      },
    );
  } finally {
    clearRequireCache(MODULE_PATH);
  }
});
