import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type * as vscode from 'vscode';

import { DISPLAY_LANGUAGE_STATE_KEY } from '../i18n';
import { CUSTOM_PROVIDERS_STATE_KEY } from '../models';

import { clearRequireCache, withModuleMock } from './helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '..', 'main-view-provider');

interface BootstrapPayload extends Record<string, unknown> {
  initialDisplayLanguage: string;
  initialEffectiveLanguage: string;
  initialScreen: string;
  customProviderPrefix: string;
  customProviders: unknown[];
  providers: Record<string, unknown>;
  generateModes: Record<string, unknown>;
  modelsByProvider: Record<string, unknown>;
  displayLanguageOptions: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toBootstrapPayload(value: unknown): BootstrapPayload | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.initialDisplayLanguage !== 'string' ||
    typeof value.initialEffectiveLanguage !== 'string' ||
    typeof value.initialScreen !== 'string' ||
    typeof value.customProviderPrefix !== 'string' ||
    !Array.isArray(value.customProviders) ||
    !isRecord(value.providers) ||
    !isRecord(value.generateModes) ||
    !isRecord(value.modelsByProvider) ||
    !Array.isArray(value.displayLanguageOptions)
  ) {
    return null;
  }
  return value as BootstrapPayload;
}

void test('webview html shell includes nonce/csp/assets and bootstrap payload', async () => {
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
      executeCommand: () => Promise.resolve(undefined),
    },
    window: {
      showWarningMessage: () => Promise.resolve(undefined),
      showInformationMessage: () => Promise.resolve(undefined),
      showErrorMessage: () => Promise.resolve(undefined),
    },
  };

  const mod = await withModuleMock('vscode', vscodeMock, () => {
    clearRequireCache(MODULE_PATH);
    const dynamicRequire = createRequire(__filename);
    return dynamicRequire(
      MODULE_PATH,
    ) as typeof import('../main-view-provider');
  });

  const state = new Map<string, unknown>([
    [
      CUSTOM_PROVIDERS_STATE_KEY,
      [{ id: 'acme', name: 'Acme Provider', baseUrl: 'https://acme.example' }],
    ],
    [DISPLAY_LANGUAGE_STATE_KEY, 'ja'],
  ]);

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

  const provider = new mod.MainViewProvider(
    { fsPath: process.cwd() } as unknown as vscode.Uri,
    context,
  );
  provider.resolveWebviewView(
    webviewView as unknown as vscode.WebviewView,
    {} as vscode.WebviewViewResolveContext,
    {} as vscode.CancellationToken,
  );

  assert.match(webview.html, /<div id="root"><\/div>/);
  assert.match(
    webview.html,
    /<link rel="stylesheet" href="mock-webview:\/\/.*\/out\/webview\/main-view\.css"/,
  );

  const inlineNonceMatch =
    /<script nonce="([0-9a-f]+)">\s*window\.__COMMIT_COPILOT_WEBVIEW_BOOTSTRAP__/.exec(
      webview.html,
    );
  assert.ok(inlineNonceMatch);
  const nonce = inlineNonceMatch[1];

  assert.match(
    webview.html,
    new RegExp(
      `<script nonce="${nonce}" src="mock-webview://.*/out/webview/main-view\\.js"></script>`,
    ),
  );
  assert.match(webview.html, new RegExp(`script-src 'nonce-${nonce}'`));
  assert.match(
    webview.html,
    new RegExp(`style-src mock-csp-source 'nonce-${nonce}'`),
  );
  assert.match(
    webview.html,
    new RegExp(
      `<link rel="stylesheet" href="mock-webview://.*/out/webview/main-view\\.css" nonce="${nonce}"`,
    ),
  );

  const bootstrapLine = webview.html
    .split('\n')
    .find((line) =>
      line.includes('window.__COMMIT_COPILOT_WEBVIEW_BOOTSTRAP__'),
    );
  assert.ok(bootstrapLine);

  const assignmentToken = 'window.__COMMIT_COPILOT_WEBVIEW_BOOTSTRAP__ = ';
  const assignmentStart = bootstrapLine.indexOf(assignmentToken);
  assert.equal(assignmentStart >= 0, true);
  const statementEnd = bootstrapLine.lastIndexOf(';');
  assert.equal(statementEnd > assignmentStart, true);
  const payloadText = bootstrapLine
    .slice(assignmentStart + assignmentToken.length, statementEnd)
    .trim();
  const parsedBootstrap: unknown = JSON.parse(payloadText);
  const bootstrap = toBootstrapPayload(parsedBootstrap);
  if (!bootstrap) {
    throw new Error('Failed to parse bootstrap payload');
  }

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
