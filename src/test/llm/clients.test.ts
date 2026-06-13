import assert from 'node:assert/strict';
import test from 'node:test';

import { createLLMClient } from '../../llm/clients';
import { DEFAULT_MODELS } from '../../llm/provider-registry';
import { OLLAMA_DEFAULT_HOST } from '../../models/catalog';
import { APIRequestError, EXIT_CODES } from '../../shared/errors';
import { withModuleMock } from '../helpers/module-mock';

const customAnthropicMaxTokens = 12288;

function getOllamaHost(client: unknown): string {
  return (client as { host: string }).host;
}

function hasExitCode(value: unknown, code: number): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'exitCode' in value &&
    (value as { exitCode?: unknown }).exitCode === code
  );
}

void test('createLLMClient uses explicit ollamaHost when provided', () => {
  const client = createLLMClient({
    provider: 'ollama',
    apiKey: 'https://legacy-host:11434',
    ollamaHost: 'https://custom-host:11434',
    model: 'qwen2.5:latest',
  });

  assert.equal(getOllamaHost(client), 'https://custom-host:11434');
});

void test('createLLMClient keeps backward compatibility for ollama apiKey host', () => {
  const client = createLLMClient({
    provider: 'ollama',
    apiKey: 'https://legacy-host:11434',
    model: 'qwen2.5:latest',
  });

  assert.equal(getOllamaHost(client), 'https://legacy-host:11434');
});

void test('createLLMClient falls back to default ollama host when host is empty', () => {
  const client = createLLMClient({
    provider: 'ollama',
    apiKey: '',
    model: 'qwen2.5:latest',
  });

  assert.equal(getOllamaHost(client), OLLAMA_DEFAULT_HOST);
});

void test('Ollama direct diff aborts an active model pull when cancelled', async () => {
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

  await withModuleMock('ollama', { Ollama: OllamaMock }, async () => {
    const client = createLLMClient({
      provider: 'ollama',
      apiKey: OLLAMA_DEFAULT_HOST,
      model: 'qwen2.5:latest',
    });
    const generation = client.generateCommitMessage(
      'diff --git a/file.txt b/file.txt\n+cancel pull',
      undefined,
      undefined,
      cancellationToken,
    );

    await pullStarted;
    cancellationToken.isCancellationRequested = true;
    cancellationListener?.();

    await assert.rejects(generation, (error: unknown) =>
      hasExitCode(error, EXIT_CODES.CANCELLED),
    );
  });

  assert.equal(abortCalls, 1);
  assert.equal(listenerDisposed, true);
});

void test('Anthropic direct diff uses streaming API', async () => {
  const calls = {
    apiKeys: [] as string[],
    streamCalls: 0,
    finalMessageCalls: 0,
    createCalls: 0,
  };

  class AnthropicMock {
    messages = {
      create: () => {
        calls.createCalls += 1;
        return Promise.reject(
          new Error('messages.create should not be called in direct diff'),
        );
      },
      stream: (_params: Record<string, unknown>) => {
        calls.streamCalls += 1;
        return {
          finalMessage: () => {
            calls.finalMessageCalls += 1;
            return Promise.resolve({
              content: [{ type: 'text', text: 'fix(core): stream anthropic' }],
            });
          },
        };
      },
    };

    constructor(options: { apiKey: string }) {
      calls.apiKeys.push(options.apiKey);
    }
  }

  await withModuleMock(
    '@anthropic-ai/sdk',
    { __esModule: true, default: AnthropicMock },
    async () => {
      const client = createLLMClient({
        provider: 'anthropic',
        apiKey: 'anthropic-test-key',
      });

      const message = await client.generateCommitMessage(
        'diff --git a/file.txt b/file.txt\n+streamed',
      );

      assert.equal(message, 'fix(core): stream anthropic');
    },
  );

  assert.deepEqual(calls.apiKeys, ['anthropic-test-key']);
  assert.equal(calls.streamCalls, 1);
  assert.equal(calls.finalMessageCalls, 1);
  assert.equal(calls.createCalls, 0);
});

void test('custom Anthropic direct diff uses configured base URL and max tokens', async () => {
  const constructorOptions: Record<string, unknown>[] = [];
  const streamParams: Record<string, unknown>[] = [];

  class AnthropicMock {
    messages = {
      stream: (params: Record<string, unknown>) => {
        streamParams.push(params);
        return {
          finalMessage: () =>
            Promise.resolve({
              content: [{ type: 'text', text: 'feat: custom anthropic' }],
            }),
        };
      },
    };

    constructor(options: Record<string, unknown>) {
      constructorOptions.push(options);
    }
  }

  await withModuleMock(
    '@anthropic-ai/sdk',
    { __esModule: true, default: AnthropicMock },
    async () => {
      const client = createLLMClient({
        provider: 'openai',
        apiKey: 'custom-key',
        baseUrl: 'https://anthropic.example',
        apiFormat: 'anthropic',
        maxTokens: customAnthropicMaxTokens,
        model: 'custom-claude-model',
      });

      const message = await client.generateCommitMessage(
        'diff --git a/file.txt b/file.txt\n+custom anthropic',
      );
      assert.equal(message, 'feat: custom anthropic');
    },
  );

  assert.deepEqual(constructorOptions, [
    {
      apiKey: 'custom-key',
      baseURL: 'https://anthropic.example',
    },
  ]);
  assert.equal(streamParams[0]?.model, 'custom-claude-model');
  assert.equal(streamParams[0]?.max_tokens, customAnthropicMaxTokens);
});

