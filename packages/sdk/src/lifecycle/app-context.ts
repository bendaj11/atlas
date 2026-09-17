import type { AtlasManifest } from '@atlas/schema';
import type {
  AtlasRouteContext,
  AtlasScopedNavigation,
} from '../navigation.js';

export interface AtlasAppLoading {
  show(): void;
  hide(): void;
  /** Defers host readiness until the returned callback runs. */
  waitUntilReady(): () => void;
}

/** Runtime context scoped to one mounted app and its assigned host route. */
export interface AtlasAppContext {
  manifest: AtlasManifest;
  hostId: string;
  path: string;
  navigation: AtlasScopedNavigation;
  route: AtlasRouteContext;
  readonly loading: AtlasAppLoading;
}
