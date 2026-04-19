import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const MAIN_VIEW_SECTIONS_PATH = path.resolve(
  process.cwd(),
  'src',
  'webview',
  'views',
  'MainViewSections.tsx',
);
const ADVANCED_VIEW_PATH = path.resolve(
  process.cwd(),
  'src',
  'webview',
  'views',
  'AdvancedView.tsx',
);
const MAIN_VIEW_MESSAGE_HANDLER_PATH = path.resolve(
  process.cwd(),
  'src',
  'webview',
  'main-view-message-handler.ts',
);

void test('MainViewSections wires advanced navigation entry', () => {
  const source = readFileSync(MAIN_VIEW_SECTIONS_PATH, 'utf8');
  assert.match(source, /id="openAdvancedViewBtn"/);
  assert.match(source, /pack\.sections\.advancedFeatures/);
  assert.match(source, /pack\.buttons\.openAdvancedFeatures/);
  assert.match(source, /pack\.descriptions\.advancedFeaturesDescription/);
});

void test('AdvancedView wires rewrite action and workflow description', () => {
  const source = readFileSync(ADVANCED_VIEW_PATH, 'utf8');
  assert.match(source, /id="advancedView"/);
  assert.match(source, /id="rewriteCommitMessageBtn"/);
  assert.match(source, /type:\s*'rewriteCommitMessage'/);
  assert.match(source, /pack\.descriptions\.rewriteWorkflowDescription/);
});

void test('message handler syncs host screen context for advanced and settings opens', () => {
  const source = readFileSync(MAIN_VIEW_MESSAGE_HANDLER_PATH, 'utf8');
  assert.match(
    source,
    /openAdvancedView:\s*\(\)\s*=>\s*{[\s\S]*?SET_SCREEN'?,\s*screen:\s*'advanced'[\s\S]*?setCurrentScreen[\s\S]*?value:\s*'advanced'/,
  );
  assert.match(
    source,
    /openSettingsView:\s*\(\)\s*=>\s*{[\s\S]*?SET_SCREEN'?,\s*screen:\s*'settings'[\s\S]*?setCurrentScreen[\s\S]*?value:\s*'settings'/,
  );
});
