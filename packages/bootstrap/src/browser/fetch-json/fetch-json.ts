import { AtlasError } from '@atlas/schema';
import { decodeJson } from '../../shared/decode-json/decode-json.js';
import { ResourceUnavailableError } from '../../shared/errors/index.js';
import type { FetchOptions } from './fetch-json.types.js';
import { validateIntegrity } from './validate-integrity/validate-integrity.js';

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
  integrity,
}: FetchOptions): Promise<Uint8Array> {
  const retries = runtime.resourcesRetryCount ?? DEFAULT_RETRY_COUNT;
  const timeout = runtime.resourcesTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: 'no-cache',
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        throw new Error(`${url} returned HTTP ${response.status}.`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());

      if (integrity) await validateIntegrity(bytes, integrity);

      return bytes;
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_BACKOFF_MS * (attempt + 1)),
        );
      }
    }
  }

  throw wrapFetchFailure({
    url,
    attempts: retries + 1,
    cause: lastError,
  });
}

function wrapFetchFailure({
  url,
  attempts,
  cause,
}: {
  url: string;
  attempts: number;
  cause: unknown;
}): AtlasError {
  if (cause instanceof AtlasError) return cause;

  const detail = cause instanceof Error ? cause.message : String(cause);

  return new ResourceUnavailableError(
    `Atlas could not fetch "${url}" after ${attempts} attempt${attempts === 1 ? '' : 's'}: ${detail}`,
    { cause },
  );
}
