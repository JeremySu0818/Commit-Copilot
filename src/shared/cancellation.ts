import { GenerationCancelledError } from './errors';

export interface CancellationSignal {
  readonly isCancellationRequested: boolean;
  onCancellationRequested?(listener: () => void): { dispose(): void };
}

export function throwIfCancellationRequested(
  cancellationToken?: CancellationSignal,
): void {
  if (cancellationToken?.isCancellationRequested) {
    throw new GenerationCancelledError();
  }
}

export function subscribeToCancellation(
  cancellationToken: CancellationSignal | undefined,
  listener: () => void,
): { dispose(): void } {
  if (cancellationToken?.isCancellationRequested) {
    listener();
    return { dispose: () => undefined };
  }
  return (
    cancellationToken?.onCancellationRequested?.(listener) ?? {
      dispose: () => undefined,
    }
  );
}

export async function runWithCancellationAbort<T>(
  cancellationToken: CancellationSignal | undefined,
  request: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  throwIfCancellationRequested(cancellationToken);
  const controller = new AbortController();
  const subscription = subscribeToCancellation(cancellationToken, () => {
    controller.abort();
  });
  try {
    return await request(controller.signal);
  } finally {
    subscription.dispose();
  }
}
