import assert from 'node:assert/strict';
import test from 'node:test';

import { runWithCancellationAbort } from '../../shared/cancellation';

void test('runWithCancellationAbort aborts an active request immediately', async () => {
  let listener: (() => void) | undefined;
  const cancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested(callback: () => void) {
      listener = callback;
      return { dispose: () => undefined };
    },
  };

  const request = runWithCancellationAbort(
    cancellationToken,
    (signal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      }),
  );

  cancellationToken.isCancellationRequested = true;
  listener?.();

  await assert.rejects(
    request,
    (error: unknown) =>
      error instanceof DOMException && error.name === 'AbortError',
  );
});
