export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
  shouldRetry?: (error: unknown) => boolean;
  checkAbort?: () => void;
  onRetry?: (info: RetryInfo) => void;
}

export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error: unknown;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 4,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  jitterMs: 250,
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const shouldRetry = options.shouldRetry || isRetryableError;
  let attempt = 0;

  while (true) {
    options.checkAbort?.();
    try {
      attempt += 1;
      return await operation();
    } catch (error) {
      if (isCancellationError(error)) {
        throw error;
      }

      options.checkAbort?.();

      if (attempt >= options.maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      const delayMs = getRetryDelayMs(error, attempt, options);
      options.onRetry?.({
        attempt,
        maxAttempts: options.maxAttempts,
        delayMs,
        error,
      });
      await sleep(delayMs, options.checkAbort);
    }
  }
}

function getRetryDelayMs(
  error: unknown,
  attempt: number,
  options: RetryOptions,
): number {
  const retryAfterMs = extractRetryAfterMs(error);
  const baseDelay = Math.min(
    options.maxDelayMs,
    options.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)),
  );
  const jitter = Math.floor(Math.random() * (options.jitterMs + 1));

  if (retryAfterMs !== null && retryAfterMs !== undefined) {
    const clampedRetryAfterDelay = Math.min(
      options.maxDelayMs,
      Math.max(options.baseDelayMs, retryAfterMs),
    );
    return clampedRetryAfterDelay + jitter;
  }

  const clampedDelay = Math.min(
    options.maxDelayMs,
    Math.max(options.baseDelayMs, baseDelay),
  );

  return clampedDelay + jitter;
}

function extractRetryAfterMs(error: unknown): number | null {
  const headers = getHeaders(error);
  const value =
    getHeaderValue(headers, 'retry-after') ??
    getHeaderValue(headers, 'Retry-After');
  return parseRetryAfterMs(value);
}

function getHeaders(error: any): any {
  if (!error) return null;
  return error.headers || error.response?.headers || error.response?.header;
}

function getHeaderValue(headers: any, name: string): unknown {
  if (!headers) return null;
  if (typeof headers.get === 'function') {
    return headers.get(name);
  }
  return headers[name] ?? headers[name.toLowerCase()];
}

function parseRetryAfterMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value * 1000);
  }
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return Math.max(0, asNumber * 1000);
    }
    const dateMs = Date.parse(value);
    if (!Number.isNaN(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }
  }
  return null;
}

function isRetryableError(error: any): boolean {
  if (isCancellationError(error)) {
    return false;
  }

  const status = getStatus(error);
  if (isAuthError(status, error)) {
    return false;
  }

  if (status === 429 || (typeof status === 'number' && status >= 500)) {
    return true;
  }

  const code = String(error?.code || error?.errno || '').toUpperCase();
  if (
    code.includes('ECONNRESET') ||
    code.includes('ETIMEDOUT') ||
    code.includes('ECONNREFUSED') ||
    code.includes('EAI_AGAIN') ||
    code.includes('ENOTFOUND') ||
    code.includes('ENETUNREACH')
  ) {
    return true;
  }

  const message = String(error?.message || error || '').toLowerCase();
  if (
    message.includes('rate limit') ||
    message.includes('rate_limit') ||
    message.includes('quota') ||
    message.includes('temporarily') ||
    message.includes('server error') ||
    message.includes('overloaded') ||
    message.includes('timeout') ||
    /\b429\b/.test(message)
  ) {
    return true;
  }

  return false;
}

function isCancellationError(error: any): boolean {
  return (
    error?.name === 'GenerationCancelledError' ||
    String(error?.code || '').toUpperCase() === 'CANCELLED'
  );
}

function isAuthError(status: number | null, error: any): boolean {
  if (status === 401 || status === 403) {
    return true;
  }
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('invalid api key') ||
    message.includes('invalid_api_key') ||
    message.includes('api_key_invalid') ||
    message.includes('unauthorized') ||
    message.includes('permission denied')
  );
}

function getStatus(error: any): number | null {
  const status =
    error?.status ??
    error?.statusCode ??
    error?.response?.status ??
    error?.response?.statusCode;
  return typeof status === 'number' ? status : null;
}

async function sleep(ms: number, checkAbort?: () => void): Promise<void> {
  if (!checkAbort) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return;
  }

  const pollIntervalMs = 100;
  let remainingMs = ms;

  while (remainingMs > 0) {
    checkAbort();
    const waitMs = Math.min(pollIntervalMs, remainingMs);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    remainingMs -= waitMs;
  }

  checkAbort();
}
