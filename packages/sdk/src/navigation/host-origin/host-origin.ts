const FALLBACK_ORIGIN = 'http://localhost';

/** Origin used to build absolute hrefs when the host runs outside a browser window. */
export function resolveDefaultHostOrigin(): string {
  return typeof window === 'undefined'
    ? FALLBACK_ORIGIN
    : window.location.origin;
}
