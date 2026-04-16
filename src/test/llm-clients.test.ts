import assert from 'node:assert/strict';
import test from 'node:test';

import { APIRequestError, EXIT_CODES } from '../errors';
import { createLLMClient } from '../llm-clients';
import { OLLAMA_DEFAULT_HOST } from '../models';

import { withModuleMock } from './helpers/module-mock';

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
    apiKey: 'http://legacy-host:11434',
    ollamaHost: 'http://custom-host:11434',
    model: 'qwen2.5:latest',
  });

  assert.equal(getOllamaHost(client), 'http://custom-host:11434');
});

void test('createLLMClient keeps backward compatibility for ollama apiKey host', () => {
  const client = createLLMClient({
    provider: 'ollama',
    apiKey: 'http://legacy-host:11434',
    model: 'qwen2.5:latest',
  });

  assert.equal(getOllamaHost(client), 'http://legacy-host:11434');
});

void test('createLLMClient falls back to default ollama host when host is empty', () => {
  const client = createLLMClient({
    provider: 'ollama',
    apiKey: '',
    model: 'qwen2.5:latest',
  });

  assert.equal(getOllamaHost(client), OLLAMA_DEFAULT_HOST);
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
