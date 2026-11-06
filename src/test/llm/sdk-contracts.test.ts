import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import test from 'node:test';

import { createLLMClient } from '../../llm/clients';
import {
  configureQwenBaseUrl,
  type APIProvider,
} from '../../llm/provider-registry';
import { ProviderValidator } from '../../llm/provider-validator';
import {
  ANTHROPIC_API_VERSION,
  DEFAULT_ANTHROPIC_MAX_TOKENS,
} from '../../llm/sdk-options';
import { fetchProviderModels } from '../../models/discovery';
import {
  APIKeyInvalidError,
  APIQuotaExceededError,
  APIRequestError,
  GenerationCancelledError,
} from '../../shared/errors';
import { DEFAULT_RETRY_OPTIONS } from '../../shared/retry';
import { clearRequireCache, withModulesMock } from '../helpers/module-mock';
import {
  anthropicResponse,
  captureSdkRequests,
  chatResponse,
  responsesResponse,
  responseText,
  sdkSse,
} from '../helpers/sdk-http';

const DIFF =
  'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new';
const MESSAGE = 'fix: 驗證 SDK 相容性';
const KEY = 'contract-placeholder-key';
const MAX_STEPS = 2;
const HTTP_UNAUTHORIZED = 401;
const HTTP_RATE_LIMIT = 429;
const HTTP_BAD_REQUEST = 400;
const dynamicRequire = createRequire(__filename);
const TEXT_BLOCK = { type: 'text', text: MESSAGE };
const FINAL_CALL = {
  type: 'function_call',
  call_id: 'final',
  name: 'write_commit_message',
  arguments: JSON.stringify({ message: MESSAGE }),
};
const CHAT_FINAL_CALL = {
  id: 'final',
  type: 'function',
  function: { name: 'write_commit_message', arguments: FINAL_CALL.arguments },
};
const providers: APIProvider[] = [
  'openai',
  'anthropic',
  'google',
  'grok',
  'groq',
  'openrouter',
  'deepseek',
  'qwen',
  'ollama',
];
const generationPaths: Record<APIProvider, string> = {
  openai: '/v1/responses',
  anthropic: '/v1/messages',
  google: '/v1beta/models/gemini-contract:generateContent',
  grok: '/v1/responses',
  groq: '/openai/v1/chat/completions',
  openrouter: '/api/v1/chat/completions',
  deepseek: '/chat/completions',
  qwen: '/compatible-mode/v1/chat/completions',
  ollama: '/api/chat',
};

function textStream(): Response {
  return sdkSse([
    {
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: 'fix: 驗證 ' },
          finish_reason: null,
        },
      ],
    },
    { choices: [], usage: {} },
    {
      choices: [
        { index: 0, delta: { content: 'SDK 相容性' }, finish_reason: 'stop' },
      ],
    },
  ]);
}

for (const provider of providers) {
  void test(`real ${provider} SDK direct generation uses its documented protocol`, async (t) => {
    const calls = captureSdkRequests(t, (request) => {
      if (request.url.pathname === '/api/tags') {
        return Response.json({ models: [] });
      }
      if (request.url.pathname === '/api/pull') {
        return new Response('{"status":"success"}\n');
      }
      assert.equal(request.url.pathname, generationPaths[provider]);
      if (provider === 'anthropic') {
        assert.equal(
          request.headers.get('anthropic-version'),
          ANTHROPIC_API_VERSION,
        );
        assert.equal(request.headers.get('authorization'), `Bearer ${KEY}`);
        assert.equal(request.body.max_tokens, DEFAULT_ANTHROPIC_MAX_TOKENS);
        assert.equal(request.body.stream, true);
        return anthropicResponse([TEXT_BLOCK]);
      }
      if (provider === 'google') {
        assert.equal(request.headers.get('x-goog-api-key'), KEY);
        return Response.json({
          candidates: [
            {
              content: { role: 'model', parts: [{ text: MESSAGE }] },
              finishReason: 'STOP',
            },
          ],
        });
      }
      if (provider === 'ollama') {
        assert.equal(request.body.think, false);
        return Response.json({
          message: { role: 'assistant', content: MESSAGE },
          done: true,
        });
      }
      assert.equal(request.headers.get('authorization'), `Bearer ${KEY}`);
      if (provider === 'qwen') {
        assert.equal(request.body.stream, true);
        return textStream();
      }
      if (provider === 'openai' || provider === 'grok') {
        assert.equal(request.body.store, false);
        assert.equal('messages' in request.body, false);
        return responsesResponse([responseText(MESSAGE)]);
      }
      return chatResponse(MESSAGE);
    });
    const client = createLLMClient({
      provider,
      apiKey: provider === 'ollama' ? 'http://localhost:11434' : KEY,
      model: provider === 'google' ? 'gemini-contract' : 'contract-model',
    });
    assert.equal(await client.generateCommitMessage(DIFF), MESSAGE);
    assert.ok(calls.length > 0);
  });
}

