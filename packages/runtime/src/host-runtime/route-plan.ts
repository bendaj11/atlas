import {
  placementTargetsHost,
  type AtlasManifest,
  type AtlasPlacement,
} from '@atlas/schema';
import type { AtlasNavigationTarget } from '../app-navigator/app-navigator.types.js';
import { logBrowserError } from '../shared/errors.js';
import {
  doesRouteMatchPathname,
  normalizeRoutePath,
} from '../shared/route-path.js';
import { AtlasDuplicateRouteError } from './host-runtime.errors.js';
import type {
  HostPlacement,
  PlacementMountRecord,
  RoutePlacementPlan,
} from './host-runtime.types.js';

export function collectPlacementsForHost(
  manifests: readonly AtlasManifest[],
  hostId: string,
): HostPlacement[] {
  return manifests.flatMap((manifest) =>
    manifest.placements
      .filter((placement) => placementTargetsHost(placement, hostId))
      .map((placement) => ({ manifest, placement })),
  );
}

export function filterRoutePlacements(
  placements: readonly HostPlacement[],
): HostPlacement[] {
  return placements.filter(
    ({ placement }) => placement.kind === 'route' && placement.route,
  );
}

export function filterSlotPlacements(
  placements: readonly HostPlacement[],
): HostPlacement[] {
  return placements.filter(
    ({ placement }) => placement.kind === 'slot' && placement.slot,
  );
}

/** Keeps the first placement per normalized route path; later ones are reported as conflicts. */
export function createRoutePlacementPlan(
  placements: readonly HostPlacement[],
): RoutePlacementPlan {
  const placementsByPath = new Map<string, HostPlacement[]>();

  for (const placement of placements) {
    const path = normalizeRoutePath(placement.placement.route!.path);

    placementsByPath.set(path, [
      ...(placementsByPath.get(path) ?? []),
      placement,
    ]);
  }

  const available: HostPlacement[] = [];
  const conflicts: HostPlacement[] = [];

  for (const group of placementsByPath.values()) {
    available.push(group[0]!);
    conflicts.push(...group.slice(1));
  }

  return { available, conflicts };
}

export function findRoutePlacementForPathname(
  placements: readonly HostPlacement[],
  pathname: string,
): HostPlacement | undefined {
  return placements
    .filter(({ placement }) =>
      doesRouteMatchPathname(placement.route!, pathname),
    )
    .sort(
      (left, right) =>
        right.placement.route!.path.length - left.placement.route!.path.length,
    )[0];
}

export function createNavigationTargetsFromPlacements(
  placements: readonly HostPlacement[],
): AtlasNavigationTarget[] {
  return placements.map(({ manifest, placement }) => ({
    id: manifest.id,
    path: placement.route!.path,
  }));
}

export function createPlacementKey(
  manifest: AtlasManifest,
  placement: AtlasPlacement,
): string {
  return `${manifest.id}:${placement.id}`;
}

export function createPlacementMountRecord(
  selected: HostPlacement,
  container: HTMLElement,
): PlacementMountRecord {
  return {
    key: createPlacementKey(selected.manifest, selected.placement),
    manifest: selected.manifest,
    placement: selected.placement,
    container,
    generation: 0,
  };
}

export function logRouteConflict(
  hostId: string,
  conflict: HostPlacement,
): void {
  logBrowserError(
    'Atlas ignored a conflicting route.',
    new AtlasDuplicateRouteError({
      hostId,
      path: normalizeRoutePath(conflict.placement.route!.path),
      appId: conflict.manifest.id,
    }),
  );
}
