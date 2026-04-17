import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type * as vscode from 'vscode';

import { clearRequireCache, withModuleMock } from './helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '..', 'side-panel-provider');

type ProviderModule = typeof import('../side-panel-provider');
type MessageHandler = (data: unknown) => Promise<void> | void;
type PostedMessage = Record<string, unknown>;

interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface ProviderWithValidators {
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken,
  ): void;
  validateGoogleApiKey(apiKey: string): Promise<ValidationResult>;
  validateOpenAIApiKey(apiKey: string): Promise<ValidationResult>;
  validateAnthropicApiKey(apiKey: string): Promise<ValidationResult>;
}

interface Harness {
  sendMessage: (message: unknown) => Promise<void>;
  postedMessages: PostedMessage[];
  warningMessages: string[];
  infoMessages: string[];
  storedSecrets: { key: string; value: string }[];
  dispose: () => void;
}

interface ValidationResultMessage extends PostedMessage {
  type: 'validationResult';
  provider: string;
  success: boolean;
  error?: string;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toPostedMessage(value: unknown): PostedMessage | null {
  return isRecord(value) ? value : null;
}

function isValidationResultMessage(
  message: PostedMessage,
  provider: string,
): message is ValidationResultMessage {
  return (
    message.type === 'validationResult' &&
    message.provider === provider &&
    typeof message.success === 'boolean'
  );
}

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
    executeCommand: () => Promise.resolve(undefined),
  },
  window: {
    showWarningMessage: () => Promise.resolve(undefined),
    showInformationMessage: () => Promise.resolve(undefined),
    showErrorMessage: () => Promise.resolve(undefined),
  },
};

function createProvider(mod: ProviderModule): ProviderWithValidators {
  const provider = new mod.SidePanelProvider(
    { fsPath: process.cwd() } as unknown as vscode.Uri,
    {} as vscode.ExtensionContext,
  );
  return provider as unknown as ProviderWithValidators;
}

async function createHarness(): Promise<Harness> {
  clearRequireCache(MODULE_PATH);

  const postedMessages: PostedMessage[] = [];
  const warningMessages: string[] = [];
  const infoMessages: string[] = [];
  const storedSecrets: { key: string; value: string }[] = [];

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
    ...baseVscodeMock,
    window: {
      showWarningMessage: (message: string) => {
        warningMessages.push(message);
        return Promise.resolve(undefined);
      },
      showInformationMessage: (message: string) => {
        infoMessages.push(message);
        return Promise.resolve(undefined);
      },
      showErrorMessage: () => Promise.resolve(undefined),
    },
  };

  const mod = await withModuleMock('vscode', vscodeMock, () => {
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(MODULE_PATH) as ProviderModule;
  });

  const context = {
    globalState: {
      get: () => undefined,
      update: () => Promise.resolve(),
    },
    secrets: {
      get: () => Promise.resolve(undefined),
      store: (key: string, value: string) => {
        storedSecrets.push({ key, value });
        return Promise.resolve();
      },
    },
  } as unknown as vscode.ExtensionContext;

  const provider = new mod.SidePanelProvider(
    { fsPath: process.cwd() } as unknown as vscode.Uri,
    context,
  ) as unknown as ProviderWithValidators;
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
    warningMessages,
    infoMessages,
    storedSecrets,
    dispose: () => {
      disposeHandler?.();
    },
  };
}

void test('validateGoogleApiKey uses Google SDK models.list API', async () => {
  const calls = {
    apiKeys: [] as string[],
    listArgs: [] as (Record<string, unknown> | undefined)[],
  };

  class GoogleGenAIMock {
    models = {
      list: (params?: Record<string, unknown>) => {
        calls.listArgs.push(params);
        return Promise.resolve({ data: [] });
      },
    };

    constructor(options: { apiKey: string }) {
      calls.apiKeys.push(options.apiKey);
    }
  }

  await withModuleMock('vscode', baseVscodeMock, () =>
    withModuleMock('@google/genai', { GoogleGenAI: GoogleGenAIMock }, () => {
      clearRequireCache(MODULE_PATH);
      const dynamicRequire = createRequire(__filename);
      const mod = dynamicRequire(MODULE_PATH) as ProviderModule;
      const provider = createProvider(mod);
      return provider.validateGoogleApiKey('google-test-key').then((result) => {
        assert.deepEqual(calls.apiKeys, ['google-test-key']);
        assert.deepEqual(calls.listArgs, [{ config: { pageSize: 1 } }]);
        assert.deepEqual(result, { valid: true });
      });
    }),
  );
});