for (const provider of providers) {
  void test(`real ${provider} SDK/key validation and discovery agree on endpoint configuration`, async (t) => {
    const calls = captureSdkRequests(t, (request) => {
      if (provider === 'qwen') {
        assert.equal(request.url.pathname, '/api/v1/models');
        return Response.json({ output: { total: 0, models: [] } });
      }
      if (provider === 'ollama') return Response.json({ models: [] });
      if (provider === 'google') return Response.json({ models: [] });
      if (provider === 'openrouter' && request.url.pathname.endsWith('/key'))
        return Response.json({ data: {} });
      return Response.json({ data: [], has_more: false });
    });
    const key = provider === 'ollama' ? 'http://localhost:11434' : KEY;
    assert.equal(
      (await new ProviderValidator(() => 'en').validate(provider, key)).valid,
      true,
    );
    assert.deepEqual(await fetchProviderModels(provider, key), []);
    assert.equal(calls.length, MAX_STEPS);
    if (provider === 'anthropic') {
      for (const call of calls) {
        assert.equal(
          call.headers.get('anthropic-version'),
          ANTHROPIC_API_VERSION,
        );
        assert.equal(call.headers.get('authorization'), `Bearer ${KEY}`);
      }
    }
  });
}

async function withOpenAIAgent(
  run: (
    runner: typeof import('../../agent/loop/openai').runOpenAIAgentLoop,
  ) => Promise<void>,
): Promise<void> {
  const modulePath = path.resolve(__dirname, '../../agent/loop/openai');
  clearRequireCache(modulePath);
  try {
    await withModulesMock(
      {
        '../tools/context': {
          buildInitialContext: () => Promise.resolve('repository context'),
        },
        '../tools/executors/execute-tool-call': {
          executeToolCall: () =>
            Promise.resolve({ content: 'tool-result-marker' }),
        },
      },
      async () => {
        const mod = dynamicRequire(
          modulePath,
        ) as typeof import('../../agent/loop/openai');
        await run(mod.runOpenAIAgentLoop);
      },
    );
  } finally {
    clearRequireCache(modulePath);
  }
}

async function withOtherAgent(
  provider: 'anthropic' | 'gemini',
  run: (
    runner: (
      options: import('../../agent/loop/types').AgentLoopOptions,
    ) => Promise<string>,
  ) => Promise<void>,
): Promise<void> {
  const modulePath = path.resolve(__dirname, '../../agent/loop', provider);
  clearRequireCache(modulePath);
  try {
    await withModulesMock(
      {
        '../tools/context': {
          buildInitialContext: () => Promise.resolve('repository context'),
        },
        '../tools/executors/execute-tool-call': {
          executeToolCall: () =>
            Promise.resolve({ content: 'tool-result-marker' }),
        },
      },
      async () => {
        const mod = dynamicRequire(modulePath) as Record<
          string,
          (
            options: import('../../agent/loop/types').AgentLoopOptions,
          ) => Promise<string>
        >;
        await run(
          mod[
            provider === 'anthropic'
              ? 'runAnthropicAgentLoop'
              : 'runGeminiAgentLoop'
          ],
        );
      },
    );
  } finally {
    clearRequireCache(modulePath);
  }
}

