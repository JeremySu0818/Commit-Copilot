import { buildAgentSystemPrompt } from './agent-loop/shared';
import {
  CancellationSignal,
  throwIfCancellationRequested,
} from './cancellation';
import {
  APIKeyMissingError,
  APIKeyInvalidError,
  APIQuotaExceededError,
  APIRequestError,
  GenerationCancelledError,
  NoChangesError,
} from './errors';
import {
  APIProvider,
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_MODELS,
  OLLAMA_DEFAULT_HOST,
  getAnthropicModelMaxTokens,
  normalizeCommitOutputOptions,
} from './models';
import { DEFAULT_RETRY_OPTIONS, withRetry } from './retry';

export interface LLMClientOptions {
  provider: APIProvider;
  apiKey: string;
  ollamaHost?: string;
  baseUrl?: string;
  model?: string;
  commitOutputOptions?: CommitOutputOptions;
}

export type ProgressCallback = (message: string, increment?: number) => void;

const unauthorizedStatus = 401;
const forbiddenStatus = 403;
const tooManyRequestsStatus = 429;
const progressPercentageScale = 100;
const geminiAuthMessagePatterns = [
  'unauthorized',
  'forbidden',
  'api key invalid',
  'invalid api key',
  'unauthenticated',
  'permission denied',
];
const geminiQuotaMessagePatterns = [
  'too many requests',
  'resource exhausted',
  'rate limit',
  'rate_limited',
  'quota exceeded',
  'quota exhausted',
  'quota reached',
  'quota limited',
];
const statusPrefixes = [
  'status',
  'status code',
  'http status',
  'response status',
];

type UnknownRecord = Record<string, unknown>;

interface ErrorLike {
  status?: unknown;
  statusCode?: unknown;
  response?: unknown;
  code?: unknown;
  error?: unknown;
  message?: unknown;
}

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toErrorLike(error: unknown): ErrorLike {
  return isRecord(error) ? (error as ErrorLike) : {};
}

function pickNonEmpty(primary: string | undefined, fallback: string): string {
  return primary && primary.length > 0 ? primary : fallback;
}

function isAnthropicTextBlock(value: unknown): value is AnthropicTextBlock {
  return (
    isRecord(value) && value.type === 'text' && typeof value.text === 'string'
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return String(error);
}

function getErrorStatus(error: unknown): number | null {
  const candidate = toErrorLike(error);
  const response = toErrorLike(candidate.response);
  const status =
    candidate.status ??
    candidate.statusCode ??
    response.status ??
    response.statusCode;
  if (typeof status === 'number') {
    return status;
  }
  if (typeof status === 'string' && /^\d{3}$/.test(status)) {
    return Number(status);
  }
  return null;
}

function getErrorCode(error: unknown): string {
  const candidate = toErrorLike(error);
  const nestedError = toErrorLike(candidate.error);
  const rawCode = candidate.code ?? nestedError.status ?? nestedError.code;
  if (typeof rawCode === 'string' || typeof rawCode === 'number') {
    return String(rawCode).toUpperCase();
  }
  return '';
}

function hasStatusToken(message: string, status: number): boolean {
  const normalized = message.toLowerCase();
  const statusText = String(status);

  for (const prefix of statusPrefixes) {
    if (
      normalized.includes(`${prefix} ${statusText}`) ||
      normalized.includes(`${prefix}: ${statusText}`) ||
      normalized.includes(`${prefix}:${statusText}`) ||
      normalized.includes(`${prefix}=${statusText}`) ||
      normalized.includes(`${prefix} = ${statusText}`)
    ) {
      return true;
    }
  }

  return false;
}

function includesAnyPattern(message: string, patterns: string[]): boolean {
  const normalized = message.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

async function reportOllamaPullProgress(
  pullStream: AsyncIterable<{
    status?: string;
    total?: number;
    completed?: number;
  }>,
  modelName: string,
  onProgress: ProgressCallback | undefined,
  cancellationToken: CancellationSignal | undefined,
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
          `Pulling ${modelName}: ${part.status ?? ''} (${String(percent)}%)`,
          increment,
        );
      }
      continue;
    }

    if (part.status) {
      onProgress?.(`Pulling ${modelName}: ${part.status}`);
    }
  }
}

