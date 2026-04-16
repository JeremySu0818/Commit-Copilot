import assert from 'node:assert/strict';
import test from 'node:test';

import { GenerationCancelledError } from '../errors';
import { withRetry } from '../retry';

function createImmediateSetTimeout(
  scheduledDelays: number[],
): typeof setTimeout {
  type TimeoutHandler = Parameters<typeof setTimeout>[0];
  return ((handler: TimeoutHandler, ms?: number) => {
    scheduledDelays.push(ms ?? 0);
    if (typeof handler === 'function') {
      handler();
    }
    const timeoutLike = {
      hasRef: () => false,
      ref: () => timeoutLike,
      unref: () => timeoutLike,
      refresh: () => timeoutLike,
      [Symbol.toPrimitive]: () => 0,
    };
    return timeoutLike as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
}

void test('withRetry retries retryable errors and then succeeds', async () => {
  let attempts = 0;
  const retryAttempts: number[] = [];

  const result = await withRetry(
    () => {
      attempts++;
      if (attempts < 3) {
        const err = new Error('rate limit exceeded') as Error & {
          status?: number;
        };
        err.status = 429;
        return Promise.reject(err);
      }
      return Promise.resolve('ok');
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

void test('withRetry does not retry auth errors', async () => {
  let attempts = 0;

  await assert.rejects(
    withRetry(
      () => {
        attempts++;
        const err = new Error('invalid api key') as Error & { status?: number };
        err.status = 401;
        return Promise.reject(err);
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

void test('withRetry clamps retry-after delay by maxDelayMs', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const scheduledDelays: number[] = [];

  globalThis.setTimeout = createImmediateSetTimeout(scheduledDelays);

  try {
    await assert.rejects(
      withRetry(
        () => {
          const err = new Error('rate limited') as Error & {
            status?: number;
            headers?: Record<string, string>;
          };
          err.status = 429;
          err.headers = { 'retry-after': '3600' };
          return Promise.reject(err);
        },
        {
          maxAttempts: 2,
          baseDelayMs: 1,
          maxDelayMs: 5,
          jitterMs: 0,
        },
      ),
    );

    assert.deepEqual(scheduledDelays, [5]);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

void test('withRetry does not retry generation cancellation errors', async () => {
  let attempts = 0;

  await assert.rejects(
    withRetry(
      () => {
        attempts++;
        return Promise.reject(new GenerationCancelledError());
      },
      {
        maxAttempts: 4,
        baseDelayMs: 1,
        maxDelayMs: 5,
        jitterMs: 0,
      },
    ),
    (error) => error instanceof GenerationCancelledError,
  );

  assert.equal(attempts, 1);
});

void test('withRetry aborts before scheduling retry delay when cancellation is requested', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const scheduledDelays: number[] = [];
  let attempts = 0;

  globalThis.setTimeout = createImmediateSetTimeout(scheduledDelays);

  try {
    await assert.rejects(
      withRetry(
        () => {
          attempts++;
          const err = new Error('rate limit exceeded') as Error & {
            status?: number;
          };
          err.status = 429;
          return Promise.reject(err);
        },
        {
          maxAttempts: 4,
          baseDelayMs: 10,
          maxDelayMs: 10,
          jitterMs: 0,
          checkAbort: () => {
            if (attempts >= 1) {
              throw new GenerationCancelledError();
            }
          },
        },
      ),
      (error) => error instanceof GenerationCancelledError,
    );

    assert.equal(attempts, 1);
    assert.deepEqual(scheduledDelays, []);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});