void test('custom Anthropic direct diff omits max_tokens when custom endpoint leaves it unset', async () => {
  const streamParams: Record<string, unknown>[] = [];

  class AnthropicMock {
    messages = {
      stream: (params: Record<string, unknown>) => {
        streamParams.push(params);
        return {
          finalMessage: () =>
            Promise.resolve({
              content: [
                { type: 'text', text: 'feat: custom anthropic no max' },
              ],
            }),
        };
      },
    };
  }

  await withModuleMock(
    '@anthropic-ai/sdk',
    { __esModule: true, default: AnthropicMock },
    async () => {
      const client = createLLMClient({
        provider: 'openai',
        apiKey: 'custom-key',
        baseUrl: 'https://anthropic.example',
        apiFormat: 'anthropic',
        model: 'custom-claude-model',
      });

      const message = await client.generateCommitMessage(
        'diff --git a/file.txt b/file.txt\n+custom anthropic',
      );
      assert.equal(message, 'feat: custom anthropic no max');
    },
  );

  assert.equal(streamParams[0]?.model, 'custom-claude-model');
  assert.equal('max_tokens' in (streamParams[0] ?? {}), false);
});

void test('OpenAI direct diff rethrows existing APIRequestError without wrapping', async () => {
  const originalError = new APIRequestError('upstream failure');

  class OpenAIMock {
    chat = {
      completions: {
        create: () => Promise.reject(originalError),
      },
    };
  }

  await withModuleMock(
    'openai',
    { __esModule: true, default: OpenAIMock },
    async () => {
      const client = createLLMClient({
        provider: 'openai',
        apiKey: 'openai-test-key',
      });

      await assert.rejects(
        () => client.generateCommitMessage('diff --git a/a b/a\n+change'),
        (error: unknown) => {
          assert.equal(error, originalError);
          return true;
        },
      );
    },
  );
});

void test('Anthropic direct diff rethrows existing APIRequestError without wrapping', async () => {
  const originalError = new APIRequestError('upstream failure');

  class AnthropicMock {
    messages = {
      stream: (_params: Record<string, unknown>) => ({
        finalMessage: () => Promise.reject(originalError),
      }),
    };
  }

  await withModuleMock(
    '@anthropic-ai/sdk',
    { __esModule: true, default: AnthropicMock },
    async () => {
      const client = createLLMClient({
        provider: 'anthropic',
        apiKey: 'anthropic-test-key',
      });

      await assert.rejects(
        () => client.generateCommitMessage('diff --git a/a b/a\n+change'),
        (error: unknown) => {
          assert.equal(error, originalError);
          return true;
        },
      );
    },
  );
});

void test('Gemini direct diff maps status 401 to API key invalid', async () => {
  class GoogleGenAIMock {
    models = {
      generateContent: () => {
        const error = new Error('Request failed with status 401 Unauthorized');
        (error as Error & { status?: number }).status = 401;
        return Promise.reject(error);
      },
    };
  }

  await withModuleMock(
    '@google/genai',
    { GoogleGenAI: GoogleGenAIMock },
    async () => {
      const client = createLLMClient({
        provider: 'google',
        apiKey: 'google-test-key',
      });

      await assert.rejects(
        () => client.generateCommitMessage('diff --git a/a b/a\n+change'),
        (error: unknown) => {
          assert.equal(hasExitCode(error, EXIT_CODES.API_KEY_INVALID), true);
          return true;
        },
      );
    },
  );
});

void test('Gemini direct diff ignores unrelated numeric substrings', async () => {
  class GoogleGenAIMock {
    models = {
      generateContent: () =>
        Promise.reject(
          new Error('parse error on line 401 near port 4013, token 4299'),
        ),
    };
  }

  await withModuleMock(
    '@google/genai',
    { GoogleGenAI: GoogleGenAIMock },
    async () => {
      const client = createLLMClient({
        provider: 'google',
        apiKey: 'google-test-key',
      });

      await assert.rejects(
        () => client.generateCommitMessage('diff --git a/a b/a\n+change'),
        (error: unknown) => {
          assert.equal(hasExitCode(error, EXIT_CODES.API_ERROR), true);
          return true;
        },
      );
    },
  );
});

void test('createLLMClient creates correct client instances for new built-in providers', () => {
  const cases = [
    {
      provider: 'grok',
      url: 'https://api.x.ai/v1',
      model: DEFAULT_MODELS.grok,
    },
    {
      provider: 'groq',
      url: 'https://api.groq.com/openai/v1',
      model: DEFAULT_MODELS.groq,
    },
    {
      provider: 'openrouter',
      url: 'https://openrouter.ai/api/v1',
      model: DEFAULT_MODELS.openrouter,
    },
    {
      provider: 'deepseek',
      url: 'https://api.deepseek.com',
      model: DEFAULT_MODELS.deepseek,
    },
    {
      provider: 'qwen',
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: DEFAULT_MODELS.qwen,
    },
  ] as const;

  for (const tc of cases) {
    const client = createLLMClient({
      provider: tc.provider,
      apiKey: 'test-key',
    });
    assert.ok(client);
    const clientRecord = client as unknown as {
      baseURL?: string;
      model?: string;
    };
    assert.equal(clientRecord.baseURL, tc.url);
    assert.equal(clientRecord.model, tc.model);
  }
});
