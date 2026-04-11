import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { createRequire } from 'node:module';
import { clearRequireCache, withModuleMock } from './helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '..', 'side-panel-provider');

type MessageHandler = (data: any) => Promise<void> | void;

type Harness = {
  sendMessage: (message: unknown) => Promise<void>;
  postedMessages: any[];
  warningMessages: string[];
  infoMessages: string[];
  storedSecrets: Array<{ key: string; value: string }>;
  dispose: () => void;
};

const baseVscodeMock = {
  Uri: {
    joinPath: (base: { fsPath: string }, ...paths: string[]) => ({
      fsPath: path.join(base.fsPath, ...paths),
    }),
  },
  extensions: {
    getExtension: () => undefined,
  },
  commands: {
    executeCommand: async () => undefined,
  },
  window: {
    showWarningMessage: async () => undefined,
    showInformationMessage: async () => undefined,
    showErrorMessage: async () => undefined,
  },
};

function createProvider(mod: any) {
  return new mod.SidePanelProvider(
    { fsPath: process.cwd() } as any,
    {} as any,
  ) as any;
}

async function createHarness(): Promise<Harness> {
  clearRequireCache(MODULE_PATH);

  const postedMessages: any[] = [];
  const warningMessages: string[] = [];
  const infoMessages: string[] = [];
  const storedSecrets: Array<{ key: string; value: string }> = [];

  let messageHandler: MessageHandler | null = null;
  let disposeHandler: (() => void) | null = null;

  const webview = {
    cspSource: 'mock-csp-source',
    asWebviewUri: (uri: { fsPath: string }) => ({
      toString: () => `mock-webview://${uri.fsPath.replace(/\\/g, '/')}`,
    }),
    options: undefined as unknown,
    html: '',
    postMessage: (message: any) => {
      postedMessages.push(message);
      return Promise.resolve(true);
    },
    onDidReceiveMessage: (callback: MessageHandler) => {
      messageHandler = callback;
      return { dispose: () => {} };
    },
  };

  const webviewView = {
    webview,
    onDidDispose: (callback: () => void) => {
      disposeHandler = callback;
      return { dispose: () => {} };
    },
  };

  const vscodeMock = {
    ...baseVscodeMock,
    window: {
      showWarningMessage: async (message: string) => {
        warningMessages.push(message);
        return undefined;
      },
      showInformationMessage: async (message: string) => {
        infoMessages.push(message);
        return undefined;
      },
      showErrorMessage: async () => undefined,
    },
  };

  const mod = await withModuleMock('vscode', vscodeMock, async () => {
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(MODULE_PATH);
  });

  const context = {
    globalState: {
      get: () => undefined,
      update: async () => {},
    },
    secrets: {
      get: async () => undefined,
      store: async (key: string, value: string) => {
        storedSecrets.push({ key, value });
      },
    },
  } as any;

  const provider = new mod.SidePanelProvider(
    { fsPath: process.cwd() } as any,
    context,
  );
  provider.resolveWebviewView(webviewView as any, {} as any, {} as any);

  if (!messageHandler) {
    throw new Error('Webview message handler not registered');
  }

  return {
    sendMessage: async (message: unknown) => {
      await messageHandler?.(message);
    },
    postedMessages,
    warningMessages,
    infoMessages,
    storedSecrets,
    dispose: () => {
      disposeHandler?.();
    },
  };
}

test('validateGoogleApiKey uses Google SDK models.list API', async () => {
  const calls = {
    apiKeys: [] as string[],
    listArgs: [] as Array<Record<string, unknown> | undefined>,
  };

  class GoogleGenAIMock {
    models = {
      list: async (params?: Record<string, unknown>) => {
        calls.listArgs.push(params);
        return { data: [] };
      },
    };

    constructor(options: { apiKey: string }) {
      calls.apiKeys.push(options.apiKey);
    }
  }

  await withModuleMock('vscode', baseVscodeMock, async () =>
    withModuleMock(
      '@google/genai',
      { GoogleGenAI: GoogleGenAIMock },
      async () => {
        clearRequireCache(MODULE_PATH);
        const dynamicRequire = createRequire(__filename);
        const mod = dynamicRequire(
          MODULE_PATH,
        ) as typeof import('../side-panel-provider');
        const provider = createProvider(mod);
        const result = await provider.validateGoogleApiKey('google-test-key');

        assert.deepEqual(calls.apiKeys, ['google-test-key']);
        assert.deepEqual(calls.listArgs, [{ config: { pageSize: 1 } }]);
        assert.deepEqual(result, { valid: true });
      },
    ),
  );
});

test('validateOpenAIApiKey uses OpenAI SDK models.list', async () => {
  const calls = {
    apiKeys: [] as string[],
    listCalls: 0,
  };

  class OpenAIMock {
    models = {
      list: async () => {
        calls.listCalls += 1;
        return { data: [] };
      },
    };

    constructor(options: { apiKey: string }) {
      calls.apiKeys.push(options.apiKey);
    }
  }

  await withModuleMock('vscode', baseVscodeMock, async () =>
    withModuleMock(
      'openai',
      { __esModule: true, default: OpenAIMock },
      async () => {
        clearRequireCache(MODULE_PATH);
        const dynamicRequire = createRequire(__filename);
        const mod = dynamicRequire(
          MODULE_PATH,
        ) as typeof import('../side-panel-provider');
        const provider = createProvider(mod);
        const result = await provider.validateOpenAIApiKey('openai-test-key');

        assert.deepEqual(calls.apiKeys, ['openai-test-key']);
        assert.equal(calls.listCalls, 1);
        assert.deepEqual(result, { valid: true });
      },
    ),
  );
});

