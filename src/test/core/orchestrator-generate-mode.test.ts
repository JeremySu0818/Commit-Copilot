import * as fs from 'fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as path from 'path';

import type { GitRepository } from '../../git/types';
import { APIProvider, DEFAULT_MODELS } from '../../llm/provider-registry';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  GenerateMode,
} from '../../models/options';
import { EXIT_CODES } from '../../shared/errors';
import { clearRequireCache, withModuleMock } from '../helpers/module-mock';
import { cleanupTempDir, createTempDir } from '../helpers/temp-dir';

const MODULE_PATH = path.resolve(__dirname, '..', '..', 'core', 'orchestrator');
const PROVIDER_ROUTING_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'core',
  'provider-routing',
);

type GenerateCommitMessageFn =
  typeof import('../../core/orchestrator').generateCommitMessage;

type RunAgentLoop = (
  options: Record<string, unknown>,
) => Promise<string> | string;

type CreateLLMClient = (options: {
  provider: APIProvider;
  apiKey: string;
  model?: string;
  commitOutputOptions?: CommitOutputOptions;
}) => {
  generateCommitMessage: (
    diff: string,
    draftCommitMessage?: string,
    onProgress?: (message: string, increment?: number) => void,
    cancellationToken?: { isCancellationRequested: boolean },
  ) => Promise<string> | string;
};

interface AgentInputSummary {
  provider: APIProvider;
  model: string;
  repoRoot: string;
  commitOutputOptions: CommitOutputOptions;
  draftCommitMessage?: string;
}

interface ClientOptionsSummary {
  provider: APIProvider;
  model: string;
  commitOutputOptions: CommitOutputOptions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toAgentInputSummary(value: unknown): AgentInputSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    (value.provider !== 'google' &&
      value.provider !== 'openai' &&
      value.provider !== 'anthropic' &&
      value.provider !== 'ollama') ||
    typeof value.model !== 'string' ||
    typeof value.repoRoot !== 'string' ||
    !isRecord(value.commitOutputOptions)
  ) {
    return null;
  }

  const commitOutputOptions = value.commitOutputOptions;
  if (
    typeof commitOutputOptions.includeScope !== 'boolean' ||
    typeof commitOutputOptions.includeBody !== 'boolean' ||
    typeof commitOutputOptions.includeFooter !== 'boolean' ||
    typeof commitOutputOptions.includeGitmoji !== 'boolean'
  ) {
    return null;
  }

  return {
    provider: value.provider,
    model: value.model,
    repoRoot: value.repoRoot,
    commitOutputOptions: {
      includeScope: commitOutputOptions.includeScope,
      includeBody: commitOutputOptions.includeBody,
      includeFooter: commitOutputOptions.includeFooter,
      includeGitmoji: commitOutputOptions.includeGitmoji,
    },
    draftCommitMessage:
      typeof value.draftCommitMessage === 'string'
        ? value.draftCommitMessage
        : undefined,
  };
}

function toClientOptionsSummary(value: unknown): ClientOptionsSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    (value.provider !== 'google' &&
      value.provider !== 'openai' &&
      value.provider !== 'anthropic' &&
      value.provider !== 'ollama') ||
    typeof value.model !== 'string' ||
    !isRecord(value.commitOutputOptions)
  ) {
    return null;
  }

  const commitOutputOptions = value.commitOutputOptions;
  if (
    typeof commitOutputOptions.includeScope !== 'boolean' ||
    typeof commitOutputOptions.includeBody !== 'boolean' ||
    typeof commitOutputOptions.includeFooter !== 'boolean' ||
    typeof commitOutputOptions.includeGitmoji !== 'boolean'
  ) {
    return null;
  }

  return {
    provider: value.provider,
    model: value.model,
    commitOutputOptions: {
      includeScope: commitOutputOptions.includeScope,
      includeBody: commitOutputOptions.includeBody,
      includeFooter: commitOutputOptions.includeFooter,
      includeGitmoji: commitOutputOptions.includeGitmoji,
    },
  };
}

function createRepository(repoRoot: string, stagedDiff: string): GitRepository {
  return {
    rootUri: {
      fsPath: repoRoot,
      toString: () => `file://${repoRoot.replace(/\\/g, '/')}`,
    },
    state: {
      workingTreeChanges: [],
      indexChanges: [],
      untrackedChanges: [],
    },
    inputBox: { value: '' },
    diff: (cached?: boolean) => Promise.resolve(cached ? stagedDiff : ''),
    add: () => Promise.resolve(),
    show: () => Promise.resolve(''),
    log: () => Promise.resolve([]),
    commit: () => Promise.resolve(),
    status: () => Promise.resolve(),
  };
}

