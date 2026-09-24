import { placementTargetsHost, type AtlasManifest } from '@atlas/schema';
import type { HostPlacement } from '../host-runtime/host-runtime.types.js';
import { createRoutePlacementPlan } from '../host-runtime/route-plan.js';
import { doesRouteMatchPathname } from '../shared/route-path.js';
import type {
  AtlasHostNavigationItem,
  HostNavigationItemsInput,
  NavigationItemsListener,
  UnsubscribeNavigationItems,
} from './host-navigation.types.js';

export const ATLAS_NAVIGATION_ITEMS_EVENT = 'atlas:navigation-items';

const navigationItemsByDocument = new WeakMap<
  Document,
  readonly AtlasHostNavigationItem[]
>();

export function createHostNavigationItems(
  input: HostNavigationItemsInput,
): readonly AtlasHostNavigationItem[] {
  const { manifests, hostId, navigation } = input;
  const pathname = navigation.getCurrentLocation().pathname;

  return collectVisibleRoutePlacementsForHost(manifests, hostId).map(
    ({ manifest, placement }) => {
      const route = placement.route!;

      return {
        id: placement.id,
        appId: manifest.id,
        appName: manifest.name,
        path: route.path,
        href: navigation.createHref(route.path),
        label: route.nav?.label ?? route.title ?? manifest.name,
        ...(route.title !== undefined ? { title: route.title } : {}),
        order: route.nav?.order ?? 0,
        active: doesRouteMatchPathname(route, pathname),
        navigate: () => navigation.navigate(route.path),
      };
    },
  );
}

export function readAtlasNavigationItems(
  document: Document | undefined = globalThis.document,
): readonly AtlasHostNavigationItem[] {
  if (!document) return [];

  return navigationItemsByDocument.get(document) ?? [];
}

export function publishAtlasNavigationItems(
  document: Document,
  items: readonly AtlasHostNavigationItem[],
): void {
  navigationItemsByDocument.set(document, items);

  document.dispatchEvent(
    new CustomEvent(ATLAS_NAVIGATION_ITEMS_EVENT, { detail: { items } }),
  );
}

export function subscribeAtlasNavigationItems(
  listener: NavigationItemsListener,
  document: Document | undefined = globalThis.document,
): UnsubscribeNavigationItems {
  if (!document) return () => undefined;

  const handleNavigationItems = (event: Event) => {
    if (isNavigationItemsEvent(event)) listener(event.detail.items);
  };

  document.addEventListener(
    ATLAS_NAVIGATION_ITEMS_EVENT,
    handleNavigationItems,
  );

  return () =>
    document.removeEventListener(
      ATLAS_NAVIGATION_ITEMS_EVENT,
      handleNavigationItems,
    );
}

function isNavigationItemsEvent(
  event: Event,
): event is CustomEvent<{ items: readonly AtlasHostNavigationItem[] }> {
  return event instanceof CustomEvent && Array.isArray(event.detail?.items);
}

function collectVisibleRoutePlacementsForHost(
  manifests: readonly AtlasManifest[],
  hostId: string,
): HostPlacement[] {
  return createRoutePlacementPlan(
    manifests
      .flatMap((manifest) =>
        manifest.placements.map((placement) => ({ manifest, placement })),
      )
      .filter(
        ({ placement }) =>
          placementTargetsHost(placement, hostId) &&
          placement.kind === 'route' &&
          placement.route &&
          placement.route.redirectTo === undefined &&
          placement.route.nav?.visible !== false,
      ),
  ).available.sort(
    (left, right) =>
      (left.placement.route?.nav?.order ?? 0) -
      (right.placement.route?.nav?.order ?? 0),
  );
}
