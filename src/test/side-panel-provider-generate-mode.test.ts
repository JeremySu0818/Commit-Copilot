import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type * as vscode from 'vscode';

import {
  API_KEY_STORAGE_KEYS,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  OLLAMA_DEFAULT_HOST,
} from '../models';

import { clearRequireCache, withModuleMock } from './helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '..', 'side-panel-provider');

type MessageHandler = (data: unknown) => Promise<void> | void;
type PostedMessage = Record<string, unknown>;
type CommandCall = unknown[];
const expectedGenerateCallCount = 2;

interface Harness {
  sendMessage: (message: unknown) => Promise<void>;
  postedMessages: PostedMessage[];
  commandCalls: CommandCall[];
  warningMessages: string[];
  state: Map<string, unknown>;
  dispose: () => void;
}

interface CurrentGenerateModeMessage extends PostedMessage {
  type: 'currentGenerateMode';
  generateMode: string;
}

interface CurrentCommitOutputOptionsMessage extends PostedMessage {
  type: 'currentCommitOutputOptions';
  commitOutputOptions: unknown;
}

interface AllKeyStatusesMessage extends PostedMessage {
  type: 'allKeyStatuses';
  statuses: unknown;
}

interface KeyStatusMessage extends PostedMessage {
  type: 'keyStatus';
  provider: string;
  hasKey: boolean;
  value: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toPostedMessage(value: unknown): PostedMessage | null {
  return isRecord(value) ? value : null;
}

function isCurrentGenerateModeMessage(
  message: PostedMessage,
): message is CurrentGenerateModeMessage {
  return (
    message.type === 'currentGenerateMode' &&
    typeof message.generateMode === 'string'
  );
}

function isCurrentCommitOutputOptionsMessage(
  message: PostedMessage,
): message is CurrentCommitOutputOptionsMessage {
  return message.type === 'currentCommitOutputOptions';
}

function isAllKeyStatusesMessage(
  message: PostedMessage,
): message is AllKeyStatusesMessage {
  return message.type === 'allKeyStatuses';
}

function isKeyStatusMessage(
  message: PostedMessage,
  provider: string,
): message is KeyStatusMessage {
  return (
    message.type === 'keyStatus' &&
    message.provider === provider &&
    typeof message.hasKey === 'boolean' &&
    typeof message.value === 'string'
  );
}

async function createHarness(
  initialState?: Record<string, unknown>,
  initialSecrets?: Record<string, string>,
): Promise<Harness> {
  clearRequireCache(MODULE_PATH);

  const postedMessages: PostedMessage[] = [];
  const commandCalls: CommandCall[] = [];
  const warningMessages: string[] = [];
  const state = new Map<string, unknown>(Object.entries(initialState ?? {}));
  const secrets = new Map<string, string>(Object.entries(initialSecrets ?? {}));

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
      executeCommand: (...args: unknown[]) => {
        commandCalls.push(args);
        return Promise.resolve(undefined);
      },
    },
    window: {
      showWarningMessage: (message: string) => {
        warningMessages.push(message);
        return Promise.resolve(undefined);
      },
      showInformationMessage: () => Promise.resolve(undefined),
      showErrorMessage: () => Promise.resolve(undefined),
    },
  };

  const mod = await withModuleMock('vscode', vscodeMock, () => {
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(
      MODULE_PATH,
    ) as typeof import('../side-panel-provider');
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
    },
  } as unknown as vscode.ExtensionContext;

  const provider = new mod.SidePanelProvider(
    { fsPath: process.cwd() } as unknown as vscode.Uri,
    context,
  );
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
    commandCalls,
    warningMessages,
    state,
    dispose: () => {
      disposeHandler?.();
    },
  };
}

void test('getGenerateMode returns default agentic mode when unset', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({ type: 'getGenerateMode' });
    const modeMessage = harness.postedMessages.find((message) =>
      isCurrentGenerateModeMessage(message),
    );
    if (!modeMessage) {
      throw new Error('currentGenerateMode message not found');
    }
    assert.equal(modeMessage.generateMode, 'agentic');
  } finally {
    harness.dispose();
  }
});