test('validation errors use unified API request failed format for Google/OpenAI/Anthropic', async () => {
  class GoogleGenAIMock {
    models = {
      list: async () => {
        const error = new Error('google upstream failed') as Error & {
          status?: number;
        };
        error.status = 500;
        throw error;
      },
    };

    constructor(_options: { apiKey: string }) {}
  }

  class OpenAIMock {
    models = {
      list: async () => {
        const error = new Error('openai upstream failed') as Error & {
          status?: number;
        };
        error.status = 500;
        throw error;
      },
    };

    constructor(_options: { apiKey: string }) {}
  }

  class AnthropicMock {
    models = {
      list: async () => {
        const error = new Error('anthropic upstream failed') as Error & {
          status?: number;
        };
        error.status = 500;
        throw error;
      },
    };

    constructor(_options: { apiKey: string }) {}
  }

  await withModuleMock('vscode', baseVscodeMock, async () =>
    withModuleMock(
      '@google/genai',
      { GoogleGenAI: GoogleGenAIMock },
      async () =>
        withModuleMock(
          'openai',
          { __esModule: true, default: OpenAIMock },
          async () =>
            withModuleMock(
              '@anthropic-ai/sdk',
              { __esModule: true, default: AnthropicMock },
              async () => {
                clearRequireCache(MODULE_PATH);
                const dynamicRequire = createRequire(__filename);
                const mod = dynamicRequire(
                  MODULE_PATH,
                ) as typeof import('../side-panel-provider');
                const provider = createProvider(mod);

                const googleResult =
                  await provider.validateGoogleApiKey('google-test-key');
                const openaiResult =
                  await provider.validateOpenAIApiKey('openai-test-key');
                const anthropicResult =
                  await provider.validateAnthropicApiKey('anthropic-test-key');

                assert.equal(googleResult.valid, false);
                assert.equal(openaiResult.valid, false);
                assert.equal(anthropicResult.valid, false);
                assert.equal(
                  String(googleResult.error),
                  'API request failed (500)',
                );
                assert.equal(
                  String(openaiResult.error),
                  'API request failed (500)',
                );
                assert.equal(
                  String(anthropicResult.error),
                  'API request failed (500)',
                );
              },
            ),
        ),
    ),
  );
});

test('Anthropic API key validation uses SDK models.list and avoids fetch token calls', async () => {
  const originalFetch = global.fetch;
  const fetchCalls: Array<{ input: unknown; init: unknown }> = [];
  global.fetch = (async (input: unknown, init?: unknown) => {
    fetchCalls.push({ input, init });
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 'mock-model',
            created_at: '2026-01-01T00:00:00Z',
            display_name: 'Mock',
            type: 'model',
          },
        ],
        first_id: 'mock-model',
        last_id: 'mock-model',
        has_more: false,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as any;

  const harness = await createHarness();

  try {
    await harness.sendMessage({
      type: 'saveKey',
      provider: 'anthropic',
      value: 'test-anthropic-key',
    });

    assert.equal(fetchCalls.length, 1);
    const requestUrl = String(fetchCalls[0].input);
    assert.match(requestUrl, /\/v1\/models/);
    assert.doesNotMatch(requestUrl, /\/v1\/messages/);
    assert.match(requestUrl, /limit=1/);
    assert.equal(harness.warningMessages.length, 0);
    assert.equal(harness.storedSecrets.length, 1);

    const resultMessage = harness.postedMessages.find(
      (message) =>
        message.type === 'validationResult' && message.provider === 'anthropic',
    );
    assert.ok(resultMessage);
    assert.equal(resultMessage.success, true);
  } finally {
    harness.dispose();
    global.fetch = originalFetch;
  }
});

test('Anthropic API key validation maps 401 SDK errors to invalid key message', async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        error: {
          type: 'authentication_error',
          message: 'invalid_api_key',
        },
      }),
      {
        status: 401,
        headers: { 'content-type': 'application/json' },
      },
    )) as any;

  const harness = await createHarness();

  try {
    await harness.sendMessage({
      type: 'saveKey',
      provider: 'anthropic',
      value: 'bad-anthropic-key',
    });

    assert.equal(harness.storedSecrets.length, 0);
    assert.equal(harness.warningMessages.length, 1);
    assert.match(harness.warningMessages[0], /Invalid API Key/i);

    const resultMessage = harness.postedMessages.find(
      (message) =>
        message.type === 'validationResult' && message.provider === 'anthropic',
    );
    assert.ok(resultMessage);
    assert.equal(resultMessage.success, false);
    assert.match(String(resultMessage.error), /Invalid API Key/i);
  } finally {
    harness.dispose();
    global.fetch = originalFetch;
  }
});
