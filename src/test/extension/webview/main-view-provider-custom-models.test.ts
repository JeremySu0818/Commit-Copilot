import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type * as vscode from 'vscode';

import type { ModelConfig } from '../../../models/catalog';
import {
  CUSTOM_PROVIDERS_STATE_KEY,
  CUSTOM_PROVIDER_PREFIX,
  getCustomProviderModelsStorageKey,
  getCustomProviderStorageKey,
} from '../../../models/custom-provider';
import { clearRequireCache, withModuleMock } from '../../helpers/module-mock';

const MODULE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'extension',
  'webview',
  'main-view-provider',
);
const customId = 'local-ai';
const customProvider = `${CUSTOM_PROVIDER_PREFIX}${customId}`;
const customModelKey = `CUSTOM_${customId}_MODEL`;

type MessageHandler = (data: unknown) => Promise<void> | void;
type PostedMessage = Record<string, unknown>;

interface ProviderWithFetcher {
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken,
  ): void;
  fetchCustomProviderModels(
    apiKey: string,
    baseUrl: string | undefined,
    customProviderId: string,
  ): Promise<ModelConfig[]>;
  fetchOllamaModels(host: string | undefined): Promise<ModelConfig[]>;
  modelFetcher: {
    fetchCustomProviderModels(
      apiKey: string,
      baseUrl: string | undefined,
      customProviderId: string,
    ): Promise<ModelConfig[]>;
    fetchOllamaModels(host: string | undefined): Promise<ModelConfig[]>;
  };
}

