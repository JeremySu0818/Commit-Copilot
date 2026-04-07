import test from 'node:test';
import assert from 'node:assert/strict';
import { createLLMClient } from '../llm-clients';
import { OLLAMA_DEFAULT_HOST } from '../models';
import { EXIT_CODES } from '../errors';
import { withModuleMock } from './helpers/module-mock';

function getOllamaHost(client: unknown): string {
  return (client as { host: string }).host;
}

test('createLLMClient uses explicit ollamaHost when provided', () => {
  const client = createLLMClient({
    provider: 'ollama',
    apiKey: 'http://legacy-host:11434',
    ollamaHost: 'http://custom-host:11434',
    model: 'qwen2.5:latest',
  });

  assert.equal(getOllamaHost(client), 'http://custom-host:11434');
});

test('createLLMClient keeps backward compatibility for ollama apiKey host', () => {
  const client = createLLMClient({
    provider: 'ollama',
    apiKey: 'http://legacy-host:11434',
    model: 'qwen2.5:latest',
  });

  assert.equal(getOllamaHost(client), 'http://legacy-host:11434');
});

test('createLLMClient falls back to default ollama host when host is empty', () => {
  const client = createLLMClient({
    provider: 'ollama',
    apiKey: '',
    model: 'qwen2.5:latest',
  });

  assert.equal(getOllamaHost(client), OLLAMA_DEFAULT_HOST);
});

test('Anthropic direct diff uses streaming API', async () => {
  const calls = {
    apiKeys: [] as string[],
    streamCalls: 0,
    finalMessageCalls: 0,
    createCalls: 0,
  };

  class AnthropicMock {
    messages = {
      create: async () => {
        calls.createCalls += 1;
        throw new Error('messages.create should not be called in direct diff');
      },
      stream: (_params: Record<string, unknown>) => {
        calls.streamCalls += 1;
        return {
          finalMessage: async () => {
            calls.finalMessageCalls += 1;
            return {
              content: [{ type: 'text', text: 'fix(core): stream anthropic' }],
            };
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

test('Gemini direct diff maps status 401 to API key invalid', async () => {
  class GoogleGenAIMock {
    models = {
      generateContent: async () => {
        const error = new Error('Request failed with status 401 Unauthorized');
        (error as Error & { status?: number }).status = 401;
        throw error;
      },
    };

    constructor(_options: { apiKey: string }) {}
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
        (error: any) => {
          assert.equal(error?.exitCode, EXIT_CODES.API_KEY_INVALID);
          return true;
        },
      );
    },
  );
});

test('Gemini direct diff ignores unrelated numeric substrings', async () => {
  class GoogleGenAIMock {
    models = {
      generateContent: async () => {
        throw new Error('parse error on line 401 near port 4013, token 4299');
      },
    };

    constructor(_options: { apiKey: string }) {}
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
        (error: any) => {
          assert.equal(error?.exitCode, EXIT_CODES.API_ERROR);
          return true;
        },
      );
    },
  );
});