void test('validateOpenAIApiKey uses OpenAI SDK models.list', async () => {
  const calls = {
    apiKeys: [] as string[],
    listCalls: 0,
  };

  class OpenAIMock {
    models = {
      list: () => {
        calls.listCalls += 1;
        return Promise.resolve({ data: [] });
      },
    };

    constructor(options: { apiKey: string }) {
      calls.apiKeys.push(options.apiKey);
    }
  }

  await withModuleMock('vscode', baseVscodeMock, () =>
    withModuleMock('openai', { __esModule: true, default: OpenAIMock }, () => {
      clearRequireCache(MODULE_PATH);
      const dynamicRequire = createRequire(__filename);
      const mod = dynamicRequire(MODULE_PATH) as ProviderModule;
      const provider = createProvider(mod);
      return provider.validateOpenAIApiKey('openai-test-key').then((result) => {
        assert.deepEqual(calls.apiKeys, ['openai-test-key']);
        assert.equal(calls.listCalls, 1);
        assert.deepEqual(result, { valid: true });
      });
    }),
  );
});

void test('validation errors use unified API request failed format for Google/OpenAI/Anthropic', async () => {
  class GoogleGenAIMock {
    models = {
      list: () => {
        const error = new Error('google upstream failed') as Error & {
          status?: number;
        };
        error.status = 500;
        return Promise.reject(error);
      },
    };
  }

  class OpenAIMock {
    models = {
      list: () => {
        const error = new Error('openai upstream failed') as Error & {
          status?: number;
        };
        error.status = 500;
        return Promise.reject(error);
      },
    };
  }

  class AnthropicMock {
    models = {
      list: () => {
        const error = new Error('anthropic upstream failed') as Error & {
          status?: number;
        };
        error.status = 500;
        return Promise.reject(error);
      },
    };
  }

  await withModuleMock('vscode', baseVscodeMock, () =>
    withModuleMock('@google/genai', { GoogleGenAI: GoogleGenAIMock }, () =>
      withModuleMock('openai', { __esModule: true, default: OpenAIMock }, () =>
        withModuleMock(
          '@anthropic-ai/sdk',
          { __esModule: true, default: AnthropicMock },
          async () => {
            clearRequireCache(MODULE_PATH);
            const dynamicRequire = createRequire(__filename);
            const mod = dynamicRequire(MODULE_PATH) as ProviderModule;
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

void test('Anthropic API key validation uses SDK models.list and avoids fetch token calls', async () => {
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
      ),
    );
  };
  global.fetch = fetchMock;

  const harness = await createHarness();

  try {
    await harness.sendMessage({
      type: 'saveKey',
      provider: 'anthropic',
      value: 'test-anthropic-key',
    });

    assert.equal(fetchCalls.length, 1);
    const firstFetchCall = fetchCalls[0];
    const requestUrl = toRequestUrl(firstFetchCall.input);
    assert.match(requestUrl, /\/v1\/models/);
    assert.doesNotMatch(requestUrl, /\/v1\/messages/);
    assert.match(requestUrl, /limit=1/);
    assert.equal(harness.warningMessages.length, 0);
    assert.equal(harness.storedSecrets.length, 1);

    const resultMessage = harness.postedMessages.find((message) =>
      isValidationResultMessage(message, 'anthropic'),
    );
    if (!resultMessage) {
      throw new Error('Anthropic validation result message not found');
    }
    assert.equal(resultMessage.success, true);
  } finally {
    harness.dispose();
    global.fetch = originalFetch;
  }
});

void test('Anthropic API key validation maps 401 SDK errors to invalid key message', async () => {
  const originalFetch = global.fetch;
  type FetchFn = NonNullable<typeof global.fetch>;
  const fetchMock: FetchFn = () =>
    Promise.resolve(
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
      ),
    );
  global.fetch = fetchMock;

  const harness = await createHarness();

  try {
    await harness.sendMessage({
      type: 'saveKey',
      provider: 'anthropic',
      value: 'bad-anthropic-key',
    });

    assert.equal(harness.storedSecrets.length, 0);
    assert.equal(harness.warningMessages.length, 1);
    assert.match(harness.warningMessages[0] ?? '', /Invalid API Key/i);

    const resultMessage = harness.postedMessages.find((message) =>
      isValidationResultMessage(message, 'anthropic'),
    );
    if (!resultMessage) {
      throw new Error('Anthropic validation result message not found');
    }
    assert.equal(resultMessage.success, false);
    assert.match(String(resultMessage.error), /Invalid API Key/i);
  } finally {
    harness.dispose();
    global.fetch = originalFetch;
  }
});
