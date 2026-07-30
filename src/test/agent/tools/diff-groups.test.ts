import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDiffInvestigationPlan,
  formatSelectedDiff,
  parseDiffFileBlocks,
} from '../../../agent/tools/diff-groups';
import { executeGetDiff } from '../../../agent/tools/executors/get-diff';

const mixedChangeAlignedLocaleCount = 19;
const mixedChangeUnrelatedFileCount = 10;
const localizedAdditionFileCount = 12;

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

void test('groups generic patch shapes and leaves extra edits standalone', () => {
  const diff = [
    makeModifiedDiff('locales/en.ts', ['-  title: "Old",', '+  title: "New",']),
    makeModifiedDiff('locales/ja.ts', [
      '-  title: "古い",',
      '+  title: "新しい",',
    ]),
    makeModifiedDiff('locales/fr.ts', [
      '-  title: "Ancien",',
      '+  title: "Nouveau",',
      '+  refund: "Remboursement",',
    ]),
    makeModifiedDiff('src/service.ts', ['-return false;', '+return true;']),
  ].join('\n');

  const plan = buildDiffInvestigationPlan(diff);
  assert.equal(plan.groups.length, 1);
  assert.deepEqual(plan.groups[0].paths, ['locales/en.ts', 'locales/ja.ts']);
  assert.deepEqual(plan.standalonePaths, ['locales/fr.ts', 'src/service.ts']);
});

void test('does not force unrelated prose changes into a group', () => {
  const diff = [
    makeModifiedDiff('articles/a.txt', [
      '-The original conclusion.',
      '+A substantially different conclusion.',
    ]),
    makeModifiedDiff('articles/b.txt', [
      '-Historical background.',
      '+Corrected dates and sources.',
    ]),
  ].join('\n');

  const plan = buildDiffInvestigationPlan(diff);
  assert.deepEqual(plan.groups, []);
  assert.deepEqual(plan.standalonePaths, ['articles/a.txt', 'articles/b.txt']);
});

void test('multi-file get_diff preserves structural outliers', () => {
  const diff = [
    makeModifiedDiff('locales/en.ts', ['-  title: "Old",', '+  title: "New",']),
    makeModifiedDiff('locales/ja.ts', [
      '-  title: "古い",',
      '+  title: "新しい",',
    ]),
    makeModifiedDiff('locales/fr.ts', [
      '-  title: "Ancien",',
      '+  title: "Nouveau",',
      '+  refund: "Remboursement",',
    ]),
  ].join('\n');

  const result = executeGetDiff(
    '',
    {
      paths: ['locales/en.ts', 'locales/ja.ts', 'locales/fr.ts'],
    },
    diff,
  );

  assert.match(result, /locales\/fr\.ts/);
  assert.match(result, /refund: "Remboursement"/);
});

void test('uses a harness-verified structural summary only when it is smaller', () => {
  const diff = Array.from({ length: 12 }, (_, index) =>
    makeModifiedDiff(`locales/lang-${String(index)}.ts`, [
      '-export const messages = {',
      `-  title: "Old title ${String(index)}",`,
      `-  body: "Old body ${String(index)}",`,
      '+export const messages = {',
      `+  title: "New title ${String(index)}",`,
      `+  body: "New body ${String(index)}",`,
    ]),
  ).join('\n');
  const blocks = parseDiffFileBlocks(diff);
  const result = formatSelectedDiff(blocks, true);

  assert.match(result, /Harness-verified structural diff group/);
  assert.match(result, /Exact-patch set SHA-256/);
  assert.match(result, /Representative exact diff/);
  assert.ok(result.length < diff.length);
});

void test('ignores unrelated hunk context when detecting the same edit structure', () => {
  const makeLocalizedAddition = (
    path: string,
    existingTranslation: string,
    addedTranslation: string,
  ): string =>
    [
      `diff --git a/${path} b/${path}`,
      `--- a/${path}`,
      `+++ b/${path}`,
      '@@ -1,3 +1,5 @@',
      ` context: "${existingTranslation}",`,
      ' toolDescGetDiff:',
      `   '- ${existingTranslation}',`,
      '+ toolDescGetDiffBatch:',
      `+  '- ${addedTranslation}',`,
      ' nextKey: true,',
    ].join('\n');

  const diff = Array.from({ length: localizedAdditionFileCount }, (_, index) =>
    makeLocalizedAddition(
      `locales/lang-${String(index)}.ts`,
      `Existing translation ${String(index)}`,
      `Localized batch guidance ${String(index)}`,
    ),
  ).join('\n');
  const plan = buildDiffInvestigationPlan(diff);
  const result = formatSelectedDiff(parseDiffFileBlocks(diff), true);

  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0].paths.length, localizedAdditionFileCount);
  assert.match(result, /Harness-verified structural diff group/);
  assert.ok(result.length < diff.length);
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

void test('finds one structural exception among twenty similar files in a mixed thirty-file change', () => {
  const localeDiffs = Array.from(
    { length: mixedChangeAlignedLocaleCount },
    (_, index) =>
      makeModifiedDiff(`locales/lang-${String(index)}.ts`, [
        `-title: "Old ${String(index)}"`,
        `+title: "New ${String(index)}"`,
      ]),
  );
  localeDiffs.push(
    makeModifiedDiff('locales/special.ts', [
      '-title: "Old special"',
      '+title: "New special"',
      '+refund: "Special-only change"',
    ]),
  );
  const unrelatedDiffs = Array.from(
    { length: mixedChangeUnrelatedFileCount },
    (_, index) =>
      makeModifiedDiff(`articles/article-${String(index)}.txt`, [
        `-original prose variant ${String(index)}${'!'.repeat(index + 1)}`,
        `+rewritten prose variant ${String(index)}${'?'.repeat(index + 1)}`,
      ]),
  );

  const plan = buildDiffInvestigationPlan(
    [...localeDiffs, ...unrelatedDiffs].join('\n'),
  );
  const localeGroup = plan.groups.find(
    (group) => group.paths.length === mixedChangeAlignedLocaleCount,
  );

  assert.ok(localeGroup);
  assert.equal(localeGroup.paths.includes('locales/special.ts'), false);
  assert.equal(plan.standalonePaths.includes('locales/special.ts'), true);
});
