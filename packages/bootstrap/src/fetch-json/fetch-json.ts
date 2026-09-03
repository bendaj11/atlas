import type { AtlasHostRuntimeConfig } from '@atlas/schema';

export async function fetchJson<T>(
  url: string,
  runtime: Pick<
    AtlasHostRuntimeConfig,
    'resourcesRetryCount' | 'resourcesTimeoutMs'
  > = {},
  integrity?: string,
): Promise<T> {
  return fetchJsonRequest({
    url,
    runtime,
    ...(integrity ? { integrity } : {}),
  });
}

export async function fetchBytes(
  url: string,
  runtime: Pick<
    AtlasHostRuntimeConfig,
    'resourcesRetryCount' | 'resourcesTimeoutMs'
  > = {},
): Promise<Uint8Array> {
  const retries = runtime.resourcesRetryCount ?? 3;
  const timeout = runtime.resourcesTimeoutMs ?? 15000;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: 'no-cache',
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok)
        throw new Error(`${url} returned HTTP ${response.status}.`);
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * (attempt + 1)),
        );
      }
    }
  }
  throw lastError;
}

async function fetchJsonRequest<T>({
  url,
  runtime,
  integrity,
}: {
  url: string;
  runtime: Pick<
    AtlasHostRuntimeConfig,
    'resourcesRetryCount' | 'resourcesTimeoutMs'
  >;
  integrity?: string;
}): Promise<T> {
  const retries = runtime.resourcesRetryCount ?? 3;
  const timeout = runtime.resourcesTimeoutMs ?? 15000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: 'no-cache',
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok)
        throw new Error(url + ' returned HTTP ' + response.status + '.');

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (integrity) await validateIntegrity(bytes, integrity);

      return JSON.parse(new TextDecoder().decode(bytes)) as T;
    } catch (error) {
      lastError = error;

      if (attempt < retries)
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * (attempt + 1)),
        );
    }
  }

  throw lastError;
}

async function validateIntegrity(
  bytes: Uint8Array,
  expected: string,
): Promise<void> {
  if (!expected.startsWith('sha256-'))
    throw new Error('Host integrity must use SHA-256 SRI.');

  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
  );
  let binary = '';

  for (const byte of digest) binary += String.fromCharCode(byte);

  if ('sha256-' + btoa(binary) !== expected)
    throw new Error('Selected host remote entry failed integrity validation.');
}
