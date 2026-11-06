import assert from 'node:assert/strict';
import test from 'node:test';

import { getAnthropicModelMaxTokens } from '../../models/catalog';
import { fetchProviderModels } from '../../models/discovery';
import { getModelAlias } from '../../models/model-alias';

const remoteOutputLimit = 8192;
const fallbackOutputLimit = 4096;

void test('aliases extract versions, sizes and provider names while preserving API labels', () => {
  const cases = [
    ['claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5'],
    ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite'],
    ['openai/gpt-oss-120b', 'GPT OSS 120B'],
    ['deepseek-flash', 'DeepSeek Flash'],
    ['qwen3-coder-plus', 'Qwen 3 Coder Plus'],
    ['o4-mini', 'o4 Mini'],
  ];
  for (const [id, expected] of cases) {
    assert.equal(getModelAlias(id), expected);
  }
  assert.equal(
    getModelAlias('gpt-future', 'Custom Friendly Label'),
    'Custom Friendly Label',
  );
});

void test('Google discovery follows pages, filters non-text models and keeps raw IDs', async (t) => {
  const calls: { url: string; headers: unknown }[] = [];
  t.mock.method(global, 'fetch', (input: URL, init: RequestInit) => {
    calls.push({ url: String(input), headers: init.headers });
    if (calls.length === 1) {
      return Promise.resolve(
        Response.json({
          models: [
            {
              name: 'models/gemini-future-flash',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/embedding-future',
              supportedGenerationMethods: ['embedContent'],
            },
            {
              name: 'models/gemini-image',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
          nextPageToken: 'page-two',
        }),
      );
    }
    return Promise.resolve(
      Response.json({
        models: [
          {
            name: 'models/gemini-future-pro',
            displayName: 'Gemini Future Pro',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }),
    );
  });
  assert.deepEqual(await fetchProviderModels('google', 'key'), [
    { id: 'gemini-future-flash', alias: 'Gemini Future Flash' },
    { id: 'gemini-future-pro', alias: 'Gemini Future Pro' },
  ]);
  assert.equal(new URL(calls[1].url).searchParams.get('pageToken'), 'page-two');
  assert.deepEqual(calls[0].headers, { 'x-goog-api-key': 'key' });
});

void test('Anthropic discovery follows cursors and reads output limits from metadata', async (t) => {
  const calls: string[] = [];
  t.mock.method(global, 'fetch', (input: URL) => {
    calls.push(String(input));
    const data = [
      {
        id: 'claude-future',
        display_name: 'Claude Future',
        max_tokens: remoteOutputLimit,
      },
    ];
    return Promise.resolve(
      Response.json({
        data,
        has_more: calls.length === 1,
        last_id: 'claude-future',
      }),
    );
  });
  assert.deepEqual(await fetchProviderModels('anthropic', 'key'), [
    {
      id: 'claude-future',
      alias: 'Claude Future',
      max_tokens: remoteOutputLimit,
    },
  ]);
  assert.equal(new URL(calls[1]).searchParams.get('after_id'), 'claude-future');
  assert.equal(getAnthropicModelMaxTokens('claude-future'), remoteOutputLimit);
  assert.equal(getAnthropicModelMaxTokens('claude-newer'), fallbackOutputLimit);
});

for (const [provider, endpoint] of [
  ['openai', 'https://api.openai.com/v1/models'],
  ['grok', 'https://api.x.ai/v1/models'],
  ['groq', 'https://api.groq.com/openai/v1/models'],
  ['deepseek', 'https://api.deepseek.com/models'],
] as const) {
  void test(`${provider} fetches its authenticated catalog and formats aliases`, async (t) => {
    t.mock.method(global, 'fetch', (input: URL, init: RequestInit) => {
      assert.equal(String(input), endpoint);
      assert.deepEqual(init.headers, { Authorization: 'Bearer key' });
      return Promise.resolve(
        Response.json({
          data: [
            { id: 'gpt-future' },
            { id: 'text-embedding-future' },
            { id: 'whisper-future' },
          ],
        }),
      );
    });
    assert.deepEqual(await fetchProviderModels(provider, 'key'), [
      { id: 'gpt-future', alias: 'GPT Future' },
    ]);
  });
}

void test('discovery rejects HTTP failures, invalid lists and repeated cursors', async (t) => {
  const fetchMock = t.mock.method(global, 'fetch', () =>
    Promise.resolve(new Response('', { status: 401 })),
  );
  await assert.rejects(fetchProviderModels('openai', 'key'), /401/);
  fetchMock.mock.mockImplementation(() =>
    Promise.resolve(Response.json({ data: {} })),
  );
  await assert.rejects(
    fetchProviderModels('openai', 'key'),
    /invalid model list/,
  );
  fetchMock.mock.mockImplementation(() =>
    Promise.resolve(Response.json({ models: [], nextPageToken: 'same' })),
  );
  await assert.rejects(
    fetchProviderModels('google', 'key'),
    /repeated pagination/,
  );
});
