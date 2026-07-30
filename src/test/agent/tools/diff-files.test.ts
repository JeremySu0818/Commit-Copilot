import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDiffFileBlocks } from '../../../agent/tools/diff-files';
import { executeGetDiff } from '../../../agent/tools/executors/get-diff';

function makeModifiedDiff(path: string, changedLines: string[]): string {
  return [
    `diff --git a/${path} b/${path}`,
    'index 1111111..2222222 100644',
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1,2 +1,2 @@',
    ...changedLines,
  ].join('\n');
}

void test('multi-file get_diff returns every requested exact diff', () => {
  const englishDiff = makeModifiedDiff('locales/en.ts', [
    '-  title: "Old",',
    '+  title: "New",',
  ]);
  const japaneseDiff = makeModifiedDiff('locales/ja.ts', [
    '-  title: "古い",',
    '+  title: "新しい",',
  ]);
  const outlierDiff = makeModifiedDiff('locales/fr.ts', [
    '-  title: "Ancien",',
    '+  title: "Nouveau",',
    '+  refund: "Remboursement",',
  ]);
  const diff = [englishDiff, japaneseDiff, outlierDiff].join('\n');

  const result = executeGetDiff(
    '',
    {
      paths: ['locales/en.ts', 'locales/ja.ts', 'locales/fr.ts'],
    },
    diff,
  );

  assert.equal(result, diff);
});

void test('multi-file get_diff never omits differing quoted or numeric values', () => {
  const accessDiff = makeModifiedDiff('config/access.json', [
    '-"role": "user",',
    '+"role": "admin",',
  ]);
  const timeoutDiff = makeModifiedDiff('config/network.json', [
    '-"timeout": 30,',
    '+"timeout": 60,',
  ]);
  const diff = [accessDiff, timeoutDiff].join('\n');

  const result = executeGetDiff(
    '',
    {
      paths: ['config/access.json', 'config/network.json'],
    },
    diff,
  );

  assert.equal(result, diff);
  assert.match(result, /"role": "admin"/);
  assert.match(result, /"timeout": 60/);
});

void test('single-file get_diff remains backward compatible', () => {
  const diff = makeModifiedDiff('src/a.ts', [
    '-const value = 1;',
    '+const value = 2;',
  ]);
  const result = executeGetDiff('', { path: 'src/a.ts' }, diff);
  assert.equal(result, diff);
});

void test('supports Git-quoted paths without losing Unicode or spaces', () => {
  const diff = [
    'diff --git "a/docs/\\344\\275\\240\\040\\345\\245\\275.txt" "b/docs/\\344\\275\\240\\040\\345\\245\\275.txt"',
    '--- "a/docs/\\344\\275\\240\\040\\345\\245\\275.txt"',
    '+++ "b/docs/\\344\\275\\240\\040\\345\\245\\275.txt"',
    '@@ -1 +1 @@',
    '-old',
    '+new',
  ].join('\n');

  const blocks = parseDiffFileBlocks(diff);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].displayPath, 'docs/你 好.txt');
  const result = executeGetDiff('', { path: 'docs/你 好.txt' }, diff);
  assert.equal(result, diff);
});
