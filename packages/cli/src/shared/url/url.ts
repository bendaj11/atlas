const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLoopbackUrl(url: URL): boolean {
  return LOOPBACK_HOSTNAMES.has(url.hostname);
}

export function isSecureOrLoopbackUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && isLoopbackUrl(url))
  );
}

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, '');
}
