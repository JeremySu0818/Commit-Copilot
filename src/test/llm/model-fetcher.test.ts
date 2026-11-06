import assert from 'node:assert/strict';
import test from 'node:test';

import type * as vscode from 'vscode';

import { ModelFetcher } from '../../llm/model-fetcher';

void test('built-in discovery caches successful models and preserves them on network failure', async (t) => {
  const state = new Map<string, unknown>();
  const context = {
    globalState: {
      get: (key: string) => state.get(key),
      update: (key: string, value: unknown) => {
        state.set(key, value);
        return Promise.resolve();
      },
    },
  } as unknown as vscode.ExtensionContext;
  const fetcher = new ModelFetcher(
    context,
    { getProviders: () => [] },
    () => undefined,
  );
  const fetchMock = t.mock.method(global, 'fetch', () =>
    Promise.resolve(Response.json({ data: [{ id: 'gpt-future' }] })),
  );
  const expected = [{ id: 'gpt-future', alias: 'GPT Future' }];
  assert.deepEqual(
    await fetcher.getBuiltInProviderModels('openai', 'key'),
    expected,
  );
  fetchMock.mock.mockImplementation(() => Promise.reject(new Error('offline')));
  assert.deepEqual(
    await fetcher.getBuiltInProviderModels('openai', 'key'),
    expected,
  );
  assert.deepEqual(state.get('OPENAI_FETCHED_MODELS'), expected);
  assert.deepEqual(
    await fetcher.getBuiltInProviderModels('deepseek', 'key'),
    [],
  );
});
