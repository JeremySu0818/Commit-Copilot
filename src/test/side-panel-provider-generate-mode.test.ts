import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { createRequire } from 'node:module';
import { clearRequireCache, withModuleMock } from './helpers/module-mock';
import {
  API_KEY_STORAGE_KEYS,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  OLLAMA_DEFAULT_HOST,
} from '../models';

const MODULE_PATH = path.resolve(__dirname, '..', 'side-panel-provider');

type MessageHandler = (data: any) => Promise<void> | void;

type Harness = {
  sendMessage: (message: unknown) => Promise<void>;
  postedMessages: any[];
  commandCalls: any[][];
  state: Map<string, unknown>;
  dispose: () => void;
};

async function createHarness(
  initialState?: Record<string, unknown>,
  initialSecrets?: Record<string, string>,
): Promise<Harness> {
  clearRequireCache(MODULE_PATH);

  const postedMessages: any[] = [];
  const commandCalls: any[][] = [];
  const state = new Map<string, unknown>(Object.entries(initialState || {}));
  const secrets = new Map<string, string>(Object.entries(initialSecrets || {}));

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
    Uri: {
      joinPath: (base: { fsPath: string }, ...paths: string[]) => ({
        fsPath: path.join(base.fsPath, ...paths),
      }),
    },
    extensions: {
      getExtension: () => undefined,
    },
    commands: {
      executeCommand: async (...args: any[]) => {
        commandCalls.push(args);
        return undefined;
      },
    },
    window: {
      showWarningMessage: async () => undefined,
      showInformationMessage: async () => undefined,
      showErrorMessage: async () => undefined,
    },
  };

  const mod = await withModuleMock('vscode', vscodeMock, async () => {
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(MODULE_PATH) as typeof import('../side-panel-provider');
  });

  const context = {
    globalState: {
      get: <T>(key: string) => state.get(key) as T | undefined,
      update: async (key: string, value: unknown) => {
        state.set(key, value);
      },
    },
    secrets: {
      get: async (key: string) => secrets.get(key),
      store: async (key: string, value: string) => {
        secrets.set(key, value);
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
    commandCalls,
    state,
    dispose: () => {
      disposeHandler?.();
    },
  };
}

test('getGenerateMode returns default agentic mode when unset', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({ type: 'getGenerateMode' });
    const modeMessage = harness.postedMessages.find(
      (message) => message.type === 'currentGenerateMode',
    );

    assert.ok(modeMessage);
    assert.equal(modeMessage.generateMode, 'agentic');
  } finally {
    harness.dispose();
  }
});

test('saveGenerateMode persists normalized mode and getGenerateMode returns it', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({
      type: 'saveGenerateMode',
      value: 'direct-diff',
    });
    assert.equal(harness.state.get('GENERATE_MODE'), 'direct-diff');

    await harness.sendMessage({ type: 'getGenerateMode' });
    const modeMessages = harness.postedMessages.filter(
      (message) => message.type === 'currentGenerateMode',
    );
    const modeMessage = modeMessages[modeMessages.length - 1];
    assert.ok(modeMessage);
    assert.equal(modeMessage.generateMode, 'direct-diff');

    await harness.sendMessage({
      type: 'saveGenerateMode',
      value: 'unexpected-value',
    });
    assert.equal(harness.state.get('GENERATE_MODE'), 'agentic');
  } finally {
    harness.dispose();
  }
});

test('generate forwards normalized generateMode to command payload', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({
      type: 'generate',
      generateMode: 'direct-diff',
      commitOutputOptions: {
        includeScope: false,
        includeBody: false,
        includeFooter: true,
      },
    });
    await harness.sendMessage({ type: 'generate', generateMode: 'unknown' });

    const generateCalls = harness.commandCalls.filter(
      (call) => call[0] === 'commit-copilot.generate',
    );
    assert.equal(generateCalls.length, 2);
    assert.deepEqual(generateCalls[0], [
      'commit-copilot.generate',
      {
        generateMode: 'direct-diff',
        commitOutputOptions: {
          includeScope: false,
          includeBody: false,
          includeFooter: true,
        },
      },
    ]);
    assert.deepEqual(generateCalls[1], [
      'commit-copilot.generate',
      {
        generateMode: 'agentic',
        commitOutputOptions: DEFAULT_COMMIT_OUTPUT_OPTIONS,
      },
    ]);

    const doneMessages = harness.postedMessages.filter(
      (message) => message.type === 'generationDone',
    );
    assert.equal(doneMessages.length, 2);
  } finally {
    harness.dispose();
  }
});

test('getCommitOutputOptions returns defaults when unset', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({ type: 'getCommitOutputOptions' });
    const optionsMessage = harness.postedMessages.find(
      (message) => message.type === 'currentCommitOutputOptions',
    );

    assert.ok(optionsMessage);
    assert.deepEqual(
      optionsMessage.commitOutputOptions,
      DEFAULT_COMMIT_OUTPUT_OPTIONS,
    );
  } finally {
    harness.dispose();
  }
});

test('saveCommitOutputOptions persists normalized values', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({
      type: 'saveCommitOutputOptions',
      value: {
        includeScope: false,
        includeBody: false,
        includeFooter: true,
      },
    });
    assert.deepEqual(harness.state.get('COMMIT_OUTPUT_OPTIONS'), {
      includeScope: false,
      includeBody: false,
      includeFooter: true,
    });

    await harness.sendMessage({
      type: 'saveCommitOutputOptions',
      value: {
        includeScope: 'yes',
      },
    });
    assert.deepEqual(harness.state.get('COMMIT_OUTPUT_OPTIONS'), {
      includeScope: DEFAULT_COMMIT_OUTPUT_OPTIONS.includeScope,
      includeBody: DEFAULT_COMMIT_OUTPUT_OPTIONS.includeBody,
      includeFooter: DEFAULT_COMMIT_OUTPUT_OPTIONS.includeFooter,
    });
  } finally {
    harness.dispose();
  }
});

test('getAllKeys reports ollama as not configured when no secret exists', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({ type: 'getAllKeys' });
    const statusMessage = harness.postedMessages.find(
      (message) => message.type === 'allKeyStatuses',
    );

    assert.ok(statusMessage);
    assert.deepEqual(statusMessage.statuses, {
      google: false,
      openai: false,
      anthropic: false,
      ollama: false,
    });
  } finally {
    harness.dispose();
  }
});

test('checkKey returns stored Ollama host value', async () => {
  const customHost = 'http://192.168.1.100:11434';
  const harness = await createHarness(undefined, {
    [API_KEY_STORAGE_KEYS.ollama]: customHost,
  });

  try {
    await harness.sendMessage({ type: 'checkKey', provider: 'ollama' });
    const statusMessage = harness.postedMessages.find(
      (message) =>
        message.type === 'keyStatus' && message.provider === 'ollama',
    );

    assert.ok(statusMessage);
    assert.equal(statusMessage.hasKey, true);
    assert.equal(statusMessage.value, customHost);
  } finally {
    harness.dispose();
  }
});

test('checkKey returns default Ollama host value when secret is missing', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({ type: 'checkKey', provider: 'ollama' });
    const statusMessage = harness.postedMessages.find(
      (message) =>
        message.type === 'keyStatus' && message.provider === 'ollama',
    );

    assert.ok(statusMessage);
    assert.equal(statusMessage.hasKey, false);
    assert.equal(statusMessage.value, OLLAMA_DEFAULT_HOST);
  } finally {
    harness.dispose();
  }
});
