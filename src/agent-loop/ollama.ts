import { buildInitialContext, executeToolCall } from '../agent-tools';
import {
  CancellationSignal,
  throwIfCancellationRequested,
} from '../cancellation';
import { GitOperations } from '../commit-copilot';
import {
  APIRequestError,
  GenerationCancelledError,
  NoChangesError,
  createEmptyFinalResponseError,
  createEmptyResponseError,
  createOllamaConnectionError,
  createOllamaModelNotFoundError,
} from '../errors';
import { LOCALIZED_PROMPTS } from '../i18n/prompts/index';
import type { EffectiveDisplayLanguage } from '../i18n/types';
import { LOCALES } from '../i18n/ui';
import { ProgressCallback } from '../llm-clients';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_MODELS,
  OLLAMA_DEFAULT_HOST,
  normalizeCommitOutputOptions,
} from '../models';

import {
  buildOllamaFinalToolReminder,
  buildOllamaProtocolCorrection,
  buildOllamaToolProtocolPrompt,
  formatOllamaToolResults,
  parseOllamaToolCalls,
  ParsedOllamaToolCall,
} from './ollama-tool-protocol';
import {
  buildAgentSystemPrompt,
  extractCommitMessage,
  extractFinalCommitMessageFromArgs,
  FINAL_COMMIT_MESSAGE_TOOL_NAME,
  formatBatchProgressMessage,
} from './shared';

const progressPercentageScale = 100;
const ollamaTemperature = 0.2;
const ollamaTopP = 0.9;

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatClient {
  chat(params: {
    model: string;
    messages: OllamaMessage[];
    options: {
      temperature: number;
      top_p: number;
    };
  }): Promise<{ message: { content?: string } }>;
}

function pickNonEmpty(primary: string | undefined, fallback: string): string {
  return primary && primary.length > 0 ? primary : fallback;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return String(error);
}

async function reportPullProgress(
  pullStream: AsyncIterable<{
    status?: string;
    total?: number;
    completed?: number;
  }>,
  modelName: string,
  onProgress: ProgressCallback | undefined,
  cancellationToken: CancellationSignal | undefined,
  language: EffectiveDisplayLanguage,
): Promise<void> {
  let lastPercent = 0;
  for await (const part of pullStream) {
    throwIfCancellationRequested(cancellationToken);
    if (part.total && part.completed) {
      const percent = Math.round(
        (part.completed / part.total) * progressPercentageScale,
      );
      if (percent > lastPercent) {
        const increment = percent - lastPercent;
        lastPercent = percent;
        onProgress?.(
          LOCALES[language].progressMessages.pulling(
            modelName,
            part.status ?? '',
            percent,
          ),
          increment,
        );
      }
      continue;
    }

    if (part.status) {
      onProgress?.(
        LOCALES[language].progressMessages.pulling(modelName, part.status),
      );
    }
  }
}

function rethrowMappedOllamaError(
  message: string,
  resolvedHost: string,
  modelName: string,
): never {
  if (message.includes('ECONNREFUSED') || message.includes('connect')) {
    throw createOllamaConnectionError(resolvedHost);
  }
  if (message.includes('model') && message.includes('not found')) {
    throw createOllamaModelNotFoundError(modelName);
  }
  throw new APIRequestError(message);
}

function resolveStepLimit(maxAgentSteps: number | undefined): number {
  return maxAgentSteps && maxAgentSteps > 0
    ? maxAgentSteps
    : Number.POSITIVE_INFINITY;
}

async function requestOllamaResponse(params: {
  client: OllamaChatClient;
  modelName: string;
  messages: OllamaMessage[];
  cancellationToken?: CancellationSignal;
  final?: boolean;
}): Promise<string> {
  throwIfCancellationRequested(params.cancellationToken);
  const response = await params.client.chat({
    model: params.modelName,
    messages: [...params.messages],
    options: {
      temperature: ollamaTemperature,
      top_p: ollamaTopP,
    },
  });
  throwIfCancellationRequested(params.cancellationToken);
  const text = response.message.content?.trim();
  if (!text) {
    if (params.final) {
      throw createEmptyFinalResponseError('Ollama');
    }
    throw createEmptyResponseError('Ollama');
  }
  return text;
}

