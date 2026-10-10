import assert from 'node:assert/strict';
import test from 'node:test';

import { formatBatchProgressMessage } from '../../../agent/loop/shared';

void test('get_diff progress shows both path and paths from a single call', () => {
  const message = formatBatchProgressMessage(
    1,
    [
      {
        name: 'get_diff',
        args: {
          path: 'src/teacher.py',
          paths: ['src/teacher.py', 'src/train.py', 'tests/test_teacher.py'],
        },
      },
    ],
    'zh-TW',
  );

  assert.equal(
    message,
    '[步驟 1] 分析 diff：src/teacher.py, src/train.py, tests/test_teacher.py [tools: get_diff]',
  );
});

void test('an empty path does not hide the paths array in get_diff progress', () => {
  const message = formatBatchProgressMessage(1, [
    { name: 'get_diff', args: { path: '', paths: ['src/train.py'] } },
  ]);

  assert.match(message, /src\/train\.py/);
});

void test('get_diff progress retains the fallback for missing paths', () => {
  const message = formatBatchProgressMessage(1, [
    { name: 'get_diff', args: {} },
  ]);

  assert.match(message, /unknown file/);
});