void test('real Anthropic streaming agent retains signed thinking blocks and tool-use IDs', async (t) => {
  captureSdkRequests(t, (request, index) => {
    assert.equal(request.body.max_tokens, DEFAULT_ANTHROPIC_MAX_TOKENS);
    if (index === 1)
      return anthropicResponse(
        [
          {
            type: 'thinking',
            thinking: 'reasoning-marker',
            signature: 'signature-marker',
          },
          {
            type: 'tool_use',
            id: 'read-call',
            name: 'read_file',
            input: { path: 'a.ts' },
          },
        ],
        'tool_use',
      );
    const messages = request.body.messages as Record<string, unknown>[];
    assert.match(JSON.stringify(messages), /signature-marker/);
    assert.match(JSON.stringify(messages), /"tool_use_id":"read-call"/);
    assert.match(JSON.stringify(messages), /tool-result-marker/);
    return anthropicResponse(
      [
        {
          type: 'tool_use',
          id: 'final',
          name: 'write_commit_message',
          input: { message: MESSAGE },
        },
      ],
      'tool_use',
    );
  });
  await withOtherAgent('anthropic', async (runner) => {
    assert.equal(
      await runner({
        apiKey: KEY,
        model: 'claude-contract',
        diff: DIFF,
        repoRoot: '.',
        maxAgentSteps: MAX_STEPS,
      }),
      MESSAGE,
    );
  });
});

void test('real Google Gen AI 3 agent retains thought signatures and function responses', async (t) => {
  captureSdkRequests(t, (request, index) => {
    assert.equal(
      request.url.pathname,
      '/v1beta/models/gemini-contract:generateContent',
    );
    if (index > 1) {
      assert.match(
        JSON.stringify(request.body.contents),
        /thought-signature-marker/,
      );
      assert.match(JSON.stringify(request.body.contents), /functionResponse/);
      assert.match(JSON.stringify(request.body.contents), /tool-result-marker/);
    }
    const part =
      index === 1
        ? {
            thoughtSignature: 'thought-signature-marker',
            functionCall: {
              id: 'read-call',
              name: 'read_file',
              args: { path: 'a.ts' },
            },
          }
        : {
            functionCall: {
              name: 'write_commit_message',
              args: { message: MESSAGE },
            },
          };
    return Response.json({
      candidates: [
        { content: { role: 'model', parts: [part] }, finishReason: 'STOP' },
      ],
    });
  });
  await withOtherAgent('gemini', async (runner) => {
    assert.equal(
      await runner({
        apiKey: KEY,
        model: 'gemini-contract',
        diff: DIFF,
        repoRoot: '.',
        maxAgentSteps: MAX_STEPS,
      }),
      MESSAGE,
    );
  });
});

void test('retired/deprecated Anthropic catalogue entries cannot become the default', async (t) => {
  captureSdkRequests(t, () =>
    Response.json({
      data: [
        {
          id: 'claude-retired',
          display_name: 'A retired',
          lifecycle: 'retired',
        },
        {
          id: 'claude-deprecated',
          display_name: 'B deprecated',
          lifecycle: 'deprecated',
        },
        { id: 'claude-active', display_name: 'C active', lifecycle: 'active' },
      ],
      has_more: false,
    }),
  );
  assert.deepEqual(await fetchProviderModels('anthropic', KEY), [
    { id: 'claude-active', alias: 'C active' },
  ]);
});

