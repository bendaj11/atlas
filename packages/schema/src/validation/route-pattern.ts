const ROUTE_PARAMETER = /^:[A-Za-z][A-Za-z0-9_-]*$/u;

export function isRoutePattern(value: string): boolean {
  if (
    !value.startsWith('/') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('//')
  )
    return false;
  const segments = value.split('/').filter(Boolean);

  return segments.every((segment, index) =>
    segment === '*'
      ? index === segments.length - 1
      : segment.startsWith(':')
        ? ROUTE_PARAMETER.test(segment)
        : segment.length > 0,
  );
}

export function normalizeRoutePath(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/u, '');
}
