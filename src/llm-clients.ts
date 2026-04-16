import {
  APIProvider,
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_MODELS,
  OLLAMA_DEFAULT_HOST,
  getAnthropicModelMaxTokens,
  normalizeCommitOutputOptions,
} from './models';
import { buildAgentSystemPrompt } from './agent-loop/shared';
import { DEFAULT_RETRY_OPTIONS, withRetry } from './retry';
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

export interface LLMClientOptions {
  provider: APIProvider;
  apiKey: string;
  ollamaHost?: string;
  baseUrl?: string;
  model?: string;
  commitOutputOptions?: CommitOutputOptions;
}

export type ProgressCallback = (message: string, increment?: number) => void;

const GEMINI_AUTH_STATUS_PATTERN =
  /\b(?:status(?:\s*code)?|http(?:\s*status)?|response(?:\s*status)?)\s*[:=]?\s*(401|403)\b/i;
const GEMINI_QUOTA_STATUS_PATTERN =
  /\b(?:status(?:\s*code)?|http(?:\s*status)?|response(?:\s*status)?)\s*[:=]?\s*429\b/i;

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

function isGeminiAuthError(error: unknown, message: string): boolean {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) {
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
    GEMINI_AUTH_STATUS_PATTERN.test(message) ||
    /\b(?:401\s+unauthorized|403\s+forbidden|api[_\s-]?key[_\s-]?invalid|invalid[_\s-]?api[_\s-]?key|unauthenticated|permission denied)\b/i.test(
      message,
    )
  );
}

function isGeminiQuotaError(error: unknown, message: string): boolean {
  const status = getErrorStatus(error);
  if (status === 429) {
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
    GEMINI_QUOTA_STATUS_PATTERN.test(message) ||
    /\b(?:429\s+too many requests|resource[_\s-]?exhausted|rate[\s_-]?limit(?:ed)?|quota(?:\s+(?:exceeded|exhausted|reached|limit(?:ed)?)))\b/i.test(
      message,
    )
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
      const { GoogleGenAI } = await import('@google/genai');
      const client = new GoogleGenAI({ apiKey: this.apiKey });
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
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
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
        status === 401 ||
        status === 403 ||
        message.includes('Invalid API Key')
      ) {
        throw new APIKeyInvalidError(message);
      } else if (status === 429 || message.includes('rate limit')) {
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
    this.maxTokens = getAnthropicModelMaxTokens(this.model) ?? 65536;
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
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: this.apiKey });
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
        .map((block: unknown) =>
          isAnthropicTextBlock(block) ? block.text : null,
        )
        .find(
          (blockText): blockText is string => typeof blockText === 'string',
        );
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
        status === 401 ||
        status === 403 ||
        message.includes('invalid_api_key')
      ) {
        throw new APIKeyInvalidError(message);
      } else if (status === 429 || message.includes('rate_limit')) {
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
      const { Ollama } = await import('ollama');
      const client = new Ollama({ host: this.host });

      const pullStream = await client.pull({ model: this.model, stream: true });
      let lastPercent = 0;
      for await (const part of pullStream) {
        throwIfCancellationRequested(cancellationToken);
        if (part.total && part.completed) {
          const percent = Math.round((part.completed / part.total) * 100);
          if (percent > lastPercent) {
            const increment = percent - lastPercent;
            lastPercent = percent;
            if (onProgress) {
              onProgress(
                `Pulling ${this.model}: ${part.status} (${String(percent)}%)`,
                increment,
              );
            }
          }
        } else if (part.status && onProgress) {
          onProgress(`Pulling ${this.model}: ${part.status}`);
        }
      }

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

      if (message.includes('ECONNREFUSED') || message.includes('connect')) {
        throw new APIRequestError(
          `Cannot connect to Ollama. Make sure Ollama is running at ${this.host}`,
        );
      } else if (message.includes('model') && message.includes('not found')) {
        throw new APIRequestError(
          `Model "${this.model}" not found. Please pull it first with: ollama pull ${this.model}`,
        );
      }

      throw new APIRequestError(message);
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
