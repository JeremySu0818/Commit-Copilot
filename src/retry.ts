import { randomInt } from 'crypto';

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

type UnknownRecord = Record<string, unknown>;

interface ErrorLike {
  status?: unknown;
  statusCode?: unknown;
  response?: unknown;
  headers?: unknown;
  header?: unknown;
  code?: unknown;
  errno?: unknown;
  message?: unknown;
  name?: unknown;
}

const secondsToMilliseconds = 1000;
const retryBackoffBase = 2;
const unauthorizedStatus = 401;
const forbiddenStatus = 403;
const tooManyRequestsStatus = 429;
const serverErrorStatusFloor = 500;
const sleepPollIntervalMs = 100;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toErrorLike(error: unknown): ErrorLike {
  return isRecord(error) ? (error as ErrorLike) : {};
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return '';
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const shouldRetry = options.shouldRetry ?? isRetryableError;
  let attempt = 0;

  while (attempt < options.maxAttempts) {
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
  throw new Error(
    `withRetry: exhausted ${String(options.maxAttempts)} attempts`,
  );
}

function getRetryDelayMs(
  error: unknown,
  attempt: number,
  options: RetryOptions,
): number {
  const retryAfterMs = extractRetryAfterMs(error);
  const baseDelay = Math.min(
    options.maxDelayMs,
    options.baseDelayMs * Math.pow(retryBackoffBase, Math.max(0, attempt - 1)),
  );
  const jitter = options.jitterMs > 0 ? randomInt(options.jitterMs + 1) : 0;

  if (retryAfterMs !== null) {
    const retryAfterDelay = Math.max(options.baseDelayMs, retryAfterMs);
    return Math.min(options.maxDelayMs, retryAfterDelay + jitter);
  }

  const delay = Math.max(options.baseDelayMs, baseDelay);
  return Math.min(options.maxDelayMs, delay + jitter);
}

function extractRetryAfterMs(error: unknown): number | null {
  const headers = getHeaders(error);
  const value =
    getHeaderValue(headers, 'retry-after') ??
    getHeaderValue(headers, 'Retry-After');
  return parseRetryAfterMs(value);
}

function getHeaders(error: unknown): unknown {
  const candidate = toErrorLike(error);
  const response = toErrorLike(candidate.response);
  return candidate.headers ?? response.headers ?? response.header ?? null;
}

function getHeaderValue(headers: unknown, name: string): unknown {
  if (!isRecord(headers)) {
    return null;
  }
  if ('get' in headers && typeof headers.get === 'function') {
    const getMethod = headers.get as (headerName: string) => unknown;
    return getMethod(name);
  }
  return headers[name] ?? headers[name.toLowerCase()];
}

function parseRetryAfterMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value * secondsToMilliseconds);
  }
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return Math.max(0, asNumber * secondsToMilliseconds);
    }
    const dateMs = Date.parse(value);
    if (!Number.isNaN(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }
  }
  return null;
}

function isRetryableError(error: unknown): boolean {
  if (isCancellationError(error)) {
    return false;
  }

  const status = getStatus(error);
  if (isAuthError(status, error)) {
    return false;
  }

  if (
    status === tooManyRequestsStatus ||
    (typeof status === 'number' && status >= serverErrorStatusFloor)
  ) {
    return true;
  }

  const candidate = toErrorLike(error);
  const code = toText(candidate.code ?? candidate.errno).toUpperCase();
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

  const message = (
    toText(candidate.message) || (error instanceof Error ? error.message : '')
  ).toLowerCase();
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

function isCancellationError(error: unknown): boolean {
  const candidate = toErrorLike(error);
  return (
    candidate.name === 'GenerationCancelledError' ||
    toText(candidate.code).toUpperCase() === 'CANCELLED'
  );
}

function isAuthError(status: number | null, error: unknown): boolean {
  if (status === unauthorizedStatus || status === forbiddenStatus) {
    return true;
  }
  const candidate = toErrorLike(error);
  const message = (
    toText(candidate.message) || (error instanceof Error ? error.message : '')
  ).toLowerCase();
  return (
    message.includes('invalid api key') ||
    message.includes('invalid_api_key') ||
    message.includes('api_key_invalid') ||
    message.includes('unauthorized') ||
    message.includes('permission denied')
  );
}

function getStatus(error: unknown): number | null {
  const candidate = toErrorLike(error);
  const response = toErrorLike(candidate.response);
  const status =
    candidate.status ??
    candidate.statusCode ??
    response.status ??
    response.statusCode;
  return typeof status === 'number' ? status : null;
}

async function sleep(ms: number, checkAbort?: () => void): Promise<void> {
  if (!checkAbort) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return;
  }

  let remainingMs = ms;

  while (remainingMs > 0) {
    checkAbort();
    const waitMs = Math.min(sleepPollIntervalMs, remainingMs);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    remainingMs -= waitMs;
  }

  checkAbort();
}
