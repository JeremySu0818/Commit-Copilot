import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../retry';

test('withRetry retries retryable errors and then succeeds', async () => {
  let attempts = 0;
  const retryAttempts: number[] = [];

  const result = await withRetry(
    async () => {
      attempts++;
      if (attempts < 3) {
        const err = new Error('rate limit exceeded') as Error & {
          status?: number;
        };
        err.status = 429;
        throw err;
      }
      return 'ok';
    },
    {
      maxAttempts: 4,
      baseDelayMs: 1,
      maxDelayMs: 5,
      jitterMs: 0,
      onRetry: (info) => retryAttempts.push(info.attempt),
    },
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
  assert.deepEqual(retryAttempts, [1, 2]);
});

test('withRetry does not retry auth errors', async () => {
  let attempts = 0;

  await assert.rejects(
    withRetry(
      async () => {
        attempts++;
        const err = new Error('invalid api key') as Error & { status?: number };
        err.status = 401;
        throw err;
      },
      {
        maxAttempts: 4,
        baseDelayMs: 1,
        maxDelayMs: 5,
        jitterMs: 0,
      },
    ),
  );

  assert.equal(attempts, 1);
});