function rethrowMappedOllamaClientError(
  message: string,
  host: string,
  modelName: string,
): never {
  if (message.includes('ECONNREFUSED') || message.includes('connect')) {
    throw new APIRequestError(
      `Cannot connect to Ollama. Make sure Ollama is running at ${host}`,
    );
  }
  if (message.includes('model') && message.includes('not found')) {
    throw new APIRequestError(
      `Model "${modelName}" not found. Please pull it first with: ollama pull ${modelName}`,
    );
  }
  throw new APIRequestError(message);
}

function isGeminiAuthError(error: unknown, message: string): boolean {
  const status = getErrorStatus(error);
  if (status === unauthorizedStatus || status === forbiddenStatus) {
    return true;
  }

  const code = getErrorCode(error);
  if (
    code === 'API_KEY_INVALID' ||
    code === 'INVALID_API_KEY' ||
    code === 'UNAUTHENTICATED' ||
    code === 'AUTHENTICATION_ERROR' ||
    code === 'PERMISSION_DENIED'
  ) {
    return true;
  }

  return (
    hasStatusToken(message, unauthorizedStatus) ||
    hasStatusToken(message, forbiddenStatus) ||
    includesAnyPattern(message, geminiAuthMessagePatterns)
  );
}

function isGeminiQuotaError(error: unknown, message: string): boolean {
  const status = getErrorStatus(error);
  if (status === tooManyRequestsStatus) {
    return true;
  }

  const code = getErrorCode(error);
  if (
    code === 'RESOURCE_EXHAUSTED' ||
    code === 'QUOTA_EXCEEDED' ||
    code === 'RATE_LIMIT_EXCEEDED' ||
    code === 'TOO_MANY_REQUESTS'
  ) {
    return true;
  }

  return (
    hasStatusToken(message, tooManyRequestsStatus) ||
    includesAnyPattern(message, geminiQuotaMessagePatterns)
  );
}

export interface ILLMClient {
  generateCommitMessage(
    diff: string,
    onProgress?: ProgressCallback,
    cancellationToken?: CancellationSignal,
  ): Promise<string>;
}

export class GeminiClient implements ILLMClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor(
    apiKey: string,
    model?: string,
    commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  ) {
    if (!apiKey) {
      throw new APIKeyMissingError();
    }
    this.apiKey = apiKey;
    this.model = pickNonEmpty(model, DEFAULT_MODELS.google).replace(
      /^models\//,
      '',
    );
    this.systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: false,
      enableTools: false,
      commitOutputOptions: normalizeCommitOutputOptions(commitOutputOptions),
    });
  }

  async generateCommitMessage(
    diff: string,
    _onProgress?: ProgressCallback,
    cancellationToken?: CancellationSignal,
  ): Promise<string> {
    throwIfCancellationRequested(cancellationToken);
    if (!diff.trim()) {
      throw new NoChangesError();
    }

    try {
      const { GoogleGenAI: googleGenAIClientClass } =
        await import('@google/genai');
      const client = new googleGenAIClientClass({ apiKey: this.apiKey });
      const retryOptions = {
        ...DEFAULT_RETRY_OPTIONS,
        checkAbort: () => {
          throwIfCancellationRequested(cancellationToken);
        },
      };

      const result = await withRetry(
        () =>
          client.models.generateContent({
            model: this.model,
            contents: [
              {
                role: 'user',
                parts: [{ text: `Here is the git diff:\n\n${diff}` }],
              },
            ],
            config: {
              systemInstruction: this.systemPrompt,
              temperature: 0.7,
              topP: 0.95,
              topK: 40,
            },
          }),
        retryOptions,
      );

      const text = result.text;
      throwIfCancellationRequested(cancellationToken);

      if (!text) {
        throw new APIRequestError('Empty response from Gemini API');
      }

      return text.trim();
    } catch (error: unknown) {
      if (
        error instanceof NoChangesError ||
        error instanceof APIKeyMissingError ||
        error instanceof APIKeyInvalidError ||
        error instanceof APIQuotaExceededError ||
        error instanceof APIRequestError ||
        error instanceof GenerationCancelledError
      ) {
        throw error;
      }

      const message = getErrorMessage(error);

      if (isGeminiAuthError(error, message)) {
        throw new APIKeyInvalidError(message);
      } else if (isGeminiQuotaError(error, message)) {
        throw new APIQuotaExceededError(message);
      }

      throw new APIRequestError(message);
    }
  }
}

