import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_MODELS } from '../../llm/provider-registry';
import {
  fetchOpenRouterModels,
  fetchQwenModels,
  resolveDefaultModel,
} from '../../models/catalog';
import {
  DEFAULT_CUSTOM_PROVIDER_API_FORMAT,
  normalizeCustomProviderConfig,
} from '../../models/custom-provider';
import { resolveGenerateMode } from '../../models/options';

function toRequestUrl(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (input instanceof Request) {
    return input.url;
  }
  return '';
}

void test('fetchOpenRouterModels fetches and filters text tool-call models', async () => {
  const originalFetch = global.fetch;
  type FetchFn = NonNullable<typeof global.fetch>;
  type FetchInput = Parameters<FetchFn>[0];
  type FetchInit = Parameters<FetchFn>[1];
  const fetchCalls: { input: FetchInput; init: FetchInit | undefined }[] = [];
  const fetchMock: FetchFn = (input: FetchInput, init?: FetchInit) => {
    fetchCalls.push({ input, init });
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'provider/text-tools',
              name: 'Text Tools',
              architecture: { output_modalities: ['text'] },
              supported_parameters: ['tools', 'temperature'],
              top_provider: { max_completion_tokens: 8192 },
            },
            {
              id: 'provider/text-only',
              name: 'Text Only',
              architecture: { output_modalities: ['text'] },
              supported_parameters: ['temperature'],
            },
            {
              id: 'provider/image-tools',
              name: 'Image Tools',
              architecture: { output_modalities: ['image'] },
              supported_parameters: ['tools'],
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
  };
  global.fetch = fetchMock;

  try {
    const models = await fetchOpenRouterModels('openrouter-test-key');

    assert.equal(fetchCalls.length, 1);
    const requestUrl = new URL(toRequestUrl(fetchCalls[0].input));
    assert.equal(
      `${requestUrl.origin}${requestUrl.pathname}`,
      'https://openrouter.ai/api/v1/models',
    );
    assert.equal(requestUrl.searchParams.get('output_modalities'), 'text');
    assert.equal(requestUrl.searchParams.get('supported_parameters'), 'tools');
    assert.deepEqual(fetchCalls[0].init?.headers, {
      Authorization: 'Bearer openrouter-test-key',
    });
    assert.deepEqual(models, [
      {
        id: 'provider/text-tools',
        alias: 'Text Tools',
        max_tokens: 8192,
      },
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

void test('fetchQwenModels fetches endpoint models and keeps Qwen text generation models', async () => {
  const originalFetch = global.fetch;
  type FetchFn = NonNullable<typeof global.fetch>;
  type FetchInput = Parameters<FetchFn>[0];
  type FetchInit = Parameters<FetchFn>[1];
  const fetchCalls: { input: FetchInput; init: FetchInit | undefined }[] = [];
  const fetchMock: FetchFn = (input: FetchInput, init?: FetchInit) => {
    fetchCalls.push({ input, init });
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: [
            { id: 'qwen-plus' },
            { id: 'qwen3.5-flash', name: 'Qwen 3.5 Flash' },
            { id: 'qwen3-coder-plus' },
            { id: 'qwen-vl-plus' },
            { id: 'text-embedding-v4' },
            { id: 'wan2.6-t2i' },
            { id: 'deepseek-v3.2' },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
  };
  global.fetch = fetchMock;

  try {
    const models = await fetchQwenModels('qwen-test-key');

    assert.equal(fetchCalls.length, 1);
    assert.equal(
      toRequestUrl(fetchCalls[0].input),
      'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
    );
    assert.deepEqual(fetchCalls[0].init?.headers, {
      Authorization: 'Bearer qwen-test-key',
    });
    assert.deepEqual(models, [
      { id: 'qwen3.5-flash', alias: 'Qwen 3.5 Flash' },
      { id: 'qwen-plus', alias: 'qwen-plus' },
      { id: 'qwen3-coder-plus', alias: 'qwen3-coder-plus' },
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

void test('resolveDefaultModel keeps saved model when it is available', () => {
  const models = [
    { id: 'gpt-5-mini', alias: 'GPT-5 mini' },
    { id: DEFAULT_MODELS.openai, alias: 'GPT-5.5' },
  ];

  assert.equal(
    resolveDefaultModel('openai', models, 'gpt-5-mini'),
    'gpt-5-mini',
  );
});

void test('resolveDefaultModel falls back to provider default when saved model is unavailable', () => {
  const models = [
    { id: 'gpt-5-mini', alias: 'GPT-5 mini' },
    { id: DEFAULT_MODELS.openai, alias: 'GPT-5.5' },
  ];

  assert.equal(
    resolveDefaultModel('openai', models, 'missing-model'),
    DEFAULT_MODELS.openai,
  );
});

void test('resolveDefaultModel falls back to first model when provider default is unavailable', () => {
  const models = [
    { id: 'provider/model-a', alias: 'Model A' },
    { id: 'provider/model-b', alias: 'Model B' },
  ];

  assert.equal(resolveDefaultModel('openrouter', models), 'provider/model-a');
});

void test('resolveDefaultModel returns empty string when no models are available', () => {
  assert.equal(resolveDefaultModel('openrouter', []), '');
});

void test('resolveGenerateMode preserves an explicitly requested agentic mode', () => {
  assert.equal(resolveGenerateMode('direct-diff', 'agentic'), 'agentic');
});

void test('resolveGenerateMode falls back to saved and default modes', () => {
  assert.equal(resolveGenerateMode('direct-diff', undefined), 'direct-diff');
  assert.equal(resolveGenerateMode(undefined, undefined), 'agentic');
});

void test('normalizeCustomProviderConfig keeps legacy providers OpenAI-compatible', () => {
  assert.deepEqual(
    normalizeCustomProviderConfig({
      id: 'legacy',
      name: 'Legacy Provider',
      baseUrl: 'https://legacy.example/v1',
    }),
    {
      id: 'legacy',
      name: 'Legacy Provider',
      baseUrl: 'https://legacy.example/v1',
      apiFormat: DEFAULT_CUSTOM_PROVIDER_API_FORMAT,
    },
  );
});

void test('normalizeCustomProviderConfig keeps valid Anthropic settings', () => {
  assert.deepEqual(
    normalizeCustomProviderConfig({
      id: 'claude-proxy',
      name: 'Claude Proxy',
      baseUrl: 'https://anthropic.example',
      apiFormat: 'anthropic',
      maxTokens: 16384,
    }),
    {
      id: 'claude-proxy',
      name: 'Claude Proxy',
      baseUrl: 'https://anthropic.example',
      apiFormat: 'anthropic',
      maxTokens: 16384,
    },
  );
});
