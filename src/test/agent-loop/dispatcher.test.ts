import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type { GitOperations } from '../../commit-copilot';
import { APIProvider, DEFAULT_COMMIT_OUTPUT_OPTIONS } from '../../models';
import { clearRequireCache } from '../helpers/module-mock';

const MODULE_PATH = path.resolve(__dirname, '..', '..', 'agent-loop', 'index');

type AgentLoopModule = typeof import('../../agent-loop');

interface CallRecord {
  provider: string;
  model?: string;
  baseUrl?: string;
}

type AsyncOrSync<T> = T | Promise<T>;

async function withModulesMock<T>(
  mocks: Record<string, unknown>,
  run: () => AsyncOrSync<T>,
): Promise<T> {
  const moduleImpl = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = moduleImpl._load;

  moduleImpl._load = function (
    request: string,
    parent: unknown,
    isMain: boolean,
  ): unknown {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return await run();
  } finally {
    moduleImpl._load = originalLoad;
  }
}

async function runDispatcherTest(
  provider: APIProvider,
  customBaseUrl?: string,
): Promise<CallRecord> {
  clearRequireCache(MODULE_PATH);

  let capturedCall: CallRecord | null = null;

  const mockOpenAILoop = (
    _apiKey: string,
    model: string | undefined,
    _diff: string,
    _repoRoot: string,
    _onProgress: unknown,
    _isStaged: boolean,
    _gitOps: unknown,
    _commitOutputOptions: unknown,
    _cancellationToken: unknown,
    _maxAgentSteps: number | undefined,
    baseUrl: string | undefined,
    _language: string,
  ) => {
    capturedCall = { provider: 'openai', model, baseUrl };
    return Promise.resolve('openai-loop-result');
  };

  const mockGeminiLoop = () => {
    capturedCall = { provider: 'google' };
    return Promise.resolve('gemini-loop-result');
  };

  const mockAnthropicLoop = () => {
    capturedCall = { provider: 'anthropic' };
    return Promise.resolve('anthropic-loop-result');
  };

  const mockOllamaLoop = () => {
    capturedCall = { provider: 'ollama' };
    return Promise.resolve('ollama-loop-result');
  };

  const mocks = {
    './openai': { runOpenAIAgentLoop: mockOpenAILoop },
    './gemini': { runGeminiAgentLoop: mockGeminiLoop },
    './anthropic': { runAnthropicAgentLoop: mockAnthropicLoop },
    './ollama': { runOllamaAgentLoop: mockOllamaLoop },
  };

  return withModulesMock(mocks, async () => {
    const dynamicRequire = createRequire(__filename);
    const mod = dynamicRequire(MODULE_PATH) as AgentLoopModule;

    await mod.runAgentLoop({
      provider,
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: customBaseUrl,
      diff: 'test-diff',
      repoRoot: 'test-root',
      isStaged: true,
      gitOps: {} as unknown as GitOperations,
      commitOutputOptions: DEFAULT_COMMIT_OUTPUT_OPTIONS,
      language: 'en',
    });

    if (!capturedCall) {
      throw new Error('No loop was called');
    }
    return capturedCall;
  });
}

void test('runAgentLoop routes standard providers correctly', async () => {
  const geminiCall = await runDispatcherTest('google');
  assert.equal(geminiCall.provider, 'google');

  const openaiCall = await runDispatcherTest('openai');
  assert.equal(openaiCall.provider, 'openai');
  assert.equal(openaiCall.baseUrl, undefined);

  const anthropicCall = await runDispatcherTest('anthropic');
  assert.equal(anthropicCall.provider, 'anthropic');

  const ollamaCall = await runDispatcherTest('ollama');
  assert.equal(ollamaCall.provider, 'ollama');
});

void test('runAgentLoop routes new built-in OpenAI-compatible providers correctly with default base URLs', async () => {
  const grokCall = await runDispatcherTest('grok');
  assert.equal(grokCall.provider, 'openai');
  assert.equal(grokCall.baseUrl, 'https://api.x.ai/v1');

  const groqCall = await runDispatcherTest('groq');
  assert.equal(groqCall.provider, 'openai');
  assert.equal(groqCall.baseUrl, 'https://api.groq.com/openai/v1');

  const openrouterCall = await runDispatcherTest('openrouter');
  assert.equal(openrouterCall.provider, 'openai');
  assert.equal(openrouterCall.baseUrl, 'https://openrouter.ai/api/v1');

  const deepseekCall = await runDispatcherTest('deepseek');
  assert.equal(deepseekCall.provider, 'openai');
  assert.equal(deepseekCall.baseUrl, 'https://api.deepseek.com');

  const qwenCall = await runDispatcherTest('qwen');
  assert.equal(qwenCall.provider, 'openai');
  assert.equal(qwenCall.baseUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
});

void test('runAgentLoop overrides default base URLs if custom baseUrl is provided', async () => {
  const customCall = await runDispatcherTest('deepseek', 'https://custom-endpoint.com/v1');
  assert.equal(customCall.provider, 'openai');
  assert.equal(customCall.baseUrl, 'https://custom-endpoint.com/v1');
});
