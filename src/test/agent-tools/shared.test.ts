import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseBooleanArg,
  parseIntegerArg,
  truncateSnippet,
} from '../../agent-tools/executors/shared';

void test('parseIntegerArg parses numeric strings and numbers', () => {
  assert.equal(parseIntegerArg(4.9), 4);
  assert.equal(parseIntegerArg(' 12 '), 12);
  assert.equal(parseIntegerArg('abc'), null);
  assert.equal(parseIntegerArg(''), null);
});

void test('parseBooleanArg parses bool-like values', () => {
  assert.equal(parseBooleanArg(true), true);
  assert.equal(parseBooleanArg(0), false);
  assert.equal(parseBooleanArg('YES'), true);
  assert.equal(parseBooleanArg('no'), false);
  assert.equal(parseBooleanArg('x'), null);
});

void test('truncateSnippet trims and truncates long text', () => {
  assert.equal(truncateSnippet('  abc  ', 10), 'abc');
  assert.equal(truncateSnippet('abcdefghij', 8), 'abcde...');
});
