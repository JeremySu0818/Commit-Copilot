import type { Ollama } from 'ollama';

import {
  subscribeToCancellation,
  type CancellationSignal,
} from '../shared/cancellation';

export function createOllamaClient(
  clientClass: typeof Ollama,
  host: string,
  cancellationToken?: CancellationSignal,
) {
  const controller = new AbortController();
  const request: typeof fetch = (input, init) =>
    globalThis.fetch(input, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([controller.signal, init.signal])
        : controller.signal,
    });
  const client = new clientClass({ host, fetch: request });
  const subscription = subscribeToCancellation(cancellationToken, () => {
    controller.abort();
    client.abort();
  });
  return {
    client,
    dispose: () => {
      subscription.dispose();
    },
  };
}

export async function isOllamaModelInstalled(
  client: Pick<Ollama, 'list'>,
  model: string,
): Promise<boolean> {
  const models = await client.list();
  const tagged = model.includes(':') ? model : `${model}:latest`;
  return models.models.some((item) =>
    [item.name, item.model].some((name) => name === model || name === tagged),
  );
}
