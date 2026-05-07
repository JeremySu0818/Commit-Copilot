import assert from 'node:assert/strict';
import test from 'node:test';

import { GenerationCancelledError } from '../errors';
import { withRetry } from '../retry';

const successfulAttemptIndex = 3;
const expectedRetryAttempts = [1, successfulAttemptIndex - 1];
const maxDelayMs = 5;
const maxAttempts = 4;
const attemptsAfterSingleRetry = 2;

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
      if (attempts < successfulAttemptIndex) {
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
      maxDelayMs,
      jitterMs: 0,
      onRetry: (info) => retryAttempts.push(info.attempt),
    },
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, successfulAttemptIndex);
  assert.deepEqual(retryAttempts, expectedRetryAttempts);
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
        maxAttempts,
        baseDelayMs: 1,
        maxDelayMs,
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
          maxAttempts: expectedRetryAttempts.length,
          baseDelayMs: 1,
          maxDelayMs,
          jitterMs: 0,
        },
      ),
    );

    assert.deepEqual(scheduledDelays, [maxDelayMs]);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

void test('withRetry reads Fetch Headers retry-after without illegal invocation', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const scheduledDelays: number[] = [];
  let attempts = 0;

  globalThis.setTimeout = createImmediateSetTimeout(scheduledDelays);

  try {
    const result = await withRetry(
      () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('server unavailable') as Error & {
            status?: number;
            headers?: Headers;
          };
          err.status = 503;
          err.headers = new Headers({ 'retry-after': '1' });
          return Promise.reject(err);
        }
        return Promise.resolve('ok');
      },
      {
        maxAttempts,
        baseDelayMs: 1,
        maxDelayMs,
        jitterMs: 0,
      },
    );

    assert.equal(result, 'ok');
    assert.equal(attempts, attemptsAfterSingleRetry);
    assert.deepEqual(scheduledDelays, [maxDelayMs]);
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
        maxAttempts,
        baseDelayMs: 1,
        maxDelayMs,
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
          maxAttempts,
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