async function loadGenerateCommitMessage(options: {
  runAgentLoop: RunAgentLoop;
  createLLMClient: CreateLLMClient;
}): Promise<GenerateCommitMessageFn> {
  clearRequireCache(MODULE_PATH);
  clearRequireCache(PROVIDER_ROUTING_PATH);

  const llmClientsMock = {
    createLLMClient: options.createLLMClient,
  };
  const agentLoopMock = {
    runAgentLoop: options.runAgentLoop,
  };

  const loaded = await withModuleMock('../llm/clients', llmClientsMock, () =>
    withModuleMock('../agent/loop', agentLoopMock, () => {
      const dynamicRequire = createRequire(__filename);
      return dynamicRequire(
        MODULE_PATH,
      ) as typeof import('../../core/orchestrator');
    }),
  );

  return loaded.generateCommitMessage;
}

async function runGenerate(options: {
  provider: APIProvider;
  generateMode?: GenerateMode;
  commitOutputOptions?: CommitOutputOptions;
  draftCommitMessage?: string;
  runAgentLoop: RunAgentLoop;
  createLLMClient: CreateLLMClient;
  cancellationToken?: { isCancellationRequested: boolean };
}): Promise<{
  result: Awaited<ReturnType<GenerateCommitMessageFn>>;
  repoRoot: string;
}> {
  const repoRoot = createTempDir();
  fs.mkdirSync(path.join(repoRoot, '.git'), { recursive: true });
  const repository = createRepository(
    repoRoot,
    'diff --git a/a.ts b/a.ts\n+new',
  );
  const generateCommitMessage = await loadGenerateCommitMessage({
    runAgentLoop: options.runAgentLoop,
    createLLMClient: options.createLLMClient,
  });

  const result = await generateCommitMessage({
    repository,
    provider: options.provider,
    apiKey: 'token',
    generateMode: options.generateMode,
    commitOutputOptions: options.commitOutputOptions,
    draftCommitMessage: options.draftCommitMessage,
    cancellationToken: options.cancellationToken,
    language: 'en',
  });

  return { result, repoRoot };
}

