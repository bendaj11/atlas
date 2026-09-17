/** Ensures one leading slash and no trailing slashes; `''` and `'/'` both become `'/'`. */
export function normalizePath(path: string): string {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;

  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

/** Strips the app path from a host pathname; anything outside the app resolves to `'/'`. */
export function toInnerPath(path: string, pathname: string): string {
  if (path === '/') return pathname || '/';

  if (pathname === path) return '/';

  return pathname.startsWith(`${path}/`) ? pathname.slice(path.length) : '/';
}
