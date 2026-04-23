import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const EXTENSION_PATH = path.resolve(process.cwd(), 'src', 'extension.ts');

void test('rewrite command checks API key before commit selection', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');
  const functionStart = source.indexOf('async function executeRewriteCommand');
  const functionEnd = source.indexOf(
    'function getPushTargetLabel',
    functionStart,
  );

  assert.notEqual(functionStart, -1);
  assert.notEqual(functionEnd, -1);

  const functionBody = source.slice(functionStart, functionEnd);
  const ensureApiKeyIndex = functionBody.indexOf(
    'const hasApiKey = await ensureProviderApiKey(',
  );
  const selectCommitIndex = functionBody.indexOf(
    'const targetCommit = await selectRewriteCommit(repository, text);',
  );

  assert.notEqual(ensureApiKeyIndex, -1);
  assert.notEqual(selectCommitIndex, -1);
  assert.equal(ensureApiKeyIndex < selectCommitIndex, true);
});

void test('rewrite command enforces rewrite preflight safety before commit selection', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');
  const functionStart = source.indexOf('async function executeRewriteCommand');
  const functionEnd = source.indexOf(
    'function getPushTargetLabel',
    functionStart,
  );

  assert.notEqual(functionStart, -1);
  assert.notEqual(functionEnd, -1);

  const functionBody = source.slice(functionStart, functionEnd);
  const preflightIndex = functionBody.indexOf(
    'const preflightPassed = await ensureRewritePreflightSafety(',
  );
  const selectCommitIndex = functionBody.indexOf(
    'const targetCommit = await selectRewriteCommit(repository, text);',
  );

  assert.notEqual(preflightIndex, -1);
  assert.notEqual(selectCommitIndex, -1);
  assert.equal(preflightIndex < selectCommitIndex, true);
});

void test('rewrite command does not force agentic mode', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');
  const functionStart = source.indexOf('async function executeRewriteCommand');
  const functionEnd = source.indexOf(
    'function getPushTargetLabel',
    functionStart,
  );

  assert.notEqual(functionStart, -1);
  assert.notEqual(functionEnd, -1);

  const functionBody = source.slice(functionStart, functionEnd);
  assert.equal(
    functionBody.includes("providerContext.llmProvider,\n    'agentic',"),
    false,
  );
});

void test('rewrite command acquires generation lock before async work', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');
  const functionStart = source.indexOf('async function executeRewriteCommand');
  const functionEnd = source.indexOf(
    'function getPushTargetLabel',
    functionStart,
  );

  assert.notEqual(functionStart, -1);
  assert.notEqual(functionEnd, -1);

  const functionBody = source.slice(functionStart, functionEnd);
  const tryStartIndex = functionBody.indexOf(
    'GenerationStateManager.tryStart()',
  );
  const firstAwaitIndex = functionBody.indexOf('await ');

  assert.notEqual(tryStartIndex, -1);
  assert.notEqual(firstAwaitIndex, -1);
  assert.equal(tryStartIndex < firstAwaitIndex, true);
});

void test('generate command acquires generation lock before async work', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');
  const functionStart = source.indexOf('async function executeGenerateCommand');
  const functionEnd = source.indexOf('export function activate', functionStart);

  assert.notEqual(functionStart, -1);
  assert.notEqual(functionEnd, -1);

  const functionBody = source.slice(functionStart, functionEnd);
  const tryStartIndex = functionBody.indexOf(
    'GenerationStateManager.tryStart()',
  );
  const firstAwaitIndex = functionBody.indexOf('await ');

  assert.notEqual(tryStartIndex, -1);
  assert.notEqual(firstAwaitIndex, -1);
  assert.equal(tryStartIndex < firstAwaitIndex, true);
});

void test('force push flow keeps CLI primary path with VS Code auth fallback', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');

  assert.match(
    source,
    /const pushWithLeaseCommandId = 'git\.pushForceWithLease'/,
  );
  assert.match(source, /isCredentialOrPromptError\(rawErrorMessage\)/);
  assert.match(source, /runForcePushWithLeaseCommand\(/);
  assert.match(source, /verifyImplicitLeaseFallbackIsStillSafe\(/);
});

void test('explicit lease failures retry with current lease only after confirming remote still matches', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');

  assert.match(source, /readLiveRemoteHeadHash\(/);
  assert.match(
    source,
    /liveRemoteHeadHash !== normalizedExpectedHash[\s\S]*leaseMode: \{ kind: 'current' \}/,
  );
});

void test('lease conflict flow avoids auto-sync automation and keeps manual recovery only', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');

  assert.doesNotMatch(source, /readRewriteAutoSyncPreview\(/);
  assert.doesNotMatch(source, /rewriteAutoSyncPromptWithUpstream\(upstreamRef\)/);
  assert.doesNotMatch(source, /attemptAutoSyncAndRetryPush\(/);
});
