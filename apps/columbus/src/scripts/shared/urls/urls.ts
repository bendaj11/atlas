export function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

export function isLoopbackUrl(url: string | undefined): boolean {
  return isWebPageUrl(url) && isLoopbackHostname(new URL(url).hostname);
}

export function isWebPageUrl(url: string | undefined): url is string {
  return (
    typeof url === 'string' &&
    (url.startsWith('http://') || url.startsWith('https://'))
  );
}

export function isExtensionPageUrl(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('chrome-extension://');
}