async function executeOllamaToolCalls(params: {
  calls: ParsedOllamaToolCall[];
  step: number;
  repoRoot: string;
  diff: string;
  isStaged: boolean;
  gitOps?: GitOperations;
  cancellationToken?: CancellationSignal;
}): Promise<string> {
  const results = await Promise.all(
    params.calls.map(async (call) => {
      const id = `step-${String(params.step)}-call-${String(call.index + 1)}`;
      if (call.error) {
        return {
          id,
          name: call.name,
          success: false,
          content: `protocol_error:${call.error}`,
        };
      }

      throwIfCancellationRequested(params.cancellationToken);
      const result = await executeToolCall(
        { name: call.name, arguments: call.arguments },
        params.repoRoot,
        params.diff,
        params.isStaged,
        params.gitOps,
      );
      return {
        id,
        name: call.name,
        success: !result.error,
        content: result.content,
      };
    }),
  );
  throwIfCancellationRequested(params.cancellationToken);
  return formatOllamaToolResults(results);
}

async function handleOllamaToolBatch(params: {
  calls: ParsedOllamaToolCall[];
  messages: OllamaMessage[];
  rawResponse: string;
  step: number;
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
  repoRoot: string;
  diff: string;
  isStaged: boolean;
  gitOps?: GitOperations;
  cancellationToken?: CancellationSignal;
}): Promise<string | null> {
  params.onProgress?.(
    formatBatchProgressMessage(
      params.step,
      params.calls.map((call) => ({
        name: call.name,
        args: call.arguments,
      })),
      params.language,
    ),
  );

  const finalCall = params.calls.find(
    (call) =>
      call.name === FINAL_COMMIT_MESSAGE_TOOL_NAME && call.error === undefined,
  );
  if (finalCall) {
    const finalMessage = extractFinalCommitMessageFromArgs(finalCall.arguments);
    if (finalMessage) {
      return finalMessage;
    }
  }

  params.messages.push({ role: 'assistant', content: params.rawResponse });
  params.messages.push({
    role: 'user',
    content: await executeOllamaToolCalls({
      calls: params.calls,
      step: params.step,
      repoRoot: params.repoRoot,
      diff: params.diff,
      isStaged: params.isStaged,
      gitOps: params.gitOps,
      cancellationToken: params.cancellationToken,
    }),
  });
  return null;
}

async function executeOllamaInvestigationLoop(params: {
  client: OllamaChatClient;
  modelName: string;
  messages: OllamaMessage[];
  stepLimit: number;
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
  repoRoot: string;
  diff: string;
  isStaged: boolean;
  gitOps?: GitOperations;
  cancellationToken?: CancellationSignal;
  commitMessageLanguage: EffectiveDisplayLanguage;
  progressState: { nextStep: number };
}): Promise<string | null> {
  let step = 0;
  let textCorrectionSent = false;

  while (step < params.stepLimit) {
    const text = await requestOllamaResponse({
      client: params.client,
      modelName: params.modelName,
      messages: params.messages,
      cancellationToken: params.cancellationToken,
    });
    const parsed = parseOllamaToolCalls(text);

    if (parsed.kind === 'calls') {
      const finalMessage = await handleOllamaToolBatch({
        calls: parsed.calls,
        messages: params.messages,
        rawResponse: text,
        step: params.progressState.nextStep,
        onProgress: params.onProgress,
        language: params.language,
        repoRoot: params.repoRoot,
        diff: params.diff,
        isStaged: params.isStaged,
        gitOps: params.gitOps,
        cancellationToken: params.cancellationToken,
      });
      if (finalMessage) {
        return finalMessage;
      }
      params.progressState.nextStep += 1;
    } else if (parsed.kind === 'text') {
      if (textCorrectionSent) {
        return extractCommitMessage(parsed.text);
      }
      params.messages.push({ role: 'assistant', content: text });
      params.messages.push({
        role: 'user',
        content: buildOllamaProtocolCorrection(
          LOCALIZED_PROMPTS[params.commitMessageLanguage].ollamaProtocol
            .ordinaryTextError,
          params.commitMessageLanguage,
        ),
      });
      textCorrectionSent = true;
    } else {
      params.messages.push({ role: 'assistant', content: text });
      params.messages.push({
        role: 'user',
        content: buildOllamaProtocolCorrection(
          parsed.error,
          params.commitMessageLanguage,
        ),
      });
    }
    step += 1;
  }

  return null;
}