void test('real legacy GPT Chat Completions and explicit custom Responses retain their protocol choices', async (t) => {
  const calls = captureSdkRequests(t, (request) =>
    request.url.pathname.endsWith('/responses')
      ? responsesResponse([responseText(MESSAGE)])
      : chatResponse(MESSAGE),
  );
  assert.equal(
    await createLLMClient({
      provider: 'openai',
      apiKey: KEY,
      model: 'gpt-3.5-turbo',
    }).generateCommitMessage(DIFF),
    MESSAGE,
  );
  assert.equal(calls[0].url.pathname, '/v1/chat/completions');
  assert.equal(
    await createLLMClient({
      provider: 'openai',
      apiKey: KEY,
      baseUrl: 'https://gateway.example/v1',
      apiFormat: 'responses',
      model: 'gpt-contract',
    }).generateCommitMessage(DIFF),
    MESSAGE,
  );
  assert.equal(calls[1].url.href, 'https://gateway.example/v1/responses');
});

void test('real SDK transient failures retry exactly once at the application layer', async (t) => {
  const options = { ...DEFAULT_RETRY_OPTIONS };
  Object.assign(DEFAULT_RETRY_OPTIONS, {
    baseDelayMs: 0,
    maxDelayMs: 0,
    jitterMs: 0,
  });
  t.after(() => {
    Object.assign(DEFAULT_RETRY_OPTIONS, options);
  });
  const serverError = 503;
  const calls = captureSdkRequests(t, (_request, index) =>
    index === 1
      ? Response.json(
          { error: { message: 'temporary overload' } },
          { status: serverError },
        )
      : responsesResponse([responseText(MESSAGE)]),
  );
  assert.equal(
    await createLLMClient({
      provider: 'openai',
      apiKey: KEY,
      model: 'gpt-contract',
    }).generateCommitMessage(DIFF),
    MESSAGE,
  );
  assert.equal(calls.length, MAX_STEPS);
});

void test('Qwen streaming cancellation aborts during body consumption', async (t) => {
  let listener: (() => void) | undefined;
  let markStreaming: (() => void) | undefined;
  const streaming = new Promise<void>((resolve) => {
    markStreaming = resolve;
  });
  const token = {
    isCancellationRequested: false,
    onCancellationRequested(callback: () => void) {
      listener = callback;
      return {
        dispose() {
          listener = undefined;
        },
      };
    },
  };
  captureSdkRequests(
    t,
    (request) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n',
              ),
            );
            request.signal?.addEventListener('abort', () => {
              controller.error(new DOMException('Aborted', 'AbortError'));
            });
            markStreaming?.();
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      ),
  );
  const pending = createLLMClient({
    provider: 'qwen',
    apiKey: KEY,
    model: 'qwen-contract',
  }).generateCommitMessage(DIFF, undefined, undefined, token);
  await streaming;
  token.isCancellationRequested = true;
  listener?.();
  await assert.rejects(pending, GenerationCancelledError);
});

void test('Qwen discovery rejects repeated pages and maps rejected region keys as authentication failures', async (t) => {
  const httpForbidden = 403;
  const fetchMock = t.mock.method(global, 'fetch', () =>
    Promise.resolve(
      Response.json({
        output: {
          total: MAX_STEPS,
          models: [{ model: 'qwen3-contract' }],
        },
      }),
    ),
  );
  await assert.rejects(fetchProviderModels('qwen', KEY), /repeated model page/);
  fetchMock.mock.mockImplementation(() =>
    Promise.resolve(new Response('', { status: httpForbidden })),
  );
  assert.equal(
    (await new ProviderValidator(() => 'en').validate('qwen', KEY)).valid,
    false,
  );
});