export class OpenAIClient implements ILLMClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseURL?: string;
  private readonly systemPrompt: string;

  constructor(
    apiKey: string,
    model?: string,
    commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
    baseURL?: string,
  ) {
    if (!apiKey) {
      throw new APIKeyMissingError();
    }
    this.apiKey = apiKey;
    this.model = pickNonEmpty(model, DEFAULT_MODELS.openai);
    this.baseURL = baseURL;
    this.systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: false,
      enableTools: false,
      commitOutputOptions: normalizeCommitOutputOptions(commitOutputOptions),
    });
  }

  async generateCommitMessage(
    diff: string,
    _onProgress?: ProgressCallback,
    cancellationToken?: CancellationSignal,
  ): Promise<string> {
    throwIfCancellationRequested(cancellationToken);
    if (!diff.trim()) {
      throw new NoChangesError();
    }

    try {
      const openAIClientClass = (await import('openai')).default;
      const client = new openAIClientClass({
        apiKey: this.apiKey,
        ...(this.baseURL ? { baseURL: this.baseURL } : {}),
      });
      const retryOptions = {
        ...DEFAULT_RETRY_OPTIONS,
        checkAbort: () => {
          throwIfCancellationRequested(cancellationToken);
        },
      };
      const completion = await withRetry(
        () =>
          client.chat.completions.create({
            model: this.model,
            messages: [
              { role: 'system', content: this.systemPrompt },
              { role: 'user', content: `Here is the git diff:\n\n${diff}` },
            ],
          }),
        retryOptions,
      );

      const text = completion.choices[0]?.message?.content;
      throwIfCancellationRequested(cancellationToken);

      if (!text) {
        throw new APIRequestError('Empty response from OpenAI API');
      }

      return text.trim();
    } catch (error: unknown) {
      if (
        error instanceof NoChangesError ||
        error instanceof APIKeyMissingError ||
        error instanceof APIKeyInvalidError ||
        error instanceof APIQuotaExceededError ||
        error instanceof APIRequestError ||
        error instanceof GenerationCancelledError
      ) {
        throw error;
      }

      const message = getErrorMessage(error);
      const status = getErrorStatus(error);

      if (
        status === unauthorizedStatus ||
        status === forbiddenStatus ||
        message.includes('Invalid API Key')
      ) {
        throw new APIKeyInvalidError(message);
      } else if (
        status === tooManyRequestsStatus ||
        message.includes('rate limit')
      ) {
        throw new APIQuotaExceededError(message);
      }

      throw new APIRequestError(message);
    }
  }
}

export class AnthropicClient implements ILLMClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly systemPrompt: string;

  constructor(
    apiKey: string,
    model?: string,
    commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  ) {
    if (!apiKey) {
      throw new APIKeyMissingError();
    }
    this.apiKey = apiKey;
    this.model = pickNonEmpty(model, DEFAULT_MODELS.anthropic);
    const maxTokens = getAnthropicModelMaxTokens(this.model);
    if (maxTokens === undefined) {
      throw new APIRequestError(
        `Unknown Anthropic model "${this.model}". Add it to ANTHROPIC_MODELS with max_tokens.`,
      );
    }
    this.maxTokens = maxTokens;
    this.systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: false,
      enableTools: false,
      commitOutputOptions: normalizeCommitOutputOptions(commitOutputOptions),
    });
  }

  async generateCommitMessage(
    diff: string,
    _onProgress?: ProgressCallback,
    cancellationToken?: CancellationSignal,
  ): Promise<string> {
    throwIfCancellationRequested(cancellationToken);
    if (!diff.trim()) {
      throw new NoChangesError();
    }

    try {
      const anthropicClientClass = (await import('@anthropic-ai/sdk')).default;
      const client = new anthropicClientClass({ apiKey: this.apiKey });
      const retryOptions = {
        ...DEFAULT_RETRY_OPTIONS,
        checkAbort: () => {
          throwIfCancellationRequested(cancellationToken);
        },
      };
      const message = await withRetry(
        () =>
          client.messages
            .stream({
              model: this.model,
              max_tokens: this.maxTokens,
              system: this.systemPrompt,
              messages: [
                { role: 'user', content: `Here is the git diff:\n\n${diff}` },
              ],
            })
            .finalMessage(),
        retryOptions,
      );

      const text = message.content
        .map((block: unknown) => (isAnthropicTextBlock(block) ? block.text : ''))
        .join('');
      throwIfCancellationRequested(cancellationToken);

      if (!text) {
        throw new APIRequestError('Empty response from Anthropic API');
      }

      return text.trim();
    } catch (error: unknown) {
      if (
        error instanceof NoChangesError ||
        error instanceof APIKeyMissingError ||
        error instanceof APIKeyInvalidError ||
        error instanceof APIQuotaExceededError ||
        error instanceof APIRequestError ||
        error instanceof GenerationCancelledError
      ) {
        throw error;
      }

      const message = getErrorMessage(error);
      const status = getErrorStatus(error);

      if (
        status === unauthorizedStatus ||
        status === forbiddenStatus ||
        message.includes('invalid_api_key')
      ) {
        throw new APIKeyInvalidError(message);
      } else if (
        status === tooManyRequestsStatus ||
        message.includes('rate_limit')
      ) {
        throw new APIQuotaExceededError(message);
      }

      throw new APIRequestError(message);
    }
  }
}

