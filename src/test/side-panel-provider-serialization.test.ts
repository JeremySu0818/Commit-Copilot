import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { clearRequireCache, withModuleMock } from './helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '..', 'side-panel-provider');

test('inline script serialization escapes html terminators and unicode separators', async () => {
  clearRequireCache(MODULE_PATH);

  const lineSeparator = String.fromCharCode(0x2028);
  const paragraphSeparator = String.fromCharCode(0x2029);

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
      executeCommand: async () => undefined,
    },
    window: {
      showWarningMessage: async () => undefined,
      showInformationMessage: async () => undefined,
      showErrorMessage: async () => undefined,
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

  const mod = await withModuleMock('vscode', vscodeMock, async () =>
    withModuleMock('./models', modelsMock, async () => {
      clearRequireCache(MODULE_PATH);
      return require(MODULE_PATH) as typeof import('../side-panel-provider');
    }),
  );

  const webview = {
    cspSource: 'mock-csp-source',
    asWebviewUri: (uri: { fsPath: string }) => ({
      toString: () => `mock-webview://${uri.fsPath.replace(/\\/g, '/')}`,
    }),
    options: undefined as unknown,
    html: '',
    postMessage: async () => true,
    onDidReceiveMessage: () => ({ dispose: () => {} }),
  };

  const webviewView = {
    webview,
    onDidDispose: () => ({ dispose: () => {} }),
  };

  const context = {
    globalState: {
      get: () => undefined,
      update: async () => {},
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
