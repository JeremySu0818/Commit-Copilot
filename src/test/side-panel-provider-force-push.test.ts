import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type * as vscode from 'vscode';

import { clearRequireCache, withModuleMock } from './helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '..', 'side-panel-provider');
const pushWithLeaseCommandId = 'git.pushForceWithLease';
const pushWithLeaseConfirmAction = 'Push with Lease';

type MessageHandler = (data: unknown) => Promise<void> | void;
type PostedMessage = Record<string, unknown>;
type CommandCall = unknown[];

interface HarnessOptions {
  confirmSelection?: string;
  availableCommands?: string[];
  pushError?: Error;
}

interface Harness {
  sendMessage: (message: unknown) => Promise<void>;
  postedMessages: PostedMessage[];
  commandCalls: CommandCall[];
  warningMessages: string[];
  infoMessages: string[];
  errorMessages: string[];
  repository: unknown;
  dispose: () => void;
}

interface ForcePushStatusMessage extends PostedMessage {
  type: 'forcePushStatus';
  status: string;
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toPostedMessage(value: unknown): PostedMessage | null {
  return isRecord(value) ? value : null;
}

function isForcePushStatusMessage(
  value: PostedMessage,
): value is ForcePushStatusMessage {
  return (
    value.type === 'forcePushStatus' && typeof value.status === 'string'
  );
}

async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  clearRequireCache(MODULE_PATH);

  const postedMessages: PostedMessage[] = [];
  const commandCalls: CommandCall[] = [];
  const warningMessages: string[] = [];
  const infoMessages: string[] = [];
  const errorMessages: string[] = [];
  const state = new Map<string, unknown>();

  let messageHandler: MessageHandler = (_data: unknown) => {
    return;
  };
  let disposeHandler: (() => void) | null = null;

  const noop = (): void => {
    return;
  };

  const repository = {
    rootUri: {
      fsPath: process.cwd(),
      toString: () => `file://${process.cwd().replace(/\\/g, '/')}`,
    },
    state: {
      workingTreeChanges: [],
      indexChanges: [],
      untrackedChanges: [],
      HEAD: {
        name: 'main',
        detached: false,
        upstream: {
          remote: 'origin',
          name: 'main',
        },
      },
      onDidChange: () => ({ dispose: noop }),
    },
  };

  const gitApi = {
    repositories: [repository],
    state: 'initialized',
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
      getExtension: (id: string) => {
        if (id !== 'vscode.git') {
          return undefined;
        }
        return {
          isActive: true,
          exports: {
            getAPI: () => gitApi,
          },
        };
      },
    },
    commands: {
      executeCommand: (...args: unknown[]) => {
        commandCalls.push(args);
        if (
          args[0] === pushWithLeaseCommandId &&
          options.pushError instanceof Error
        ) {
          return Promise.reject(options.pushError);
        }
        return Promise.resolve(undefined);
      },
      getCommands: () =>
        Promise.resolve(options.availableCommands ?? [pushWithLeaseCommandId]),
    },
    window: {
      activeTextEditor: undefined,
      showWarningMessage: (message: string) => {
        warningMessages.push(message);
        return Promise.resolve(options.confirmSelection);
      },
      showInformationMessage: (message: string) => {
        infoMessages.push(message);
        return Promise.resolve(undefined);
      },
      showErrorMessage: (message: string) => {
        errorMessages.push(message);
        return Promise.resolve(undefined);
      },
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
      get: () => Promise.resolve(undefined),
      store: () => Promise.resolve(),
      delete: () => Promise.resolve(),
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
    infoMessages,
    errorMessages,
    repository,
    dispose: () => {
      disposeHandler?.();
    },
  };
}

void test('forcePushWithLease confirms and executes Git command', async () => {
  const harness = await createHarness({
    confirmSelection: pushWithLeaseConfirmAction,
  });

  try {
    await harness.sendMessage({ type: 'forcePushWithLease' });

    const pushCalls = harness.commandCalls.filter(
      (call) => call[0] === pushWithLeaseCommandId,
    );
    assert.equal(pushCalls.length, 1);
    assert.equal(pushCalls[0]?.[1], harness.repository);
    assert.match(harness.warningMessages[0] ?? '', /origin\/main/);

    const statuses = harness.postedMessages
      .filter((message) => isForcePushStatusMessage(message))
      .map((message) => message.status);
    assert.deepEqual(statuses, ['running', 'success']);
    assert.match(
      harness.infoMessages[0] ?? '',
      /Force push with lease completed/i,
    );
  } finally {
    harness.dispose();
  }
});

void test('forcePushWithLease cancellation does not execute Git command', async () => {
  const harness = await createHarness({ confirmSelection: undefined });

  try {
    await harness.sendMessage({ type: 'forcePushWithLease' });

    const pushCalls = harness.commandCalls.filter(
      (call) => call[0] === pushWithLeaseCommandId,
    );
    assert.equal(pushCalls.length, 0);

    const statusMessage = harness.postedMessages.find((message) => {
      return isForcePushStatusMessage(message) && message.status === 'idle';
    });
    assert.ok(statusMessage);
    assert.equal(harness.infoMessages.length, 0);
    assert.equal(harness.errorMessages.length, 0);
  } finally {
    harness.dispose();
  }
});

void test('forcePushWithLease reports command unavailability', async () => {
  const harness = await createHarness({
    confirmSelection: pushWithLeaseConfirmAction,
    availableCommands: ['git.push'],
  });

  try {
    await harness.sendMessage({ type: 'forcePushWithLease' });

    const pushCalls = harness.commandCalls.filter(
      (call) => call[0] === pushWithLeaseCommandId,
    );
    assert.equal(pushCalls.length, 0);
    assert.match(harness.errorMessages[0] ?? '', /unavailable/i);

    const statusMessage = harness.postedMessages.find((message) => {
      return isForcePushStatusMessage(message) && message.status === 'error';
    });
    assert.ok(statusMessage);
  } finally {
    harness.dispose();
  }
});
