import type { AtlasManifest, AtlasPlacement } from "@atlas/schema";
import type { AtlasNavigation } from "@atlas/sdk/navigation";

export const ATLAS_NAVIGATION_ITEMS_EVENT = "atlas:navigation-items";

export interface AtlasHostNavigationItem {
  id: string;
  appId: string;
  appName: string;
  basePath: string;
  href: string;
  label: string;
  title?: string;
  order: number;
  active: boolean;
  navigate(): void;
}

interface RoutePlacement {
  manifest: AtlasManifest;
  placement: AtlasPlacement;
}

const documentNavigationItems = new WeakMap<Document, readonly AtlasHostNavigationItem[]>();

export function createHostNavigationItems(
  manifests: readonly AtlasManifest[],
  hostId: string,
  navigation: AtlasNavigation
): readonly AtlasHostNavigationItem[] {
  const pathname = navigation.getCurrentLocation().pathname;
  return routePlacementsForHost(manifests, hostId).map(({ manifest, placement }) => {
    const route = placement.route!;
    return {
      id: placement.id,
      appId: manifest.id,
      appName: manifest.name,
      basePath: route.basePath,
      href: navigation.createHref(route.basePath),
      label: route.nav?.label ?? route.title ?? manifest.name,
      ...(route.title !== undefined ? { title: route.title } : {}),
      order: route.nav?.order ?? 0,
      active: routeMatches(route.basePath, pathname),
      navigate: () => navigation.navigate(route.basePath)
    };
  });
}

export function readAtlasNavigationItems(document: Document | undefined = globalThis.document): readonly AtlasHostNavigationItem[] {
  if (!document) return [];
  return documentNavigationItems.get(document) ?? [];
}

export function publishAtlasNavigationItems(document: Document, items: readonly AtlasHostNavigationItem[]): void {
  documentNavigationItems.set(document, items);
  document.dispatchEvent(new CustomEvent(ATLAS_NAVIGATION_ITEMS_EVENT, { detail: { items } }));
}

export function subscribeAtlasNavigationItems(
  listener: (items: readonly AtlasHostNavigationItem[]) => void,
  document: Document | undefined = globalThis.document
): () => void {
  if (!document) return () => undefined;
  const handleNavigationItems = (event: Event): void => {
    listener((event as CustomEvent<{ items: readonly AtlasHostNavigationItem[] }>).detail.items);
  };
  document.addEventListener(ATLAS_NAVIGATION_ITEMS_EVENT, handleNavigationItems);
  return () => document.removeEventListener(ATLAS_NAVIGATION_ITEMS_EVENT, handleNavigationItems);
}

function routePlacementsForHost(manifests: readonly AtlasManifest[], hostId: string): RoutePlacement[] {
  return manifests
    .flatMap((manifest) => manifest.placements.map((placement) => ({ manifest, placement })))
    .filter(({ placement }) => placement.hostId === hostId && placement.kind === "route" && placement.route?.nav?.visible !== false)
    .sort((left, right) => (left.placement.route?.nav?.order ?? 0) - (right.placement.route?.nav?.order ?? 0));
}

function routeMatches(basePath: string, pathname: string): boolean {
  const normalized = basePath === "/" ? "/" : basePath.replace(/\/+$/, "");
  return normalized === "/" || pathname === normalized || pathname.startsWith(`${normalized}/`);
}