export class OllamaClient implements ILLMClient {
  private readonly host: string;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor(
    host?: string,
    model?: string,
    commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  ) {
    this.host = pickNonEmpty(host, OLLAMA_DEFAULT_HOST);
    this.model = pickNonEmpty(model, DEFAULT_MODELS.ollama);
    this.systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: false,
      enableTools: false,
      commitOutputOptions: normalizeCommitOutputOptions(commitOutputOptions),
    });
  }

  async generateCommitMessage(
    diff: string,
    onProgress?: ProgressCallback,
    cancellationToken?: CancellationSignal,
  ): Promise<string> {
    throwIfCancellationRequested(cancellationToken);
    if (!diff.trim()) {
      throw new NoChangesError();
    }

    try {
      const { Ollama: ollamaClientClass } = await import('ollama');
      const client = new ollamaClientClass({ host: this.host });

      const pullStream = await client.pull({ model: this.model, stream: true });
      await reportOllamaPullProgress(
        pullStream,
        this.model,
        onProgress,
        cancellationToken,
      );

      if (onProgress) {
        onProgress('Generating commit message...', 0);
      }

      const response = await client.chat({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Here is the git diff:\n\n${diff}` },
        ],
        options: {
          temperature: 0.7,
          top_p: 0.95,
        },
      });

      const text = response.message.content;
      throwIfCancellationRequested(cancellationToken);

      if (!text) {
        throw new APIRequestError('Empty response from Ollama');
      }

      return text.trim();
    } catch (error: unknown) {
      if (
        error instanceof NoChangesError ||
        error instanceof GenerationCancelledError
      ) {
        throw error;
      }

      const message = getErrorMessage(error);
      rethrowMappedOllamaClientError(message, this.host, this.model);
    }
  }
}

export function createLLMClient(options: LLMClientOptions): ILLMClient {
  const { provider, apiKey, ollamaHost, baseUrl, model, commitOutputOptions } =
    options;
  const resolvedCommitOutputOptions =
    normalizeCommitOutputOptions(commitOutputOptions);

  if (baseUrl) {
    return new OpenAIClient(
      apiKey,
      model,
      resolvedCommitOutputOptions,
      baseUrl,
    );
  }

  switch (provider) {
    case 'google':
      return new GeminiClient(apiKey, model, resolvedCommitOutputOptions);
    case 'openai':
      return new OpenAIClient(apiKey, model, resolvedCommitOutputOptions);
    case 'anthropic':
      return new AnthropicClient(apiKey, model, resolvedCommitOutputOptions);
    case 'ollama': {
      const resolvedOllamaHost = pickNonEmpty(ollamaHost, apiKey);
      return new OllamaClient(
        resolvedOllamaHost,
        model,
        resolvedCommitOutputOptions,
      );
    }
    default:
      throw new Error(`Unsupported provider: ${String(provider)}`);
  }
}
