const FALLBACK_BASE_URL = 'http://atlas.local';

export function getDocumentBaseUrl(): string {
  return globalThis.location?.href ?? FALLBACK_BASE_URL;
}

export function resolveUrlAgainstDocument(value: string): URL {
  return new URL(value, getDocumentBaseUrl());
}

export function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

export function isLoopbackUrl(value: string): boolean {
  try {
    return isLoopbackHostname(resolveUrlAgainstDocument(value).hostname);
  } catch {
    return false;
  }
}

export function isHttpProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:';
}
