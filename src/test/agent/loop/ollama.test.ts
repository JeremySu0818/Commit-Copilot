import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import { OLLAMA_DEFAULT_HOST } from '../../../models/catalog';
import { EXIT_CODES } from '../../../shared/errors';
import { clearRequireCache, withModuleMock } from '../../helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '../../../agent/loop/ollama');

type OllamaModule = typeof import('../../../agent/loop/ollama');
const minimumProgressEventCount = 3;
const expectedIncrement = 50;
const malformedRecoveryStepLimit = 2;

function createEmptyPullStream() {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: () => Promise.resolve({ done: true, value: undefined }),
      };
    },
  };
}

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
    value.messageKey === 'api.ollamaConnectionFailed' &&
    isRecord(value.messageArgs) &&
    value.messageArgs.host === host
  );
}

function hasExitCode(value: unknown, code: number): boolean {
  return isRecord(value) && 'exitCode' in value && value.exitCode === code;
}

async function withOllamaModule<T>(
  ollamaMock: unknown,
  agentToolsMock: unknown,
  run: (mod: OllamaModule) => Promise<T>,
): Promise<T> {
  clearRequireCache(MODULE_PATH);
  return withModuleMock('ollama', ollamaMock, () =>
    withModuleMock('../tools/context', agentToolsMock, () =>
      withModuleMock(
        '../tools/executors/execute-tool-call',
        agentToolsMock,
        () => {
          const dynamicRequire = createRequire(__filename);
          const mod = dynamicRequire(MODULE_PATH) as OllamaModule;
          return run(mod);
        },
      ),
    ),
  );
}

void test('runOllamaAgentLoop executes batched text-protocol tools and returns final tool message', async () => {
  const pullRequests: Record<string, unknown>[] = [];
  const chatRequests: Record<string, unknown>[] = [];
  const progressEvents: { message: string; increment?: number }[] = [];
  const executedCalls: { name: string; arguments: Record<string, unknown> }[] =
    [];

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
      if (chatRequests.length === 1) {
        return Promise.resolve({
          message: {
            content: `<tool_calls>
{"calls":[{"name":"get_diff","arguments":{"path":"src/a.ts"}},{"name":"read_file","arguments":{"path":"src/a.ts","startLine":1,"endLine":20}}]}
</tool_calls>`,
          },
        });
      }
      return Promise.resolve({
        message: {
          content: `<tool_calls>
{"calls":[{"name":"write_commit_message","arguments":{"message":"fix(ollama): generate commit message"}}]}
</tool_calls>`,
        },
      });
    }
  }

  const agentToolsMock = {
    buildInitialContext: () => Promise.resolve('initial context'),
    executeToolCall: (call: {
      name: string;
      arguments: Record<string, unknown>;
    }) => {
      executedCalls.push(call);
      return Promise.resolve({
        name: call.name,
        content: `${call.name} result`,
      });
    },
  };

  try {
    const result = await withOllamaModule(
      { Ollama: OllamaMock },
      agentToolsMock,
      async ({ runOllamaAgentLoop }) =>
        runOllamaAgentLoop({
          apiKey: '',
          model: 'llama3-test',
          diff: 'diff --git a/a.ts b/a.ts\n+line',
          repoRoot: process.cwd(),
          onProgress: (message: string, increment?: number) => {
            progressEvents.push({ message, increment });
          },
          isStaged: false,
        }),
    );

    assert.equal(result, 'fix(ollama): generate commit message');
  } finally {
    clearRequireCache(MODULE_PATH);
  }

  assert.equal(pullRequests[0]?.host, OLLAMA_DEFAULT_HOST);
  assert.equal(pullRequests[0]?.model, 'llama3-test');
  assert.equal(pullRequests[0]?.stream, true);

  const firstMessages = isRecord(chatRequests[0])
    ? chatRequests[0].messages
    : null;
  if (
    !Array.isArray(firstMessages) ||
    !isRecord(firstMessages[0]) ||
    !isRecord(firstMessages[1])
  ) {
    throw new Error('Expected initial chat messages');
  }
  assert.match(String(firstMessages[0].content), /<tool_calls>/);
  assert.match(String(firstMessages[0].content), /find_references/);
  assert.equal(firstMessages[1].content, 'initial context');

  const secondMessages = isRecord(chatRequests[1])
    ? chatRequests[1].messages
    : null;
  if (!Array.isArray(secondMessages)) {
    throw new Error('Expected second chat messages');
  }
  assert.match(
    secondMessages.map((message) => JSON.stringify(message)).join('\n'),
    /step-1-call-1/,
  );
  assert.deepEqual(
    executedCalls.map((call) => call.name),
    ['get_diff', 'read_file'],
  );
  assert.ok(progressEvents.length >= minimumProgressEventCount);
  assert.equal(
    progressEvents.some((event) => event.increment === expectedIncrement),
    true,
  );
});

