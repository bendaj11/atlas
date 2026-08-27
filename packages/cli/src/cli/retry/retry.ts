const MAX_ATTEMPTS = 4;
const INITIAL_DELAY_MS = 250;

export interface RetryOptions {
  readonly onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
  readonly wait?: (milliseconds: number) => Promise<void>;
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
      await (options.wait ?? wait)(delayMs);
      attempt += 1;
    }
  }
}

function isTransientError(error: unknown): boolean {
  return transientStatus(error) || transientNetworkCode(error);
}

function transientStatus(error: unknown): boolean {
  const status = statusCode(error);
  return status !== undefined && isRetryableHttpStatus(status);
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function statusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('$metadata' in error) {
    const status = (error as { $metadata?: { httpStatusCode?: unknown } })
      .$metadata?.httpStatusCode;
    if (typeof status === 'number') return status;
  }
  if ('status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  if ('cause' in error) return statusCode((error as { cause?: unknown }).cause);
  return undefined;
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
  return 'cause' in error
    ? transientNetworkCode((error as { cause?: unknown }).cause)
    : false;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
