import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  fillTemplate,
  renderStatusHtml,
  normalizeGenerateMode,
  normalizeCommitOutputOptions,
  normalizeMaxAgentStepsValue,
  normalizeOllamaHostValue,
} from '../webview/utils';

void test('escapeHtml escapes special characters', () => {
  const input = `<div class="x">A&B's</div>`;
  const output = escapeHtml(input);
  assert.equal(
    output,
    '&lt;div class=&quot;x&quot;&gt;A&amp;B&#39;s&lt;/div&gt;',
  );
});

void test('fillTemplate replaces unknown placeholders with empty text', () => {
  const output = fillTemplate('Hello {name}, {missing}!', { name: 'Commit' });
  assert.equal(output, 'Hello Commit, !');
});

void test('renderStatusHtml escapes status text', () => {
  const output = renderStatusHtml('warning', '<unsafe>');
  assert.equal(
    output,
    '<span class="status-dot warning"></span>&lt;unsafe&gt;',
  );
});

void test('normalizeGenerateMode defaults to agentic', () => {
  assert.equal(normalizeGenerateMode('direct-diff'), 'direct-diff');
  assert.equal(normalizeGenerateMode('unknown-mode'), 'agentic');
  assert.equal(normalizeGenerateMode(undefined), 'agentic');
});

void test('normalizeCommitOutputOptions keeps booleans and falls back to defaults', () => {
  const defaults = {
    includeScope: true,
    includeBody: false,
    includeFooter: true,
  };

  const normalized = normalizeCommitOutputOptions(
    {
      includeScope: false,
      includeBody: 'yes',
    },
    defaults,
  );

  assert.deepEqual(normalized, {
    includeScope: false,
    includeBody: false,
    includeFooter: true,
  });
});

void test('normalizeMaxAgentStepsValue returns positive integer or zero', () => {
  assert.equal(normalizeMaxAgentStepsValue('15'), 15);
  assert.equal(normalizeMaxAgentStepsValue('0012'), 12);
  assert.equal(normalizeMaxAgentStepsValue('0'), 0);
  assert.equal(normalizeMaxAgentStepsValue('-1'), 0);
  assert.equal(normalizeMaxAgentStepsValue('abc'), 0);
});

void test('normalizeOllamaHostValue trims custom host and falls back to default', () => {
  assert.equal(
    normalizeOllamaHostValue('  http://192.168.1.100:11434  ', 'http://d'),
    'http://192.168.1.100:11434',
  );
  assert.equal(
    normalizeOllamaHostValue('   ', 'http://default'),
    'http://default',
  );
});
