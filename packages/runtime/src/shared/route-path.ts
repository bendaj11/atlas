import type { AtlasRouteContribution } from '@atlas/schema';

export type RouteMatchRule = Pick<AtlasRouteContribution, 'path' | 'match'>;

export function normalizeRoutePath(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/, '');
}

export function doesRouteMatchPathname(
  route: RouteMatchRule,
  pathname: string,
): boolean {
  const patternSegments = splitPathIntoSegments(normalizeRoutePath(route.path));
  const pathnameSegments = splitPathIntoSegments(normalizeRoutePath(pathname));
  let index = 0;

  for (; index < patternSegments.length; index += 1) {
    const pattern = patternSegments[index]!;

    if (pattern === '*') return true;

    const value = pathnameSegments[index];

    if (!value || (pattern[0] !== ':' && pattern !== value)) return false;
  }

  return route.match !== 'full' || index === pathnameSegments.length;
}

export function findDefaultRoutePathOfManifest(manifest: {
  id: string;
  placements: readonly { kind: string; route?: { path: string } }[];
}): string {
  return (
    manifest.placements.find(
      (placement) => placement.kind === 'route' && placement.route,
    )?.route?.path ?? `/${manifest.id}`
  );
}

function splitPathIntoSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}
