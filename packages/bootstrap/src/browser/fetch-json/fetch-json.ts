import { AtlasError } from '@atlas/schema';
import { decodeJson } from '../../shared/decode-json/decode-json.js';
import { ResourceUnavailableError } from '../../shared/errors/index.js';
import type { FetchOptions } from './fetch-json.types.js';

const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_BACKOFF_MS = 100;
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 425, 429]);

export async function fetchJson<T>(options: FetchOptions): Promise<T> {
  const bytes = await fetchBytes(options);

  return decodeJson<T>(bytes);
}

export async function fetchBytes({
  url,
  runtime = {},
  verify,
}: FetchOptions): Promise<Uint8Array> {
  const retries = runtime.resourcesRetryCount ?? DEFAULT_RETRY_COUNT;
  const timeout = runtime.resourcesTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastFailure: RequestFailure | undefined;
  let attempts = 0;

  while (attempts <= retries) {
    try {
      return await requestBytes({
        url,
        timeout,
        cache: selectCacheMode({
          attempt: attempts,
          verified: verify !== undefined,
        }),
        ...(verify ? { verify } : {}),
      });
    } catch (error) {
      lastFailure =
        error instanceof RequestFailure
          ? error
          : new RequestFailure({ reason: error, retryable: true });
      attempts += 1;

      if (!lastFailure.retryable) break;

      if (attempts <= retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_BACKOFF_MS * attempts),
        );
      }
    }
  }

  const lastError = lastFailure?.reason;

  if (lastError instanceof AtlasError) throw lastError;

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);

  throw new ResourceUnavailableError(
    `Atlas could not fetch "${url}" after ${attempts} attempt${attempts === 1 ? '' : 's'}: ${detail}`,
    { cause: lastError },
  );
}

class RequestFailure extends Error {
  readonly reason: unknown;
  readonly retryable: boolean;

  constructor({ reason, retryable }: { reason: unknown; retryable: boolean }) {
    super(reason instanceof Error ? reason.message : String(reason));
    this.reason = reason;
    this.retryable = retryable;
  }
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status) || status >= 500;
}

async function requestBytes({
  url,
  timeout,
  cache,
  verify,
}: {
  url: string;
  timeout: number;
  cache: RequestCache;
  verify?: (bytes: Uint8Array) => Promise<void>;
}): Promise<Uint8Array> {
  const response = await fetch(url, {
    cache,
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new RequestFailure({
      reason: new Error(`${url} returned HTTP ${response.status}.`),
      retryable: isRetryableStatus(response.status),
    });
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!verify) return bytes;

  try {
    await verify(bytes);
  } catch (error) {
    if (cache !== 'default')
      throw new RequestFailure({ reason: error, retryable: false });

    return requestBytes({ url, timeout, cache: 'reload', verify });
  }

  return bytes;
}

function selectCacheMode({
  attempt,
  verified,
}: {
  attempt: number;
  verified: boolean;
}): RequestCache {
  if (!verified) return 'no-cache';

  return attempt === 0 ? 'default' : 'reload';
}
