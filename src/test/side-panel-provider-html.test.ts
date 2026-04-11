import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { createRequire } from 'node:module';
import { CUSTOM_PROVIDERS_STATE_KEY } from '../models';
import { DISPLAY_LANGUAGE_STATE_KEY } from '../i18n';
import { clearRequireCache, withModuleMock } from './helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '..', 'side-panel-provider');

test('webview html shell includes nonce/csp/assets and bootstrap payload', async () => {
  clearRequireCache(MODULE_PATH);

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
      executeCommand: async () => undefined,
    },
    window: {
      showWarningMessage: async () => undefined,
      showInformationMessage: async () => undefined,
      showErrorMessage: async () => undefined,
    },
  };

  const mod = await withModuleMock('vscode', vscodeMock, async () => {
    clearRequireCache(MODULE_PATH);
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(MODULE_PATH) as typeof import('../side-panel-provider');
  });

  const state = new Map<string, unknown>([
    [
      CUSTOM_PROVIDERS_STATE_KEY,
      [{ id: 'acme', name: 'Acme Provider', baseUrl: 'https://acme.example' }],
    ],
    [DISPLAY_LANGUAGE_STATE_KEY, 'ja'],
  ]);

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
      get: <T>(key: string) => state.get(key) as T | undefined,
      update: async (key: string, value: unknown) => {
        state.set(key, value);
      },
    },
    secrets: {
      get: async () => undefined,
      store: async () => {},
      delete: async () => {},
    },
  } as any;

  const provider = new mod.SidePanelProvider(
    { fsPath: process.cwd() } as any,
    context,
  );
  provider.resolveWebviewView(webviewView as any, {} as any, {} as any);

  assert.match(webview.html, /<div id="root"><\/div>/);
  assert.match(
    webview.html,
    /<link rel="stylesheet" href="mock-webview:\/\/.*\/out\/webview\/side-panel\.css"/,
  );

  const inlineNonceMatch = webview.html.match(
    /<script nonce="([0-9a-f]+)">\s*window\.__COMMIT_COPILOT_WEBVIEW_BOOTSTRAP__/,
  );
  assert.ok(inlineNonceMatch);
  const nonce = inlineNonceMatch[1];

  assert.match(
    webview.html,
    new RegExp(
      `<script nonce="${nonce}" src="mock-webview://.*/out/webview/side-panel\\.js"></script>`,
    ),
  );
  assert.match(webview.html, new RegExp(`script-src 'nonce-${nonce}'`));
  assert.match(webview.html, /style-src mock-csp-source 'unsafe-inline';/);

  const bootstrapMatch = webview.html.match(
    /window\.__COMMIT_COPILOT_WEBVIEW_BOOTSTRAP__\s*=\s*(.+);/,
  );
  assert.ok(bootstrapMatch);
  const bootstrap = JSON.parse(bootstrapMatch[1]);
  assert.equal(bootstrap.initialDisplayLanguage, 'ja');
  assert.equal(bootstrap.initialEffectiveLanguage, 'ja');
  assert.equal(bootstrap.initialScreen, 'main');
  assert.equal(bootstrap.customProviderPrefix, 'custom:');
  assert.deepEqual(bootstrap.customProviders, [
    { id: 'acme', name: 'Acme Provider', baseUrl: 'https://acme.example' },
  ]);
  assert.ok(bootstrap.providers.google);
  assert.ok(bootstrap.generateModes.agentic);
  assert.ok(Array.isArray(bootstrap.modelsByProvider.google));
  assert.ok(Array.isArray(bootstrap.displayLanguageOptions));
});
