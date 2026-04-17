import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseBooleanArg,
  parseIntegerArg,
  truncateSnippet,
} from '../../agent-tools/executors/shared';

const floatingNumberInput = 4.9;
const flooredNumberResult = 4;
const expectedParsedInteger = 12;
const snippetMaxLength = 10;
const truncateLength = 8;

void test('parseIntegerArg parses numeric strings and numbers', () => {
  assert.equal(parseIntegerArg(floatingNumberInput), flooredNumberResult);
  assert.equal(parseIntegerArg(' 12 '), expectedParsedInteger);
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
  assert.equal(truncateSnippet('  abc  ', snippetMaxLength), 'abc');
  assert.equal(truncateSnippet('abcdefghij', truncateLength), 'abcde...');
});