void test('runOllamaAgentLoop aborts an active model pull when cancelled', async () => {
  let abortCalls = 0;
  let listenerDisposed = false;
  let cancellationListener: (() => void) | undefined;
  let rejectPull: ((error: Error) => void) | undefined;
  let markPullStarted: (() => void) | undefined;
  const pullStarted = new Promise<void>((resolve) => {
    markPullStarted = resolve;
  });

  class OllamaMock {
    abort() {
      abortCalls += 1;
      rejectPull?.(new Error('The operation was aborted'));
    }

    pull() {
      return Promise.resolve({
        [Symbol.asyncIterator]() {
          return {
            next: () =>
              new Promise<IteratorResult<Record<string, unknown>>>(
                (_resolve, reject) => {
                  rejectPull = reject;
                  markPullStarted?.();
                },
              ),
          };
        },
      });
    }

    chat() {
      return Promise.reject(new Error('chat should not be called'));
    }
  }

  const cancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested(listener: () => void) {
      cancellationListener = listener;
      return {
        dispose() {
          listenerDisposed = true;
        },
      };
    },
  };
  const agentToolsMock = {
    buildInitialContext: () => Promise.resolve('initial context'),
    executeToolCall: () => Promise.resolve({ name: 'get_diff', content: '' }),
  };

  try {
    await withOllamaModule(
      { Ollama: OllamaMock },
      agentToolsMock,
      async ({ runOllamaAgentLoop }) => {
        const generation = runOllamaAgentLoop({
          apiKey: '',
          model: 'llama3-test',
          diff: 'diff --git a/a.ts b/a.ts\n+cancel pull',
          repoRoot: process.cwd(),
          isStaged: false,
          cancellationToken,
        });

        await pullStarted;
        cancellationToken.isCancellationRequested = true;
        cancellationListener?.();

        await assert.rejects(generation, (error: unknown) =>
          hasExitCode(error, EXIT_CODES.CANCELLED),
        );
      },
    );
  } finally {
    clearRequireCache(MODULE_PATH);
  }

  assert.equal(abortCalls, 1);
  assert.equal(listenerDisposed, true);
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
    executeToolCall: () => Promise.resolve({ name: 'get_diff', content: '' }),
  };

  const host = 'http://127.0.0.1:11434';
  try {
    await withOllamaModule(
      { Ollama: OllamaConnectErrorMock },
      agentToolsMock,
      async ({ runOllamaAgentLoop }) => {
        await assert.rejects(
          () =>
            runOllamaAgentLoop({
              apiKey: host,
              model: 'llama3-test',
              diff: 'diff --git a/a.ts b/a.ts\n+line',
              repoRoot: process.cwd(),
              isStaged: true,
            }),
          (error) => isApiRequestErrorWithHostMessage(error, host),
        );
      },
    );
  } finally {
    clearRequireCache(MODULE_PATH);
  }
});

