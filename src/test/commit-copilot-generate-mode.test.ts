import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { clearRequireCache, withModuleMock } from './helpers/module-mock';
import { cleanupTempDir, createTempDir } from './helpers/temp-dir';
import {
  APIProvider,
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_MODELS,
  GenerateMode,
} from '../models';
import { EXIT_CODES } from '../errors';

const MODULE_PATH = path.resolve(__dirname, '..', 'commit-copilot');

type GenerateCommitMessageFn =
  typeof import('../commit-copilot').generateCommitMessage;

function createRepository(repoRoot: string, stagedDiff: string) {
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
    diff: async (cached?: boolean) => (cached ? stagedDiff : ''),
    add: async () => {},
    show: async () => '',
    log: async () => [],
    commit: async () => {},
    status: async () => {},
  } as any;
}

async function loadGenerateCommitMessage(options: {
  runAgentLoop: (options: Record<string, unknown>) => Promise<string> | string;
  createLLMClient: (options: {
    provider: APIProvider;
    apiKey: string;
    model?: string;
    commitOutputOptions?: CommitOutputOptions;
  }) => {
    generateCommitMessage: (
      diff: string,
      onProgress?: (message: string, increment?: number) => void,
      cancellationToken?: { isCancellationRequested: boolean },
    ) => Promise<string> | string;
  };
}): Promise<GenerateCommitMessageFn> {
  clearRequireCache(MODULE_PATH);

  const llmClientsMock = {
    createLLMClient: options.createLLMClient,
  };
  const agentLoopMock = {
    runAgentLoop: options.runAgentLoop,
  };

  const loaded = await withModuleMock(
    './llm-clients',
    llmClientsMock,
    async () =>
      withModuleMock('./agent-loop', agentLoopMock, async () => {
        return require(MODULE_PATH) as typeof import('../commit-copilot');
      }),
  );

  return loaded.generateCommitMessage;
}

async function runGenerate(options: {
  provider: APIProvider;
  generateMode?: GenerateMode;
  commitOutputOptions?: CommitOutputOptions;
  runAgentLoop: (options: Record<string, unknown>) => Promise<string> | string;
  createLLMClient: (options: {
    provider: APIProvider;
    apiKey: string;
    model?: string;
    commitOutputOptions?: CommitOutputOptions;
  }) => {
    generateCommitMessage: (
      diff: string,
      onProgress?: (message: string, increment?: number) => void,
      cancellationToken?: { isCancellationRequested: boolean },
    ) => Promise<string> | string;
  };
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
    cancellationToken: options.cancellationToken,
    language: 'en',
  });

  return { result, repoRoot };
}

test('generateCommitMessage uses agent loop in agentic mode', async () => {
  let capturedAgentInput: Record<string, unknown> | null = null;
  let directCallCount = 0;

  const { result, repoRoot } = await runGenerate({
    provider: 'openai',
    generateMode: 'agentic',
    commitOutputOptions: {
      includeScope: false,
      includeBody: true,
      includeFooter: true,
    },
    runAgentLoop: async (input) => {
      capturedAgentInput = input;
      return 'feat(core): add mode switch\n\nImplemented mode routing.';
    },
    createLLMClient: () => {
      directCallCount++;
      return {
        generateCommitMessage: async () => 'should not be used',
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
    assert.ok(capturedAgentInput);
    const agentInput = capturedAgentInput as unknown as {
      provider: string;
      model: string;
      repoRoot: string;
      commitOutputOptions: CommitOutputOptions;
    };
    assert.equal(agentInput.provider, 'openai');
    assert.equal(agentInput.model, DEFAULT_MODELS.openai);
    assert.equal(agentInput.repoRoot, repoRoot);
    assert.deepEqual(agentInput.commitOutputOptions, {
      includeScope: false,
      includeBody: true,
      includeFooter: true,
    });
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('generateCommitMessage uses direct diff client in direct-diff mode', async () => {
  let capturedClientOptions: Record<string, unknown> | null = null;
  let capturedDirectDiff = '';
  let agentCallCount = 0;

  const { result, repoRoot } = await runGenerate({
    provider: 'openai',
    generateMode: 'direct-diff',
    commitOutputOptions: {
      includeScope: true,
      includeBody: false,
      includeFooter: false,
    },
    runAgentLoop: async () => {
      agentCallCount++;
      return 'should not be used';
    },
    createLLMClient: (clientOptions) => {
      capturedClientOptions = clientOptions as unknown as Record<
        string,
        unknown
      >;
      return {
        generateCommitMessage: async (diff) => {
          capturedDirectDiff = diff;
          return 'fix(ui): use direct diff mode\n\nBypass agent tools for this run.';
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
    assert.ok(capturedClientOptions);
    const clientOptions = capturedClientOptions as unknown as {
      provider: string;
      model: string;
      commitOutputOptions: CommitOutputOptions;
    };
    assert.equal(clientOptions.provider, 'openai');
    assert.equal(clientOptions.model, DEFAULT_MODELS.openai);
    assert.deepEqual(clientOptions.commitOutputOptions, {
      includeScope: true,
      includeBody: false,
      includeFooter: false,
    });
    assert.match(capturedDirectDiff, /diff --git a\/a\.ts b\/a\.ts/);
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('generateCommitMessage forces ollama to direct diff even if agentic requested', async () => {
  let capturedClientOptions: Record<string, unknown> | null = null;
  let agentCallCount = 0;

  const { result, repoRoot } = await runGenerate({
    provider: 'ollama',
    generateMode: 'agentic',
    runAgentLoop: async () => {
      agentCallCount++;
      return 'should not be used';
    },
    createLLMClient: (clientOptions) => {
      capturedClientOptions = clientOptions as unknown as Record<
        string,
        unknown
      >;
      return {
        generateCommitMessage: async () =>
          'chore(local): use ollama direct diff\n\nEnforced direct mode for local provider.',
      };
    },
  });

  try {
    assert.equal(result.success, true);
    assert.equal(agentCallCount, 0);
    assert.ok(capturedClientOptions);
    const clientOptions = capturedClientOptions as unknown as {
      provider: string;
      model: string;
      commitOutputOptions: CommitOutputOptions;
    };
    assert.equal(clientOptions.provider, 'ollama');
    assert.equal(clientOptions.model, DEFAULT_MODELS.ollama);
    assert.deepEqual(
      clientOptions.commitOutputOptions,
      DEFAULT_COMMIT_OUTPUT_OPTIONS,
    );
  } finally {
    cleanupTempDir(repoRoot);
  }
});

test('generateCommitMessage returns cancelled when cancellation is already requested', async () => {
  let directCallCount = 0;
  let agentCallCount = 0;

  const { result, repoRoot } = await runGenerate({
    provider: 'openai',
    generateMode: 'direct-diff',
    cancellationToken: { isCancellationRequested: true },
    runAgentLoop: async () => {
      agentCallCount++;
      return 'should not be used';
    },
    createLLMClient: () => {
      directCallCount++;
      return {
        generateCommitMessage: async () => 'should not be used',
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
