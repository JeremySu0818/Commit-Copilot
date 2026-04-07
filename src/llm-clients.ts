import {
  APIProvider,
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_MODELS,
  OLLAMA_DEFAULT_HOST,
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
  model?: string;
  commitOutputOptions?: CommitOutputOptions;
}

export type ProgressCallback = (message: string, increment?: number) => void;

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
    this.model = (model || DEFAULT_MODELS.google).replace(/^models\//, '');
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
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const client = new GoogleGenerativeAI(this.apiKey);
      const generativeModel = client.getGenerativeModel({
        model: this.model,
        systemInstruction: this.systemPrompt,
      });

      const result = await withRetry(
        () =>
          generativeModel.generateContent({
            contents: [
              {
                role: 'user',
                parts: [{ text: `Here is the git diff:\n\n${diff}` }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topP: 0.95,
              topK: 40,
            },
          }),
        DEFAULT_RETRY_OPTIONS,
      );

      const response = result.response;
      const text = response.text();
      throwIfCancellationRequested(cancellationToken);

      if (!text) {
        throw new APIRequestError('Empty response from Gemini API');
      }

      return text.trim();
    } catch (error: any) {
      if (
        error instanceof NoChangesError ||
        error instanceof APIKeyMissingError ||
        error instanceof GenerationCancelledError
      ) {
        throw error;
      }

      const message = error?.message || String(error);

      if (
        message.includes('API_KEY_INVALID') ||
        message.includes('401') ||
        message.includes('403')
      ) {
        throw new APIKeyInvalidError(message);
      } else if (message.includes('429') || message.includes('quota')) {
        throw new APIQuotaExceededError(message);
      }

      throw new APIRequestError(message);
    }
  }
}

export class OpenAIClient implements ILLMClient {
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
    this.model = model || DEFAULT_MODELS.openai;
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
      const client = new OpenAI({ apiKey: this.apiKey });
      const completion = await withRetry(
        () =>
          client.chat.completions.create({
            model: this.model,
            messages: [
              { role: 'system', content: this.systemPrompt },
              { role: 'user', content: `Here is the git diff:\n\n${diff}` },
            ],
          }),
        DEFAULT_RETRY_OPTIONS,
      );

      const text = completion.choices[0]?.message?.content;
      throwIfCancellationRequested(cancellationToken);

      if (!text) {
        throw new APIRequestError('Empty response from OpenAI API');
      }

      return text.trim();
    } catch (error: any) {
      if (
        error instanceof NoChangesError ||
        error instanceof APIKeyMissingError ||
        error instanceof GenerationCancelledError
      ) {
        throw error;
      }

      const message = error?.message || String(error);
      const status = error?.status;

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
    this.model = model || DEFAULT_MODELS.anthropic;
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
      const message = await withRetry(
        () =>
          client.messages.create({
            model: this.model,
            max_tokens: 65536,
            system: this.systemPrompt,
            messages: [
              { role: 'user', content: `Here is the git diff:\n\n${diff}` },
            ],
          }),
        DEFAULT_RETRY_OPTIONS,
      );

      const textBlock = message.content.find(
        (block: { type: string }) => block.type === 'text',
      );
      const text =
        textBlock && textBlock.type === 'text' ? (textBlock as any).text : null;
      throwIfCancellationRequested(cancellationToken);

      if (!text) {
        throw new APIRequestError('Empty response from Anthropic API');
      }

      return text.trim();
    } catch (error: any) {
      if (
        error instanceof NoChangesError ||
        error instanceof APIKeyMissingError ||
        error instanceof GenerationCancelledError
      ) {
        throw error;
      }

      const message = error?.message || String(error);
      const status = error?.status;

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
    this.host = host || OLLAMA_DEFAULT_HOST;
    this.model = model || DEFAULT_MODELS.ollama;
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
                `Pulling ${this.model}: ${part.status} (${percent}%)`,
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

      const text = response.message?.content;
      throwIfCancellationRequested(cancellationToken);

      if (!text) {
        throw new APIRequestError('Empty response from Ollama');
      }

      return text.trim();
    } catch (error: any) {
      if (
        error instanceof NoChangesError ||
        error instanceof GenerationCancelledError
      ) {
        throw error;
      }

      const message = error?.message || String(error);

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
  const { provider, apiKey, ollamaHost, model, commitOutputOptions } = options;
  const resolvedCommitOutputOptions =
    normalizeCommitOutputOptions(commitOutputOptions);

  switch (provider) {
    case 'google':
      return new GeminiClient(apiKey, model, resolvedCommitOutputOptions);
    case 'openai':
      return new OpenAIClient(apiKey, model, resolvedCommitOutputOptions);
    case 'anthropic':
      return new AnthropicClient(apiKey, model, resolvedCommitOutputOptions);
    case 'ollama': {
      const resolvedOllamaHost = ollamaHost || apiKey;
      return new OllamaClient(
        resolvedOllamaHost,
        model,
        resolvedCommitOutputOptions,
      );
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
