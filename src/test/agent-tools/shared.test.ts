import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBooleanArg,
  parseIntegerArg,
  truncateSnippet,
} from '../../agent-tools/executors/shared';

test('parseIntegerArg parses numeric strings and numbers', () => {
  assert.equal(parseIntegerArg(4.9), 4);
  assert.equal(parseIntegerArg(' 12 '), 12);
  assert.equal(parseIntegerArg('abc'), null);
  assert.equal(parseIntegerArg(''), null);
});

test('parseBooleanArg parses bool-like values', () => {
  assert.equal(parseBooleanArg(true), true);
  assert.equal(parseBooleanArg(0), false);
  assert.equal(parseBooleanArg('YES'), true);
  assert.equal(parseBooleanArg('no'), false);
  assert.equal(parseBooleanArg('x'), null);
});

test('truncateSnippet trims and truncates long text', () => {
  assert.equal(truncateSnippet('  abc  ', 10), 'abc');
  assert.equal(truncateSnippet('abcdefghij', 8), 'abcde...');
});
