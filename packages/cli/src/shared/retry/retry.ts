import { extractErrorCause, extractHttpStatus } from '../errors/errors.js';
import { delay } from '../timers/timers.js';

const MAX_ATTEMPTS = 4;
const INITIAL_DELAY_MS = 250;

export interface RetryOptions {
  readonly onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
  readonly delay?: (milliseconds: number) => Promise<void>;
}

export async function withExponentialRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  let attempt = 1;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isTransientError(error)) throw error;

      const delayMs = INITIAL_DELAY_MS * 2 ** (attempt - 1);
      options.onRetry?.(attempt, delayMs, error);
      await (options.delay ?? delay)(delayMs);
      attempt += 1;
    }
  }
}

function isTransientError(error: unknown): boolean {
  return transientStatus(error) || transientNetworkCode(error);
}

function transientStatus(error: unknown): boolean {
  const status = httpStatusCodeOf(error);

  return status !== undefined && isRetryableHttpStatus(status);
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function httpStatusCodeOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  return extractHttpStatus(error) ?? httpStatusCodeOf(extractErrorCause(error));
}

function transientNetworkCode(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error ? (error as { code?: unknown }).code : undefined;

  if (
    code === 'ECONNABORTED' ||
    code === 'ECONNRESET' ||
    code === 'EAI_AGAIN' ||
    code === 'ENETUNREACH' ||
    code === 'ETIMEDOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_SOCKET'
  ) {
    return true;
  }

  return transientNetworkCode(extractErrorCause(error));
}