interface Harness {
  sendMessage: (message: unknown) => Promise<void>;
  postedMessages: PostedMessage[];
  state: Map<string, unknown>;
  provider: ProviderWithFetcher;
  dispose: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toPostedMessage(value: unknown): PostedMessage | null {
  return isRecord(value) ? value : null;
}

async function createHarness(
  initialState: Record<string, unknown> = {},
  fetchedModels: ModelConfig[] = [],
  fetchedOllamaModels: ModelConfig[] = [],
): Promise<Harness> {
  clearRequireCache(MODULE_PATH);

  const postedMessages: PostedMessage[] = [];
  const state = new Map<string, unknown>(Object.entries(initialState));
  const secrets = new Map<string, string>([
    [getCustomProviderStorageKey(customId), 'custom-api-key'],
  ]);

  let messageHandler: MessageHandler = (_data: unknown) => Promise.resolve();
  let disposeHandler: (() => void) | null = null;

  const noop = (): void => {
    return;
  };

  const webview = {
    cspSource: 'mock-csp-source',
    asWebviewUri: (uri: { fsPath: string }) => ({
      toString: () => `mock-webview://${uri.fsPath.replace(/\\/g, '/')}`,
    }),
    options: undefined as unknown,
    html: '',
    postMessage: (message: unknown) => {
      const posted = toPostedMessage(message);
      if (posted) {
        postedMessages.push(posted);
      }
      return Promise.resolve(true);
    },
    onDidReceiveMessage: (callback: MessageHandler) => {
      messageHandler = callback;
      return { dispose: noop };
    },
  };

  const webviewView = {
    webview,
    onDidDispose: (callback: () => void) => {
      disposeHandler = callback;
      return { dispose: noop };
    },
  };

  const vscodeMock = {
    Uri: {
      joinPath: (base: { fsPath: string }, ...paths: string[]) => ({
        fsPath: path.join(base.fsPath, ...paths),
      }),
    },
    extensions: {
      getExtension: () => undefined,
    },
    commands: {
      executeCommand: () => Promise.resolve(undefined),
    },
    window: {
      showWarningMessage: () => Promise.resolve(undefined),
      showInformationMessage: () => Promise.resolve(undefined),
      showErrorMessage: () => Promise.resolve(undefined),
    },
  };

  const mod = await withModuleMock('vscode', vscodeMock, () => {
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(
      MODULE_PATH,
    ) as typeof import('../../../extension/webview/main-view-provider');
  });

  const context = {
    globalState: {
      get: (key: string) => state.get(key),
      update: (key: string, value: unknown) => {
        state.set(key, value);
        return Promise.resolve();
      },
    },
    secrets: {
      get: (key: string) => Promise.resolve(secrets.get(key)),
      store: (key: string, value: string) => {
        secrets.set(key, value);
        return Promise.resolve();
      },
      delete: (key: string) => {
        secrets.delete(key);
        return Promise.resolve();
      },
    },
  } as unknown as vscode.ExtensionContext;

  const provider = new mod.MainViewProvider(
    { fsPath: process.cwd() } as unknown as vscode.Uri,
    context,
  ) as unknown as ProviderWithFetcher;
  provider.modelFetcher.fetchCustomProviderModels = () =>
    Promise.resolve(fetchedModels);
  provider.modelFetcher.fetchOllamaModels = () =>
    Promise.resolve(fetchedOllamaModels);
  provider.resolveWebviewView(
    webviewView as unknown as vscode.WebviewView,
    {} as vscode.WebviewViewResolveContext,
    {} as vscode.CancellationToken,
  );

  const sendMessage = async (message: unknown): Promise<void> => {
    await messageHandler(message);
  };

  return {
    sendMessage,
    postedMessages,
    state,
    provider,
    dispose: () => {
      disposeHandler?.();
    },
  };
}

function findPostedMessage(
  postedMessages: PostedMessage[],
  type: string,
): PostedMessage {
  const message = postedMessages.find((item) => item.type === type);
  if (!message) {
    throw new Error(`${type} message not found`);
  }
  return message;
}

void test('addCustomModel persists the first manual model selection', async () => {
  const harness = await createHarness({
    [CUSTOM_PROVIDERS_STATE_KEY]: [
      { id: customId, name: 'Local AI', baseUrl: 'http://localhost:1234/v1' },
    ],
  });

  try {
    await harness.sendMessage({
      type: 'addCustomModel',
      provider: customProvider,
      modelName: 'manual-model',
    });

    assert.equal(harness.state.get(customModelKey), 'manual-model');
    const message = findPostedMessage(
      harness.postedMessages,
      'customModelAdded',
    );
    assert.equal(message.currentModel, 'manual-model');
    assert.deepEqual(message.models, [
      { id: 'manual-model', alias: 'manual-model' },
    ]);
  } finally {
    harness.dispose();
  }
});

void test('getModels preserves saved custom model missing from fetched and manual lists', async () => {
  const harness = await createHarness(
    {
      [CUSTOM_PROVIDERS_STATE_KEY]: [
        { id: customId, name: 'Local AI', baseUrl: 'http://localhost:1234/v1' },
      ],
      [customModelKey]: 'saved-only-model',
    },
    [{ id: 'api-model', alias: 'api-model' }],
  );

  try {
    await harness.sendMessage({
      type: 'getModels',
      provider: customProvider,
    });

    const message = findPostedMessage(harness.postedMessages, 'modelsList');
    assert.equal(message.currentModel, 'saved-only-model');
    assert.deepEqual(message.models, [
      { id: 'api-model', alias: 'api-model' },
      { id: 'saved-only-model', alias: 'saved-only-model' },
    ]);
  } finally {
    harness.dispose();
  }
});

void test('deleteCustomModel clears saved selection when deleting the last available model', async () => {
  const harness = await createHarness({
    [CUSTOM_PROVIDERS_STATE_KEY]: [
      { id: customId, name: 'Local AI', baseUrl: 'http://localhost:1234/v1' },
    ],
    [customModelKey]: 'manual-model',
    [getCustomProviderModelsStorageKey(customId)]: [
      { id: 'manual-model', alias: 'manual-model' },
    ],
  });

  try {
    await harness.sendMessage({
      type: 'deleteCustomModel',
      provider: customProvider,
      modelId: 'manual-model',
    });

    assert.equal(harness.state.get(customModelKey), undefined);
    assert.deepEqual(
      harness.state.get(getCustomProviderModelsStorageKey(customId)),
      [],
    );
    const message = findPostedMessage(
      harness.postedMessages,
      'customModelDeleted',
    );
    assert.equal(message.currentModel, '');
    assert.deepEqual(message.models, []);
    assert.deepEqual(message.customModels, []);
  } finally {
    harness.dispose();
  }
});

void test('addCustomModel persists the first manual model selection for ollama', async () => {
  const harness = await createHarness();
  const manualModel = 'manual-model';

  try {
    await harness.sendMessage({
      type: 'addCustomModel',
      provider: 'ollama',
      modelName: manualModel,
    });

    assert.equal(harness.state.get('OLLAMA_MODEL'), manualModel);
    assert.deepEqual(harness.state.get('OLLAMA_MODELS'), [
      { id: manualModel, alias: manualModel },
    ]);
    const message = findPostedMessage(
      harness.postedMessages,
      'customModelAdded',
    );
    assert.equal(message.currentModel, manualModel);
    assert.deepEqual(message.models, [{ id: manualModel, alias: manualModel }]);
  } finally {
    harness.dispose();
  }
});

void test('deleteCustomModel clears ollama selection when deleting the last available model', async () => {
  const manualModel = 'manual-model';
  const harness = await createHarness({
    OLLAMA_MODEL: manualModel,
    OLLAMA_MODELS: [{ id: manualModel, alias: manualModel }],
  });

  try {
    await harness.sendMessage({
      type: 'deleteCustomModel',
      provider: 'ollama',
      modelId: manualModel,
    });

    assert.equal(harness.state.get('OLLAMA_MODEL'), undefined);
    assert.deepEqual(harness.state.get('OLLAMA_MODELS'), []);
    const message = findPostedMessage(
      harness.postedMessages,
      'customModelDeleted',
    );
    assert.equal(message.currentModel, '');
    assert.deepEqual(message.models, []);
    assert.deepEqual(message.customModels, []);
  } finally {
    harness.dispose();
  }
});

void test('fetchOllamaModels cleans up manual models present in API tags response', async () => {
  const apiModel = 'api-model';
  const unlistedModel = 'custom-unlisted-model';
  const originalFetch = global.fetch;
  const mockFetch = () =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          models: [{ name: apiModel }],
        }),
    } as Response);

  global.fetch = mockFetch;

  const harness = await createHarness({
    OLLAMA_MODELS: [
      { id: apiModel, alias: apiModel },
      { id: unlistedModel, alias: unlistedModel },
    ],
  });

  const modelFetcherPrototype = Object.getPrototypeOf(
    harness.provider.modelFetcher,
  ) as {
    fetchOllamaModels: ProviderWithFetcher['modelFetcher']['fetchOllamaModels'];
  };
  const realFetchOllamaModels = modelFetcherPrototype.fetchOllamaModels;
  harness.provider.modelFetcher.fetchOllamaModels = realFetchOllamaModels;

  try {
    const result = await harness.provider.modelFetcher.fetchOllamaModels(
      'http://localhost:11434',
    );

    assert.deepEqual(harness.state.get('OLLAMA_MODELS'), [
      { id: unlistedModel, alias: unlistedModel },
    ]);

    assert.deepEqual(result, [
      { id: apiModel, alias: apiModel },
      { id: unlistedModel, alias: unlistedModel },
    ]);

    const message = findPostedMessage(
      harness.postedMessages,
      'customModelsList',
    );
    assert.deepEqual(message.customModels, [
      { id: unlistedModel, alias: unlistedModel },
    ]);
  } finally {
    global.fetch = originalFetch;
    harness.dispose();
  }
});