for (const [label, baseUrl] of [
  ['openai', undefined],
  ['xai', 'https://api.x.ai/v1'],
] as const) {
  void test(`real ${label} Responses agent replays encrypted reasoning and tool results without server storage`, async (t) => {
    const reasoning = {
      type: 'reasoning',
      id: 'reasoning-contract',
      encrypted_content: 'opaque-signature',
      summary: [],
    };
    const call = {
      type: 'function_call',
      call_id: 'read-call',
      name: 'read_file',
      arguments: '{"path":"a.ts"}',
    };
    const calls = captureSdkRequests(t, (request, index) => {
      assert.equal(request.url.pathname, '/v1/responses');
      assert.equal(request.body.store, false);
      assert.deepEqual(request.body.include, ['reasoning.encrypted_content']);
      assert.equal('previous_response_id' in request.body, false);
      if (index === 1) return responsesResponse([reasoning, call]);
      assert.ok(Array.isArray(request.body.input));
      assert.deepEqual(request.body.input.slice(1), [
        reasoning,
        call,
        {
          type: 'function_call_output',
          call_id: 'read-call',
          output: 'tool-result-marker',
        },
      ]);
      return responsesResponse([FINAL_CALL]);
    });
    await withOpenAIAgent(async (runner) => {
      assert.equal(
        await runner({
          apiKey: KEY,
          model: 'gpt-5.4-pro',
          apiFormat: 'responses',
          baseUrl,
          diff: DIFF,
          repoRoot: '.',
          maxAgentSteps: MAX_STEPS,
        }),
        MESSAGE,
      );
    });
    assert.equal(calls.length, MAX_STEPS);
  });
}

void test('real Responses agent includes the last tool result when forcing final output at its step limit', async (t) => {
  captureSdkRequests(t, (request, index) => {
    if (index === 1)
      return responsesResponse([
        {
          type: 'function_call',
          call_id: 'read',
          name: 'read_file',
          arguments: '{"path":"a.ts"}',
        },
      ]);
    assert.match(JSON.stringify(request.body.input), /tool-result-marker/);
    assert.deepEqual(request.body.tool_choice, {
      type: 'function',
      name: 'write_commit_message',
    });
    return responsesResponse([FINAL_CALL]);
  });
  await withOpenAIAgent(async (runner) => {
    assert.equal(
      await runner({
        apiKey: KEY,
        model: 'gpt-5.4-pro',
        diff: DIFF,
        repoRoot: '.',
        maxAgentSteps: 1,
      }),
      MESSAGE,
    );
  });
});

