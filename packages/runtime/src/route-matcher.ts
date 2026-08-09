import type { AtlasRouteContribution } from '@atlas/schema';

/** Matches an Atlas app route against a host URL. */
export function routeMatches(
  route: AtlasRouteContribution,
  pathname: string,
): boolean {
  const patternSegments = segments(normalizePath(route.path));
  const pathnameSegments = segments(normalizePath(pathname));
  let index = 0;
  for (; index < patternSegments.length; index += 1) {
    const pattern = patternSegments[index]!;
    if (pattern === '*') return true;
    const value = pathnameSegments[index];
    if (!value || (pattern[0] !== ':' && pattern !== value)) return false;
  }
  return route.match !== 'full' || index === pathnameSegments.length;
}

function normalizePath(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/, '');
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}
