import { GenerationCancelledError } from './errors';

export interface CancellationSignal {
  readonly isCancellationRequested: boolean;
}

export function throwIfCancellationRequested(
  cancellationToken?: CancellationSignal,
): void {
  if (cancellationToken?.isCancellationRequested) {
    throw new GenerationCancelledError();
  }
}