void test('real Qwen SSE parser assembles fragmented tools and retains reasoning_content on the next turn', async (t) => {
  captureSdkRequests(t, (request, index) => {
    assert.equal(request.body.stream, true);
    if (index === 1)
      return sdkSse([
        {
          choices: [
            {
              delta: {
                reasoning_content: 'reasoning-marker',
                tool_calls: [
                  {
                    index: 0,
                    id: 'read-call',
                    type: 'function',
                    function: { name: 'read_file', arguments: '{"pa' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, function: { arguments: 'th":"a.ts"}' } },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      ]);
    const messages = request.body.messages as Record<string, unknown>[];
    const assistant = messages.find((message) => message.role === 'assistant');
    assert.equal(assistant?.reasoning_content, 'reasoning-marker');
    assert.deepEqual(assistant.tool_calls, [
      {
        id: 'read-call',
        type: 'function',
        function: { name: 'read_file', arguments: '{"path":"a.ts"}' },
      },
    ]);
    assert.deepEqual(messages.at(-1), {
      role: 'tool',
      tool_call_id: 'read-call',
      content: 'tool-result-marker',
    });
    return sdkSse([
      {
        choices: [
          {
            delta: { tool_calls: [{ index: 0, ...CHAT_FINAL_CALL }] },
            finish_reason: 'tool_calls',
          },
        ],
      },
    ]);
  });
  await withOpenAIAgent(async (runner) => {
    assert.equal(
      await runner({
        apiKey: KEY,
        model: 'qwen-contract',
        apiFormat: 'openai',
        streamChat: true,
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        diff: DIFF,
        repoRoot: '.',
        maxAgentSteps: MAX_STEPS,
      }),
      MESSAGE,
    );
  });
});

void test('custom Anthropic keeps gateway key compatibility and always supplies max_tokens', async (t) => {
  captureSdkRequests(t, (request) => {
    assert.equal(request.url.href, 'https://gateway.example/v1/messages');
    assert.equal(request.headers.get('x-api-key'), KEY);
    assert.equal(request.body.max_tokens, DEFAULT_ANTHROPIC_MAX_TOKENS);
    return anthropicResponse([TEXT_BLOCK]);
  });
  assert.equal(
    await createLLMClient({
      provider: 'openai',
      apiKey: KEY,
      baseUrl: 'https://gateway.example',
      apiFormat: 'anthropic',
      model: 'claude-contract',
    }).generateCommitMessage(DIFF),
    MESSAGE,
  );
});

void test('Qwen Workspace URL applies to generation, native paginated discovery and validation', async (t) => {
  const workspace =
    'https://workspace-contract.ap-southeast-1.maas.aliyuncs.com';
  configureQwenBaseUrl(workspace + '/compatible-mode/v1/');
  t.after(() => {
    configureQwenBaseUrl();
  });
  const calls = captureSdkRequests(t, (request) => {
    assert.equal(request.url.origin, workspace);
    if (request.url.pathname.endsWith('/chat/completions')) return textStream();
    assert.equal(request.url.pathname, '/api/v1/models');
    const page = request.url.searchParams.get('page_no');
    assert.ok(page);
    assert.equal(request.url.searchParams.get('capabilities'), 'TG');
    return Response.json({
      output: {
        total: MAX_STEPS,
        models: [{ model: `qwen3-contract-${page}` }],
      },
    });
  });
  assert.equal(
    await createLLMClient({
      provider: 'qwen',
      apiKey: KEY,
      model: 'qwen-contract',
    }).generateCommitMessage(DIFF),
    MESSAGE,
  );
  assert.equal((await fetchProviderModels('qwen', KEY)).length, MAX_STEPS);
  assert.equal(
    (await new ProviderValidator(() => 'en').validate('qwen', KEY)).valid,
    true,
  );
  assert.equal(calls.length, 1 + MAX_STEPS + MAX_STEPS);
});

for (const [status, expected] of [
  [HTTP_UNAUTHORIZED, APIKeyInvalidError],
  [HTTP_RATE_LIMIT, APIQuotaExceededError],
  [HTTP_BAD_REQUEST, APIRequestError],
] as const) {
  void test(`real Responses SDK maps HTTP ${String(status)} without hiding the upstream status`, async (t) => {
    const calls = captureSdkRequests(t, () =>
      Response.json(
        {
          error: { message: 'contract failure', type: 'invalid_request_error' },
        },
        { status },
      ),
    );
    const previous = DEFAULT_RETRY_OPTIONS.maxAttempts;
    DEFAULT_RETRY_OPTIONS.maxAttempts = 1;
    try {
      await assert.rejects(
        createLLMClient({
          provider: 'openai',
          apiKey: KEY,
          model: 'gpt-contract',
        }).generateCommitMessage(DIFF),
        expected,
      );
    } finally {
      DEFAULT_RETRY_OPTIONS.maxAttempts = previous;
    }
    assert.equal(calls.length, 1);
  });
}

void test('real Responses SDK aborts an in-flight fetch and reports cancellation', async (t) => {
  let listener: (() => void) | undefined;
  let notifyStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  const token = {
    isCancellationRequested: false,
    onCancellationRequested(callback: () => void) {
      listener = callback;
      return {
        dispose() {
          listener = undefined;
        },
      };
    },
  };
  captureSdkRequests(
    t,
    (request) =>
      new Promise<Response>((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
        notifyStarted?.();
      }),
  );
  const pending = createLLMClient({
    provider: 'openai',
    apiKey: KEY,
    model: 'gpt-contract',
  }).generateCommitMessage(DIFF, undefined, undefined, token);
  await started;
  token.isCancellationRequested = true;
  listener?.();
  await assert.rejects(pending, GenerationCancelledError);
});

void test('incomplete Responses and truncated Qwen/Anthropic output never become commit messages', async (t) => {
  const fetchMock = captureSdkRequests(t, (request) => {
    if (request.url.pathname.endsWith('/responses'))
      return Response.json({
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [responseText('partial')],
      });
    if (request.url.pathname.endsWith('/messages'))
      return anthropicResponse(
        [{ type: 'text', text: 'partial' }],
        'max_tokens',
      );
    return sdkSse([
      { choices: [{ delta: { content: 'partial' }, finish_reason: 'length' }] },
    ]);
  });
  for (const provider of ['openai', 'qwen', 'anthropic'] as const) {
    await assert.rejects(
      createLLMClient({
        provider,
        apiKey: KEY,
        model: 'contract-model',
      }).generateCommitMessage(DIFF),
      APIRequestError,
    );
  }
  assert.equal(
    fetchMock.length,
    providers.filter((provider) =>
      ['openai', 'qwen', 'anthropic'].includes(provider),
    ).length,
  );
});

void test('real Ollama SDK skips registry pulls for local/imported models', async (t) => {
  const calls = captureSdkRequests(t, (request) => {
    if (request.url.pathname === '/api/tags')
      return Response.json({
        models: [{ name: 'local-model:latest', model: 'local-model:latest' }],
      });
    assert.equal(request.url.pathname, '/api/chat');
    return Response.json({
      message: { role: 'assistant', content: MESSAGE },
      done: true,
    });
  });
  assert.equal(
    await createLLMClient({
      provider: 'ollama',
      apiKey: 'http://localhost:11434',
      model: 'local-model',
    }).generateCommitMessage(DIFF),
    MESSAGE,
  );
  assert.equal(calls.length, MAX_STEPS);
});

for (const provider of ['anthropic', 'google', 'ollama'] as const) {
  void test(`real ${provider} SDK aborts an in-flight request and preserves cancellation`, async (t) => {
    let listener: (() => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const token = {
      isCancellationRequested: false,
      onCancellationRequested(callback: () => void) {
        listener = callback;
        return {
          dispose() {
            listener = undefined;
          },
        };
      },
    };
    captureSdkRequests(t, (request) => {
      if (request.url.pathname === '/api/tags')
        return Response.json({
          models: [{ name: 'contract-model', model: 'contract-model' }],
        });
      return new Promise<Response>((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
        markStarted?.();
      });
    });
    const pending = createLLMClient({
      provider,
      apiKey: provider === 'ollama' ? 'http://localhost:11434' : KEY,
      model: 'contract-model',
    }).generateCommitMessage(DIFF, undefined, undefined, token);
    await started;
    token.isCancellationRequested = true;
    listener?.();
    await assert.rejects(pending, GenerationCancelledError);
  });
}

void test('real Google Gen AI 3 performs no hidden retries on a non-retryable application attempt', async (t) => {
  const previous = DEFAULT_RETRY_OPTIONS.maxAttempts;
  DEFAULT_RETRY_OPTIONS.maxAttempts = 1;
  t.after(() => {
    DEFAULT_RETRY_OPTIONS.maxAttempts = previous;
  });
  const rateLimit = 429;
  const calls = captureSdkRequests(t, () =>
    Response.json(
      {
        error: {
          code: rateLimit,
          status: 'RESOURCE_EXHAUSTED',
          message: 'quota exhausted',
        },
      },
      { status: rateLimit },
    ),
  );
  await assert.rejects(
    createLLMClient({
      provider: 'google',
      apiKey: KEY,
      model: 'gemini-contract',
    }).generateCommitMessage(DIFF),
    APIQuotaExceededError,
  );
  assert.equal(calls.length, 1);
});

void test('real Qwen SSE stream cannot return partial text after premature EOF', async (t) => {
  captureSdkRequests(t, () =>
    sdkSse(
      [{ choices: [{ delta: { content: 'partial' }, finish_reason: null }] }],
      false,
    ),
  );
  await assert.rejects(
    createLLMClient({
      provider: 'qwen',
      apiKey: KEY,
      model: 'qwen-contract',
    }).generateCommitMessage(DIFF),
    /ended before finishing/,
  );
});
