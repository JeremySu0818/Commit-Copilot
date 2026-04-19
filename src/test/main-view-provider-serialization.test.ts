import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type * as vscode from 'vscode';

import { clearRequireCache, withModuleMock } from './helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '..', 'main-view-provider');
const lineSeparatorCodePoint = 0x2028;
const paragraphSeparatorCodePoint = 0x2029;

void test('inline script serialization escapes html terminators and unicode separators', async () => {
  clearRequireCache(MODULE_PATH);

  const lineSeparator = String.fromCharCode(lineSeparatorCodePoint);
  const paragraphSeparator = String.fromCharCode(paragraphSeparatorCodePoint);

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

  const modelsMock = {
    DEFAULT_COMMIT_OUTPUT_OPTIONS: {
      includeScope: true,
      includeBody: false,
      includeFooter: false,
    },
    DEFAULT_GENERATE_MODE: 'agentic',
    PROVIDER_DISPLAY_NAMES: {
      test: '</script>&',
    },
    GENERATE_MODE_DISPLAY_NAMES: {
      agentic: 'Agentic',
      'direct-diff': 'Direct Diff',
    },
    MODELS_BY_PROVIDER: {
      test: ['model-1'],
    },
    DEFAULT_MODELS: {
      test: 'model-1',
    },
    DEFAULT_PROVIDER: 'test',
    API_KEY_STORAGE_KEYS: {
      test: 'TEST_API_KEY',
    },
    OLLAMA_DEFAULT_HOST: `http://localhost${lineSeparator}${paragraphSeparator}`,
    normalizeCommitOutputOptions: (value: unknown) => value,
  };

  const mod = await withModuleMock('vscode', vscodeMock, () =>
    withModuleMock('./models', modelsMock, () => {
      clearRequireCache(MODULE_PATH);
      const dynamicRequire = createRequire(__filename);
      return dynamicRequire(
        MODULE_PATH,
      ) as typeof import('../main-view-provider');
    }),
  );

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
    postMessage: () => Promise.resolve(true),
    onDidReceiveMessage: () => ({ dispose: noop }),
  };

  const webviewView = {
    webview,
    onDidDispose: () => ({ dispose: noop }),
  };

  const context = {
    globalState: {
      get: () => undefined,
      update: () => Promise.resolve(),
    },
    secrets: {
      get: () => Promise.resolve(undefined),
      store: () => Promise.resolve(),
    },
  } as unknown as vscode.ExtensionContext;

  const provider = new mod.MainViewProvider(
    { fsPath: process.cwd() } as unknown as vscode.Uri,
    context,
  );
  provider.resolveWebviewView(
    webviewView as unknown as vscode.WebviewView,
    {} as vscode.WebviewViewResolveContext,
    {} as vscode.CancellationToken,
  );

  const bootstrapLine = webview.html
    .split('\n')
    .find((line) =>
      line.includes('window.__COMMIT_COPILOT_WEBVIEW_BOOTSTRAP__'),
    );
  assert.ok(bootstrapLine);
  assert.doesNotMatch(bootstrapLine, /<(?!\/)/);
  assert.match(bootstrapLine, /\\u003C\/script\\u003E\\u0026/);

  assert.equal(bootstrapLine.includes(lineSeparator), false);
  assert.equal(bootstrapLine.includes(paragraphSeparator), false);
  assert.match(bootstrapLine, /\\u2028/);
  assert.match(bootstrapLine, /\\u2029/);
});
