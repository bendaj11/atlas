import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import { AtlasError } from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/bootstrap-error.js';
import { decodeJson } from '../../shared/decode-json.js';
import { sha256, toBase64 } from '../../shared/sha256.js';

const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_BACKOFF_MS = 100;

export interface FetchOptions {
  url: string;
  runtime?: Pick<
    AtlasHostRuntimeConfig,
    'resourcesRetryCount' | 'resourcesTimeoutMs'
  >;
  integrity?: string;
}

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
      if (!response.ok)
        throw new Error(`${url} returned HTTP ${response.status}.`);

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

  throw resourceUnavailable({ url, attempts: retries + 1, cause: lastError });
}

function resourceUnavailable({
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

  return bootstrapError({
    code: 'RESOURCE_UNAVAILABLE',
    message: `Atlas could not fetch "${url}" after ${attempts} attempt${attempts === 1 ? '' : 's'}: ${detail}`,
    cause,
  });
}

async function validateIntegrity(
  bytes: Uint8Array,
  expected: string,
): Promise<void> {
  if (!expected.startsWith('sha256-'))
    throw bootstrapError({
      code: 'ARTIFACT_VERIFICATION_FAILED',
      message: `Host integrity "${expected}" must be a SHA-256 SRI value starting with "sha256-".`,
    });

  const actual = 'sha256-' + toBase64(await sha256(bytes));
  if (actual !== expected)
    throw bootstrapError({
      code: 'ARTIFACT_VERIFICATION_FAILED',
      message: `Selected host remote entry integrity ${actual} does not match manifest integrity ${expected}.`,
    });
}