void test('generateCommitMessage uses agent loop in agentic mode', async () => {
  let capturedAgentInput: unknown;
  let directCallCount = 0;

  const { result, repoRoot } = await runGenerate({
    provider: 'openai',
    generateMode: 'agentic',
    commitOutputOptions: {
      includeScope: false,
      includeBody: true,
      includeFooter: true,
      includeGitmoji: true,
    },
    runAgentLoop: (input) => {
      capturedAgentInput = input;
      return Promise.resolve(
        'feat(core): add mode switch\n\nImplemented mode routing.',
      );
    },
    createLLMClient: () => {
      directCallCount++;
      return {
        generateCommitMessage: () => Promise.resolve('should not be used'),
      };
    },
  });

  try {
    assert.equal(result.success, true);
    assert.equal(
      result.message,
      'feat(core): add mode switch\n\nImplemented mode routing.',
    );
    assert.equal(directCallCount, 0);
    const agentInput = toAgentInputSummary(capturedAgentInput);
    if (!agentInput) {
      throw new Error('capturedAgentInput not set');
    }
    assert.equal(agentInput.provider, 'openai');
    assert.equal(agentInput.model, DEFAULT_MODELS.openai);
    assert.equal(agentInput.repoRoot, repoRoot);
    assert.deepEqual(agentInput.commitOutputOptions, {
      includeScope: false,
      includeBody: true,
      includeFooter: true,
      includeGitmoji: true,
    });
    assert.equal(agentInput.draftCommitMessage, undefined);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

void test('generateCommitMessage passes draft commit message to agent mode', async () => {
  let capturedAgentInput: unknown;

  const { result, repoRoot } = await runGenerate({
    provider: 'openai',
    generateMode: 'agentic',
    draftCommitMessage: 'feat(settings): add draft-aware generation',
    runAgentLoop: (input) => {
      capturedAgentInput = input;
      return Promise.resolve('feat(settings): add draft-aware generation');
    },
    createLLMClient: () => ({
      generateCommitMessage: () => Promise.resolve('should not be used'),
    }),
  });

  try {
    assert.equal(result.success, true);
    const agentInput = toAgentInputSummary(capturedAgentInput);
    if (!agentInput) {
      throw new Error('capturedAgentInput not set');
    }
    assert.equal(
      agentInput.draftCommitMessage,
      'feat(settings): add draft-aware generation',
    );
  } finally {
    cleanupTempDir(repoRoot);
  }
});

void test('generateCommitMessage uses direct diff client in direct-diff mode', async () => {
  let capturedClientOptions: unknown;
  let capturedDirectDiff = '';
  let capturedDraftCommitMessage: string | undefined;
  let agentCallCount = 0;

  const { result, repoRoot } = await runGenerate({
    provider: 'openai',
    generateMode: 'direct-diff',
    draftCommitMessage: 'fix(ui): keep user wording',
    commitOutputOptions: {
      includeScope: true,
      includeBody: false,
      includeFooter: false,
      includeGitmoji: false,
    },
    runAgentLoop: () => {
      agentCallCount++;
      return Promise.resolve('should not be used');
    },
    createLLMClient: (clientOptions) => {
      capturedClientOptions = clientOptions;
      return {
        generateCommitMessage: (diff, draftCommitMessage) => {
          capturedDirectDiff = diff;
          capturedDraftCommitMessage = draftCommitMessage;
          return Promise.resolve(
            'fix(ui): use direct diff mode\n\nBypass agent tools for this run.',
          );
        },
      };
    },
  });

  try {
    assert.equal(result.success, true);
    assert.equal(
      result.message,
      'fix(ui): use direct diff mode\n\nBypass agent tools for this run.',
    );
    assert.equal(agentCallCount, 0);
    const clientOptions = toClientOptionsSummary(capturedClientOptions);
    if (!clientOptions) {
      throw new Error('capturedClientOptions not set');
    }
    assert.equal(clientOptions.provider, 'openai');
    assert.equal(clientOptions.model, DEFAULT_MODELS.openai);
    assert.deepEqual(clientOptions.commitOutputOptions, {
      includeScope: true,
      includeBody: false,
      includeFooter: false,
      includeGitmoji: false,
    });
    assert.match(capturedDirectDiff, /diff --git a\/a\.ts b\/a\.ts/);
    assert.equal(capturedDraftCommitMessage, 'fix(ui): keep user wording');
  } finally {
    cleanupTempDir(repoRoot);
  }
});

void test('generateCommitMessage uses agent loop for ollama in agentic mode', async () => {
  let capturedAgentInput: unknown;
  let directCallCount = 0;

  const { result, repoRoot } = await runGenerate({
    provider: 'ollama',
    generateMode: 'agentic',
    runAgentLoop: (input) => {
      capturedAgentInput = input;
      return Promise.resolve('feat(ollama): support agent tools');
    },
    createLLMClient: () => {
      directCallCount++;
      return {
        generateCommitMessage: () => Promise.resolve('should not be used'),
      };
    },
  });

  try {
    assert.equal(result.success, true);
    assert.equal(directCallCount, 0);
    const agentInput = toAgentInputSummary(capturedAgentInput);
    if (!agentInput) {
      throw new Error('capturedAgentInput not set');
    }
    assert.equal(agentInput.provider, 'ollama');
    assert.equal(agentInput.model, DEFAULT_MODELS.ollama);
    assert.deepEqual(
      agentInput.commitOutputOptions,
      DEFAULT_COMMIT_OUTPUT_OPTIONS,
    );
  } finally {
    cleanupTempDir(repoRoot);
  }
});

void test('generateCommitMessage returns cancelled when cancellation is already requested', async () => {
  let directCallCount = 0;
  let agentCallCount = 0;

  const { result, repoRoot } = await runGenerate({
    provider: 'openai',
    generateMode: 'direct-diff',
    cancellationToken: { isCancellationRequested: true },
    runAgentLoop: () => {
      agentCallCount++;
      return Promise.resolve('should not be used');
    },
    createLLMClient: () => {
      directCallCount++;
      return {
        generateCommitMessage: () => Promise.resolve('should not be used'),
      };
    },
  });

  try {
    assert.equal(result.success, false);
    assert.equal(result.error?.exitCode, EXIT_CODES.CANCELLED);
    assert.equal(agentCallCount, 0);
    assert.equal(directCallCount, 0);
  } finally {
    cleanupTempDir(repoRoot);
  }
});