async function requestOllamaFinalCommitMessage(params: {
  client: OllamaChatClient;
  modelName: string;
  messages: OllamaMessage[];
  cancellationToken?: CancellationSignal;
  commitMessageLanguage: EffectiveDisplayLanguage;
  onProgress?: ProgressCallback;
  language: EffectiveDisplayLanguage;
  progressStep: number;
}): Promise<string> {
  params.messages.push({
    role: 'user',
    content: buildOllamaFinalToolReminder(params.commitMessageLanguage),
  });
  const text = await requestOllamaResponse({
    client: params.client,
    modelName: params.modelName,
    messages: params.messages,
    cancellationToken: params.cancellationToken,
    final: true,
  });
  const parsed = parseOllamaToolCalls(text);
  if (parsed.kind === 'calls') {
    const finalCall = parsed.calls.find(
      (call) =>
        call.name === FINAL_COMMIT_MESSAGE_TOOL_NAME &&
        call.error === undefined,
    );
    if (finalCall) {
      params.onProgress?.(
        formatBatchProgressMessage(
          params.progressStep,
          [{ name: finalCall.name, args: finalCall.arguments }],
          params.language,
        ),
      );
      const finalMessage = extractFinalCommitMessageFromArgs(
        finalCall.arguments,
      );
      if (finalMessage) {
        return finalMessage;
      }
    }
  }
  if (parsed.kind === 'text') {
    return extractCommitMessage(parsed.text);
  }
  throw createEmptyFinalResponseError('Ollama');
}

async function runOllamaAgentLoop(
  host: string | undefined,
  model: string | undefined,
  diff: string,
  repoRoot: string,
  onProgress: ProgressCallback | undefined,
  isStaged: boolean,
  gitOps?: GitOperations,
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  cancellationToken?: CancellationSignal,
  maxAgentSteps?: number,
  draftCommitMessage?: string,
  language: EffectiveDisplayLanguage = 'en',
  commitMessageLanguage: EffectiveDisplayLanguage = 'en',
): Promise<string> {
  throwIfCancellationRequested(cancellationToken);
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  const resolvedHost = pickNonEmpty(host, OLLAMA_DEFAULT_HOST);

  try {
    const { Ollama: ollamaClientClass } = await import('ollama');
    const client = new ollamaClientClass({ host: resolvedHost });
    const modelName = pickNonEmpty(model, DEFAULT_MODELS.ollama);
    const resolvedCommitOutputOptions =
      normalizeCommitOutputOptions(commitOutputOptions);

    const pullStream = await client.pull({ model: modelName, stream: true });
    await reportPullProgress(
      pullStream,
      modelName,
      onProgress,
      cancellationToken,
      language,
    );

    if (onProgress) {
      onProgress(LOCALES[language].progressMessages.generatingMessage, 0);
    }

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
      true,
      resolvedCommitOutputOptions,
      draftCommitMessage,
      commitMessageLanguage,
    );
    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
      commitOutputOptions: resolvedCommitOutputOptions,
      maxAgentSteps,
      language: commitMessageLanguage,
    });
    const messages: OllamaMessage[] = [
      {
        role: 'system',
        content: `${systemPrompt}\n\n${buildOllamaToolProtocolPrompt(
          commitMessageLanguage,
        )}`,
      },
      { role: 'user', content: initialContext },
    ];
    const progressState = { nextStep: 1 };
    const loopResult = await executeOllamaInvestigationLoop({
      client,
      modelName,
      messages,
      stepLimit: resolveStepLimit(maxAgentSteps),
      onProgress,
      language,
      repoRoot,
      diff,
      isStaged,
      gitOps,
      cancellationToken,
      commitMessageLanguage,
      progressState,
    });
    if (loopResult) {
      return loopResult;
    }
    return await requestOllamaFinalCommitMessage({
      client,
      modelName,
      messages,
      cancellationToken,
      commitMessageLanguage,
      onProgress,
      language,
      progressStep: progressState.nextStep,
    });
  } catch (error: unknown) {
    if (
      error instanceof NoChangesError ||
      error instanceof GenerationCancelledError
    ) {
      throw error;
    }
    const message = getErrorMessage(error);
    rethrowMappedOllamaError(
      message,
      resolvedHost,
      pickNonEmpty(model, DEFAULT_MODELS.ollama),
    );
  }
}

export { runOllamaAgentLoop };