void test('fetchCustomProviderModels cleans up manual models present in API models response', async () => {
  const apiModel = 'api-model';
  const unlistedModel = 'custom-unlisted-model';
  class MockOpenAI {
    models = {
      list: () => {
        const mockModelIterator = {
          [Symbol.asyncIterator]() {
            let step = 0;
            const models = [{ id: apiModel }];
            return {
              next() {
                if (step < models.length) {
                  return Promise.resolve({
                    value: models[step++],
                    done: false,
                  });
                }
                return Promise.resolve({ done: true });
              },
            };
          },
        };
        return mockModelIterator;
      },
    };
  }

  await withModuleMock(
    'openai',
    { __esModule: true, default: MockOpenAI },
    async () => {
      const harness = await createHarness({
        [CUSTOM_PROVIDERS_STATE_KEY]: [
          {
            id: customId,
            name: 'Local AI',
            baseUrl: 'http://localhost:1234/v1',
          },
        ],
        [getCustomProviderModelsStorageKey(customId)]: [
          { id: apiModel, alias: apiModel },
          { id: unlistedModel, alias: unlistedModel },
        ],
      });

      const modelFetcherPrototype = Object.getPrototypeOf(
        harness.provider.modelFetcher,
      ) as {
        fetchCustomProviderModels: ProviderWithFetcher['modelFetcher']['fetchCustomProviderModels'];
      };
      const realFetchCustomProviderModels =
        modelFetcherPrototype.fetchCustomProviderModels;
      harness.provider.modelFetcher.fetchCustomProviderModels =
        realFetchCustomProviderModels;

      try {
        const result =
          await harness.provider.modelFetcher.fetchCustomProviderModels(
            'mock-api-key',
            'http://localhost:1234/v1',
            customId,
          );

        assert.deepEqual(
          harness.state.get(getCustomProviderModelsStorageKey(customId)),
          [{ id: unlistedModel, alias: unlistedModel }],
        );

        assert.deepEqual(result, [
          { id: apiModel, alias: apiModel },
          { id: unlistedModel, alias: unlistedModel },
        ]);

        const message = findPostedMessage(
          harness.postedMessages,
          'customModelsList',
        );
        assert.deepEqual(message.customModels, [
          { id: unlistedModel, alias: unlistedModel },
        ]);
      } finally {
        harness.dispose();
      }
    },
  );
});
