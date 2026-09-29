import {
  placementTargetsHost,
  type AtlasHostCatalog,
  type AtlasManifest,
  type AtlasRouteContribution,
} from '@atlas/schema';
import type { LoaderDocument } from '../atlas-loader.types.js';

export function preloadActiveRouteApp({
  document,
  catalog,
  pageUrl,
}: {
  document: LoaderDocument;
  catalog: AtlasHostCatalog;
  pageUrl: string;
}): void {
  const pathname = new URL(pageUrl).pathname;
  const app = findActiveRouteApp({ catalog, pathname });

  if (!app) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.setAttribute('as', 'fetch');
  link.href = app.remoteEntryUrl;
  link.crossOrigin = 'anonymous';

  document.head.append(link);
}

function findActiveRouteApp({
  catalog,
  pathname,
}: {
  catalog: AtlasHostCatalog;
  pathname: string;
}): AtlasManifest | undefined {
  const candidates = catalog.apps.flatMap((app) =>
    app.placements
      .filter(
        (placement) =>
          placement.kind === 'route' &&
          placement.route &&
          !placement.route.redirectTo &&
          placementTargetsHost(placement, catalog.hostId) &&
          matchesPathname({ route: placement.route, pathname }),
      )
      .map((placement) => ({ app, path: placement.route!.path })),
  );

  return candidates.sort(
    (left, right) => right.path.length - left.path.length,
  )[0]?.app;
}

function matchesPathname({
  route,
  pathname,
}: {
  route: AtlasRouteContribution;
  pathname: string;
}): boolean {
  const patternSegments = toSegments(route.path);
  const pathnameSegments = toSegments(pathname);
  let index = 0;

  for (; index < patternSegments.length; index += 1) {
    const pattern = patternSegments[index]!;

    if (pattern === '*') return true;

    const value = pathnameSegments[index];

    if (!value || (pattern[0] !== ':' && pattern !== value)) return false;
  }

  return route.match !== 'full' || index === pathnameSegments.length;
}

function toSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}