void test('runOllamaAgentLoop sends a localized correction after malformed protocol output', async () => {
  const chatRequests: Record<string, unknown>[] = [];
  const progressMessages: string[] = [];

  class OllamaMalformedMock {
    pull(_params: unknown) {
      return Promise.resolve(createEmptyPullStream());
    }

    chat(params: Record<string, unknown>) {
      chatRequests.push(params);
      if (chatRequests.length === 1) {
        return Promise.resolve({
          message: { content: '<tool_calls>{"calls":[}</tool_calls>' },
        });
      }
      return Promise.resolve({
        message: {
          content:
            '<tool_calls>{"calls":[{"name":"write_commit_message","arguments":{"message":"fix(ollama): 修正協議輸出"}}]}</tool_calls>',
        },
      });
    }
  }

  const agentToolsMock = {
    buildInitialContext: () => Promise.resolve('initial context'),
    executeToolCall: () => Promise.resolve({ name: 'get_diff', content: '' }),
  };

  try {
    const result = await withOllamaModule(
      { Ollama: OllamaMalformedMock },
      agentToolsMock,
      async ({ runOllamaAgentLoop }) =>
        runOllamaAgentLoop({
          apiKey: '',
          model: 'llama3-test',
          diff: 'diff --git a/a.ts b/a.ts\n+line',
          repoRoot: process.cwd(),
          onProgress: (message: string) => {
            progressMessages.push(message);
          },
          isStaged: true,
          maxAgentSteps: malformedRecoveryStepLimit,
          language: 'zh-TW',
          commitMessageLanguage: 'zh-TW',
        }),
    );

    assert.equal(result, 'fix(ollama): 修正協議輸出');
    const finalProgressMessage = progressMessages.find((message) =>
      message.includes('write_commit_message'),
    );
    assert.ok(finalProgressMessage);
    assert.match(finalProgressMessage, /^\[步驟 1\]/);
  } finally {
    clearRequireCache(MODULE_PATH);
  }

  const messages = isRecord(chatRequests[1]) ? chatRequests[1].messages : null;
  assert.match(JSON.stringify(messages), /協議錯誤/);
  assert.match(JSON.stringify(messages), /invalid_json/);
});

void test('runOllamaAgentLoop forces final tool submission after max agent steps', async () => {
  const chatRequests: Record<string, unknown>[] = [];
  const progressMessages: string[] = [];

  class OllamaStepLimitMock {
    pull(_params: unknown) {
      return Promise.resolve(createEmptyPullStream());
    }

    chat(params: Record<string, unknown>) {
      chatRequests.push(params);
      if (chatRequests.length === 1) {
        return Promise.resolve({
          message: {
            content:
              '<tool_calls>{"calls":[{"name":"get_diff","arguments":{"path":"src/a.ts"}}]}</tool_calls>',
          },
        });
      }
      return Promise.resolve({
        message: {
          content:
            '<tool_calls>{"calls":[{"name":"write_commit_message","arguments":{"message":"fix(ollama): respect step limit"}}]}</tool_calls>',
        },
      });
    }
  }

  const agentToolsMock = {
    buildInitialContext: () => Promise.resolve('initial context'),
    executeToolCall: () =>
      Promise.resolve({ name: 'get_diff', content: 'diff result' }),
  };

  try {
    const result = await withOllamaModule(
      { Ollama: OllamaStepLimitMock },
      agentToolsMock,
      async ({ runOllamaAgentLoop }) =>
        runOllamaAgentLoop({
          apiKey: '',
          model: 'llama3-test',
          diff: 'diff --git a/a.ts b/a.ts\n+line',
          repoRoot: process.cwd(),
          onProgress: (message: string) => {
            progressMessages.push(message);
          },
          isStaged: true,
          maxAgentSteps: 1,
        }),
    );

    assert.equal(result, 'fix(ollama): respect step limit');
    const finalProgressMessage = progressMessages.find((message) =>
      message.includes('write_commit_message'),
    );
    assert.ok(finalProgressMessage);
    assert.match(finalProgressMessage, /^\[Step 2\]/);
  } finally {
    clearRequireCache(MODULE_PATH);
  }

  const messages = isRecord(chatRequests[1]) ? chatRequests[1].messages : null;
  assert.match(
    JSON.stringify(messages),
    /next response must contain exactly one write_commit_message call/i,
  );
});
