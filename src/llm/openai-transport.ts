import type OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
} from 'openai/resources/chat/completions';

import { APIRequestError } from '../shared/errors';

type UnknownRecord = Record<string, unknown>;
interface StreamToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

export function assertCompleteResponse(response: unknown): void {
  if (!isRecord(response)) {
    throw new APIRequestError('Invalid Responses API response');
  }
  if (['failed', 'incomplete', 'cancelled'].includes(String(response.status))) {
    let detail = response.status;
    if (isRecord(response.error)) {
      detail = response.error.message;
    } else if (isRecord(response.incomplete_details)) {
      detail = response.incomplete_details.reason;
    }
    throw new APIRequestError(
      `Responses API did not complete: ${String(detail)}`,
    );
  }
}

export function getResponseText(response: unknown): string {
  assertCompleteResponse(response);
  if (!isRecord(response)) {
    return '';
  }
  if (typeof response.output_text === 'string' && response.output_text) {
    return response.output_text;
  }
  const output = Array.isArray(response.output) ? response.output : [];
  return output
    .flatMap((item: unknown) => {
      if (
        !isRecord(item) ||
        item.type !== 'message' ||
        !Array.isArray(item.content)
      ) {
        return [];
      }
      return item.content.flatMap((part: unknown) =>
        isRecord(part) &&
        part.type === 'output_text' &&
        typeof part.text === 'string'
          ? [part.text]
          : [],
      );
    })
    .join('');
}

function appendToolDeltas(
  calls: Map<number, StreamToolCall>,
  deltas: NonNullable<ChatCompletionChunk.Choice.Delta['tool_calls']>,
): void {
  for (const delta of deltas) {
    if (!Number.isInteger(delta.index) || delta.index < 0) {
      throw new APIRequestError('Invalid streaming tool-call index');
    }
    const call = calls.get(delta.index) ?? {
      id: '',
      type: 'function',
      function: { name: '', arguments: '' },
    };
    call.id += delta.id ?? '';
    call.function.name += delta.function?.name ?? '';
    call.function.arguments += delta.function?.arguments ?? '';
    calls.set(delta.index, call);
  }
}

function assertChatFinished(reason: string | null | undefined): void {
  if (reason === 'length' || reason === 'content_filter') {
    throw new APIRequestError(`Chat completion did not complete: ${reason}`);
  }
}

export async function requestChatCompletion(
  client: OpenAI,
  request: ChatCompletionCreateParamsNonStreaming,
  options: { signal?: AbortSignal },
  streaming = false,
): Promise<ChatCompletion> {
  if (!streaming) {
    const response = await client.chat.completions.create(request, options);
    assertChatFinished(response.choices[0]?.finish_reason);
    return response;
  }
  const stream = await client.chat.completions.create(
    { ...request, stream: true },
    options,
  );
  let content = '';
  let reasoningContent = '';
  let finishReason: ChatCompletion.Choice['finish_reason'] | undefined;
  const calls = new Map<number, StreamToolCall>();
  for await (const chunk of stream) {
    if (chunk.choices.length === 0) {
      continue;
    }
    const choice = chunk.choices[0];
    content += choice.delta.content ?? '';
    const delta = choice.delta as unknown as UnknownRecord;
    if (typeof delta.reasoning_content === 'string') {
      reasoningContent += delta.reasoning_content;
    }
    appendToolDeltas(calls, choice.delta.tool_calls ?? []);
    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
  }
  if (!finishReason) {
    throw new APIRequestError('Chat completion stream ended before finishing');
  }
  assertChatFinished(finishReason);
  const toolCalls = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, call]) => call);
  if (toolCalls.some((call) => !call.id || !call.function.name)) {
    throw new APIRequestError('Incomplete streaming tool call');
  }
  return {
    id: 'streamed-completion',
    object: 'chat.completion',
    created: 0,
    model: request.model,
    choices: [
      {
        index: 0,
        logprobs: null,
        finish_reason: finishReason,
        message: {
          role: 'assistant',
          content: content || null,
          refusal: null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
          ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
        },
      },
    ],
  };
}
