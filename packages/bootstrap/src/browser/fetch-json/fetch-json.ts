import { AtlasError } from '@atlas/schema';
import { decodeJson } from '../../shared/decode-json/decode-json.js';
import { ResourceUnavailableError } from '../../shared/errors/index.js';
import type { FetchOptions } from './fetch-json.types.js';

const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_BACKOFF_MS = 100;

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
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestBytes({
        url,
        timeout,
        cache: selectCacheMode({ attempt, verified: verify !== undefined }),
        ...(verify ? { verify } : {}),
      });
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_BACKOFF_MS * (attempt + 1)),
        );
      }
    }
  }

  if (lastError instanceof AtlasError) throw lastError;

  const attempts = retries + 1;
  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);

  throw new ResourceUnavailableError(
    `Atlas could not fetch "${url}" after ${attempts} attempt${attempts === 1 ? '' : 's'}: ${detail}`,
    { cause: lastError },
  );
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
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!verify) return bytes;

  try {
    await verify(bytes);
  } catch (error) {
    if (cache !== 'default') throw error;

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
