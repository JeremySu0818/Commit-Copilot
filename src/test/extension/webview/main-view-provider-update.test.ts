import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type * as vscode from 'vscode';

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

void test('MainViewProvider.showUpdateInfo reads and renders update info markdown in a webview panel', async () => {
  clearRequireCache(MODULE_PATH);

  let statCalledUri: string | null = null;
  let readFileCalledUri: string | null = null;
  let webviewPanelCreated = false;
  let webviewTitle = '';
  let webviewHtml = '';

  const vscodeMock = {
    Uri: {
      joinPath: (base: { fsPath: string }, ...paths: string[]) => ({
        fsPath: path.join(base.fsPath, ...paths),
        toString: () => `mock-uri://${path.join(base.fsPath, ...paths)}`,
      }),
    },
    extensions: {
      getExtension: () => undefined,
    },
    commands: {
      executeCommand: () => Promise.resolve(undefined),
    },
    window: {
      createWebviewPanel: (
        _viewType: string,
        title: string,
        _viewColumn: number,
        _options: unknown,
      ) => {
        webviewPanelCreated = true;
        webviewTitle = title;
        const panel = {
          webview: {
            set html(val: string) {
              webviewHtml = val;
            },
            get html() {
              return webviewHtml;
            },
          },
        };
        return panel;
      },
    },
    workspace: {
      fs: {
        stat: (uri: { fsPath: string }) => {
          statCalledUri = uri.fsPath;
          return Promise.resolve({});
        },
        readFile: (uri: { fsPath: string }) => {
          readFileCalledUri = uri.fsPath;
          // Mock Markdown content
          const mockMd = `# Mock Release Notes\n- Feature A\n- Feature B`;
          return Promise.resolve(Buffer.from(mockMd, 'utf8'));
        },
      },
    },
    ViewColumn: {
      One: 1,
    },
  };

  const mod = await withModuleMock('vscode', vscodeMock, () => {
    clearRequireCache(MODULE_PATH);
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(
      MODULE_PATH,
    ) as typeof import('../../../extension/webview/main-view-provider');
  });

  const state = new Map<string, unknown>();

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
    extension: {
      packageJSON: {
        name: 'commit-copilot',
        version: '1.2.3',
        publisher: 'TestPublisher',
        author: { name: 'TestAuthor' },
      },
    },
  } as unknown as vscode.ExtensionContext;

  const provider = new mod.MainViewProvider(
    { fsPath: process.cwd() } as unknown as vscode.Uri,
    context,
  );

  await provider.showUpdateInfo();

  assert.ok(statCalledUri);
  assert.ok((statCalledUri as string).endsWith('en.md')); // defaults to English UI/doc in mock environment
  assert.ok(readFileCalledUri);
  assert.ok((readFileCalledUri as string).endsWith('en.md'));
  assert.ok(webviewPanelCreated);
  assert.match(webviewTitle, /Commit Copilot/);
  assert.match(webviewHtml, /<h1>Mock Release Notes<\/h1>/);
  assert.match(webviewHtml, /<li>Feature A<\/li>/);
});

void test('MainViewProvider.showUpdateInfo falls back to en.md when requested language md file is missing', async () => {
  clearRequireCache(MODULE_PATH);

  const statCalls: string[] = [];
  let readFileCalledUri: string | null = null;
  let webviewPanelCreated = false;
  let webviewTitle = '';
  let webviewHtml = '';

  const vscodeMock = {
    Uri: {
      joinPath: (base: { fsPath: string }, ...paths: string[]) => ({
        fsPath: path.join(base.fsPath, ...paths),
        toString: () => `mock-uri://${path.join(base.fsPath, ...paths)}`,
      }),
    },
    extensions: {
      getExtension: () => undefined,
    },
    commands: {
      executeCommand: () => Promise.resolve(undefined),
    },
    window: {
      createWebviewPanel: (
        _viewType: string,
        title: string,
        _viewColumn: number,
        _options: unknown,
      ) => {
        webviewPanelCreated = true;
        webviewTitle = title;
        const panel = {
          webview: {
            set html(val: string) {
              webviewHtml = val;
            },
            get html() {
              return webviewHtml;
            },
          },
        };
        return panel;
      },
    },
    workspace: {
      fs: {
        stat: (uri: { fsPath: string }) => {
          statCalls.push(uri.fsPath);
          if (uri.fsPath.endsWith('ja.md')) {
            return Promise.reject(new Error('File not found'));
          }
          return Promise.resolve({});
        },
        readFile: (uri: { fsPath: string }) => {
          readFileCalledUri = uri.fsPath;
          const mockMd = `# Mock Release Notes (JA Fallback to EN)\n- Feature J`;
          return Promise.resolve(Buffer.from(mockMd, 'utf8'));
        },
      },
    },
    ViewColumn: {
      One: 1,
    },
  };

  const mod = await withModuleMock('vscode', vscodeMock, () => {
    clearRequireCache(MODULE_PATH);
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(
      MODULE_PATH,
    ) as typeof import('../../../extension/webview/main-view-provider');
  });

  const state = new Map<string, unknown>();
  // set display language to 'ja' so it looks for ja.md first
  state.set('DISPLAY_LANGUAGE', 'ja');

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
    extension: {
      packageJSON: {
        name: 'commit-copilot',
        version: '1.2.3',
        publisher: 'TestPublisher',
        author: { name: 'TestAuthor' },
      },
    },
  } as unknown as vscode.ExtensionContext;

  const provider = new mod.MainViewProvider(
    { fsPath: process.cwd() } as unknown as vscode.Uri,
    context,
  );

  await provider.showUpdateInfo();

  const expectedCalls = 1;
  assert.equal(statCalls.length, expectedCalls);
  assert.ok(statCalls[0].endsWith('ja.md'));
  assert.ok(readFileCalledUri);
  assert.ok((readFileCalledUri as string).endsWith('en.md'));
  assert.ok(webviewPanelCreated);
  assert.match(webviewTitle, /Commit Copilot/);
  assert.match(
    webviewHtml,
    /<h1>Mock Release Notes \(JA Fallback to EN\)<\/h1>/,
  );
});

