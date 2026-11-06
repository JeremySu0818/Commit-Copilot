import type { TestContext } from 'node:test';

export interface CapturedRequest {
  url: URL;
  headers: Headers;
  body: Record<string, unknown>;
  signal?: AbortSignal | null;
}

export function captureSdkRequests(
  t: TestContext,
  handler: (
    request: CapturedRequest,
    index: number,
  ) => Response | Promise<Response>,
): CapturedRequest[] {
  const requests: CapturedRequest[] = [];
  t.mock.method(
    global,
    'fetch',
    (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const request: CapturedRequest = {
        url: new URL(input instanceof Request ? input.url : String(input)),
        headers: new Headers(init?.headers),
        body:
          typeof init?.body === 'string'
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : {},
        signal: init?.signal,
      };
      requests.push(request);
      return Promise.resolve(handler(request, requests.length));
    },
  );
  return requests;
}

export function sdkSse(events: unknown[], done = true): Response {
  const wire =
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') +
    (done ? 'data: [DONE]\n\n' : '');
  const bytes = new TextEncoder().encode(wire);
  const fragmentSize = 7;
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += fragmentSize) {
          controller.enqueue(bytes.slice(offset, offset + fragmentSize));
        }
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

export function chatResponse(
  content: string | null,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json({
    id: 'chat-contract',
    object: 'chat.completion',
    created: 0,
    model: 'contract-model',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        logprobs: null,
        message: { role: 'assistant', content, ...extra },
      },
    ],
  });
}

export function responsesResponse(output: unknown[]): Response {
  return Response.json({
    id: 'resp-contract',
    object: 'response',
    status: 'completed',
    output,
  });
}

export function responseText(text: string): unknown {
  return {
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [{ type: 'output_text', text, annotations: [] }],
  };
}

export function anthropicResponse(
  content: Record<string, unknown>[],
  stopReason = 'end_turn',
): Response {
  const events: Record<string, unknown>[] = [
    {
      type: 'message_start',
      message: {
        id: 'msg-contract',
        type: 'message',
        role: 'assistant',
        model: 'claude-contract',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 0 },
      },
    },
  ];
  content.forEach((block, index) => {
    let initial: Record<string, unknown>;
    let deltas: Record<string, unknown>[];
    if (block.type === 'tool_use') {
      initial = { type: block.type, id: block.id, name: block.name, input: {} };
      deltas = [
        { type: 'input_json_delta', partial_json: JSON.stringify(block.input) },
      ];
    } else if (block.type === 'thinking') {
      initial = { type: block.type, thinking: '', signature: '' };
      deltas = [
        { type: 'thinking_delta', thinking: block.thinking },
        { type: 'signature_delta', signature: block.signature },
      ];
    } else {
      initial = { type: 'text', text: '' };
      deltas = [{ type: 'text_delta', text: block.text }];
    }
    events.push({ type: 'content_block_start', index, content_block: initial });
    events.push(
      ...deltas.map((delta) => ({ type: 'content_block_delta', index, delta })),
    );
    events.push({ type: 'content_block_stop', index });
  });
  events.push(
    {
      type: 'message_delta',
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: 1 },
    },
    { type: 'message_stop' },
  );
  return new Response(
    events
      .map(
        (event) =>
          `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`,
      )
      .join(''),
    {
      headers: { 'content-type': 'text/event-stream' },
    },
  );
}
