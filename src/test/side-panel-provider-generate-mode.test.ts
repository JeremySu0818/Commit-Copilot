import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { clearRequireCache, withModuleMock } from './helpers/module-mock';
import { DEFAULT_COMMIT_OUTPUT_OPTIONS } from '../models';

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
): Promise<Harness> {
  clearRequireCache(MODULE_PATH);

  const postedMessages: any[] = [];
  const commandCalls: any[][] = [];
  const state = new Map<string, unknown>(Object.entries(initialState || {}));

  let messageHandler: MessageHandler | null = null;
  let disposeHandler: (() => void) | null = null;

  const webview = {
    cspSource: 'mock-csp-source',
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
        fsPath: require('path').join(base.fsPath, ...paths),
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
    return require(MODULE_PATH) as typeof import('../side-panel-provider');
  });

  const context = {
    globalState: {
      get: <T>(key: string) => state.get(key) as T | undefined,
      update: async (key: string, value: unknown) => {
        state.set(key, value);
      },
    },
    secrets: {
      get: async () => undefined,
      store: async () => {},
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

    assert.equal(harness.commandCalls.length, 2);
    assert.deepEqual(harness.commandCalls[0], [
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
    assert.deepEqual(harness.commandCalls[1], [
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