void test('MainViewProvider.openAboutView updates screen to about and posts message to webview', async () => {
  clearRequireCache(MODULE_PATH);

  const postedMessages: unknown[] = [];
  let showCalled = false;

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
  };

  const mod = await withModuleMock('vscode', vscodeMock, () => {
    clearRequireCache(MODULE_PATH);
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(
      MODULE_PATH,
    ) as typeof import('../../../extension/webview/main-view-provider');
  });

  const state = new Map<string, unknown>();
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
    extension: {
      packageJSON: {
        name: 'commit-copilot',
        version: '1.2.3',
        publisher: 'TestPublisher',
        author: { name: 'TestAuthor' },
      },
    },
  } as unknown as vscode.ExtensionContext;

  const provider = new mod.MainViewProvider(
    { fsPath: process.cwd() } as unknown as vscode.Uri,
    context,
  );

  const noop = (): void => {
    // No-op for testing
  };
  const webview = {
    cspSource: 'mock-csp-source',
    asWebviewUri: (uri: { fsPath: string }) => ({
      toString: () => `mock-webview://${uri.fsPath.replace(/\\/g, '/')}`,
    }),
    options: undefined as unknown,
    html: '',
    postMessage: (msg: unknown) => {
      postedMessages.push(msg);
      return Promise.resolve(true);
    },
    onDidReceiveMessage: () => ({ dispose: noop }),
  };

  const webviewView = {
    webview,
    onDidDispose: () => ({ dispose: noop }),
    show: () => {
      showCalled = true;
    },
  };

  provider.resolveWebviewView(
    webviewView as unknown as vscode.WebviewView,
    {} as vscode.WebviewViewResolveContext,
    {} as vscode.CancellationToken,
  );

  provider.openAboutView();

  assert.equal(showCalled, true);
  assert.deepEqual(postedMessages, [{ type: 'openAboutView' }]);
});

void test('MainViewProvider webview handles showUpdateNotes message by showing update info', async () => {
  clearRequireCache(MODULE_PATH);

  let messageHandler: ((message: unknown) => void | Promise<void>) | null =
    null;
  let webviewPanelCreated = false;

  const vscodeMock = {
    Uri: {
      joinPath: (base: { fsPath: string }, ...paths: string[]) => ({
        fsPath: path.join(base.fsPath, ...paths),
        toString: () => `mock-uri://${path.join(base.fsPath, ...paths)}`,
      }),
    },
    extensions: {
      getExtension: () => undefined,
    },
    commands: {
      executeCommand: () => Promise.resolve(undefined),
    },
    window: {
      createWebviewPanel: (
        _viewType: string,
        _title: string,
        _viewColumn: number,
        _options: unknown,
      ) => {
        webviewPanelCreated = true;
        const panel = {
          webview: {
            set html(_val: string) {
              // noop
            },
            get html() {
              return '';
            },
          },
        };
        return panel;
      },
    },
    workspace: {
      fs: {
        stat: () => Promise.resolve({}),
        readFile: () => Promise.resolve(Buffer.from('# Mock', 'utf8')),
      },
    },
    ViewColumn: {
      One: 1,
    },
  };

  const mod = await withModuleMock('vscode', vscodeMock, () => {
    clearRequireCache(MODULE_PATH);
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(
      MODULE_PATH,
    ) as typeof import('../../../extension/webview/main-view-provider');
  });

  const state = new Map<string, unknown>();
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
    extension: {
      packageJSON: {
        name: 'commit-copilot',
        version: '1.2.3',
        publisher: 'TestPublisher',
        author: { name: 'TestAuthor' },
      },
    },
  } as unknown as vscode.ExtensionContext;

  const provider = new mod.MainViewProvider(
    { fsPath: process.cwd() } as unknown as vscode.Uri,
    context,
  );

  const noop = (): void => {
    // no-op for testing
  };
  const webview = {
    cspSource: 'mock-csp-source',
    asWebviewUri: (uri: { fsPath: string }) => ({
      toString: () => `mock-webview://${uri.fsPath.replace(/\\/g, '/')}`,
    }),
    options: undefined as unknown,
    html: '',
    postMessage: () => Promise.resolve(true),
    onDidReceiveMessage: (handler: (msg: unknown) => void | Promise<void>) => {
      messageHandler = handler;
      return { dispose: noop };
    },
  };

  const webviewView = {
    webview,
    onDidDispose: () => ({ dispose: noop }),
  };

  provider.resolveWebviewView(
    webviewView as unknown as vscode.WebviewView,
    {} as vscode.WebviewViewResolveContext,
    {} as vscode.CancellationToken,
  );

  assert.ok(messageHandler);
  const handler = messageHandler as (msg: unknown) => Promise<void>;
  await handler({ type: 'showUpdateNotes' });

  assert.equal(webviewPanelCreated, true);
});
