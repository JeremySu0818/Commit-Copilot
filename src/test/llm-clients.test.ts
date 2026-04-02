import test from 'node:test';
import assert from 'node:assert/strict';
import { createLLMClient } from '../llm-clients';
import { OLLAMA_DEFAULT_HOST } from '../models';

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
