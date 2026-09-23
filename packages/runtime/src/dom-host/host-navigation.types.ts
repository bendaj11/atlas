import type { AtlasManifest } from '@atlas/schema';
import type { AtlasNavigation } from '@atlas/sdk/navigation';

export type NavigateToItem = () => void;

export interface AtlasHostNavigationItem {
  id: string;
  appId: string;
  appName: string;
  path: string;
  href: string;
  label: string;
  title?: string;
  order: number;
  active: boolean;
  navigate: NavigateToItem;
}

export interface HostNavigationItemsInput {
  manifests: readonly AtlasManifest[];
  hostId: string;
  navigation: AtlasNavigation;
}

export type NavigationItemsListener = (
  items: readonly AtlasHostNavigationItem[],
) => void;

export type UnsubscribeNavigationItems = () => void;