void test('saveGenerateMode persists normalized mode and getGenerateMode returns it', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({
      type: 'saveGenerateMode',
      value: 'direct-diff',
    });
    assert.equal(harness.state.get('GENERATE_MODE'), 'direct-diff');

    await harness.sendMessage({ type: 'getGenerateMode' });
    const modeMessages = harness.postedMessages.filter((message) =>
      isCurrentGenerateModeMessage(message),
    );
    const modeMessage = modeMessages.at(-1);
    if (!modeMessage) {
      throw new Error('currentGenerateMode message not found');
    }
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

void test('generate forwards normalized generateMode to command payload', async () => {
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
    assert.equal(generateCalls.length, expectedGenerateCallCount);
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
    assert.equal(doneMessages.length, expectedGenerateCallCount);
  } finally {
    harness.dispose();
  }
});

void test('rewriteCommitMessage forwards to extension command', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({ type: 'rewriteCommitMessage' });

    const rewriteCalls = harness.commandCalls.filter(
      (call) => call[0] === 'commit-copilot.rewriteCommitMessage',
    );
    assert.equal(rewriteCalls.length, 1);
    assert.deepEqual(rewriteCalls[0], ['commit-copilot.rewriteCommitMessage']);
  } finally {
    harness.dispose();
  }
});

void test('showWarning displays only allowlisted warning keys', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({
      type: 'showWarning',
      message: 'Untrusted warning text',
    });
    await harness.sendMessage({
      type: 'showWarning',
      key: 'unknownWarning',
    });
    assert.deepEqual(harness.warningMessages, []);

    await harness.sendMessage({
      type: 'showWarning',
      key: 'modelNameRequired',
    });
    assert.deepEqual(harness.warningMessages, [
      'Please enter a model name before generating.',
    ]);
  } finally {
    harness.dispose();
  }
});

void test('getCommitOutputOptions returns defaults when unset', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({ type: 'getCommitOutputOptions' });
    const optionsMessage = harness.postedMessages.find((message) =>
      isCurrentCommitOutputOptionsMessage(message),
    );
    if (!optionsMessage) {
      throw new Error('currentCommitOutputOptions message not found');
    }
    assert.deepEqual(
      optionsMessage.commitOutputOptions,
      DEFAULT_COMMIT_OUTPUT_OPTIONS,
    );
  } finally {
    harness.dispose();
  }
});

void test('saveCommitOutputOptions persists normalized values', async () => {
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

void test('getAllKeys reports ollama as not configured when no secret exists', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({ type: 'getAllKeys' });
    const statusMessage = harness.postedMessages.find((message) =>
      isAllKeyStatusesMessage(message),
    );
    if (!statusMessage) {
      throw new Error('allKeyStatuses message not found');
    }
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

void test('checkKey returns stored Ollama host value', async () => {
  const customHost = 'https://192.168.1.100:11434';
  const harness = await createHarness(undefined, {
    [API_KEY_STORAGE_KEYS.ollama]: customHost,
  });

  try {
    await harness.sendMessage({ type: 'checkKey', provider: 'ollama' });
    const statusMessage = harness.postedMessages.find((message) =>
      isKeyStatusMessage(message, 'ollama'),
    );
    if (!statusMessage) {
      throw new Error('keyStatus message for ollama not found');
    }
    assert.equal(statusMessage.hasKey, true);
    assert.equal(statusMessage.value, customHost);
  } finally {
    harness.dispose();
  }
});

void test('checkKey returns default Ollama host value when secret is missing', async () => {
  const harness = await createHarness();

  try {
    await harness.sendMessage({ type: 'checkKey', provider: 'ollama' });
    const statusMessage = harness.postedMessages.find((message) =>
      isKeyStatusMessage(message, 'ollama'),
    );
    if (!statusMessage) {
      throw new Error('keyStatus message for ollama not found');
    }
    assert.equal(statusMessage.hasKey, false);
    assert.equal(statusMessage.value, OLLAMA_DEFAULT_HOST);
  } finally {
    harness.dispose();
  }
});
