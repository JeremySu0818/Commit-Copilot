import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../retry';
import { GenerationCancelledError } from '../errors';

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

test('withRetry clamps retry-after delay by maxDelayMs', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const scheduledDelays: number[] = [];

  globalThis.setTimeout = ((handler: (...args: any[]) => void, ms?: number) => {
    scheduledDelays.push(ms ?? 0);
    handler();
    return {
      hasRef: () => false,
      ref: () => undefined,
      unref: () => undefined,
    } as any;
  }) as typeof setTimeout;

  try {
    await assert.rejects(
      withRetry(
        async () => {
          const err = new Error('rate limited') as Error & {
            status?: number;
            headers?: Record<string, string>;
          };
          err.status = 429;
          err.headers = { 'retry-after': '3600' };
          throw err;
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

test('withRetry does not retry generation cancellation errors', async () => {
  let attempts = 0;

  await assert.rejects(
    withRetry(
      async () => {
        attempts++;
        throw new GenerationCancelledError();
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

test('withRetry aborts before scheduling retry delay when cancellation is requested', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const scheduledDelays: number[] = [];
  let attempts = 0;

  globalThis.setTimeout = ((handler: (...args: any[]) => void, ms?: number) => {
    scheduledDelays.push(ms ?? 0);
    handler();
    return {
      hasRef: () => false,
      ref: () => undefined,
      unref: () => undefined,
    } as any;
  }) as typeof setTimeout;

  try {
    await assert.rejects(
      withRetry(
        async () => {
          attempts++;
          const err = new Error('rate limit exceeded') as Error & {
            status?: number;
          };
          err.status = 429;
          throw err;
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
