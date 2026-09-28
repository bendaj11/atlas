import type { AtlasManifest } from '@atlas/schema';
import type { AtlasAppContext, AtlasAppLoading } from '@atlas/sdk/lifecycle';
import {
  createRouteContext,
  createScopedNavigation,
  type AtlasNavigation,
} from '@atlas/sdk/navigation';
import { anAppManifest } from '../../manifests/artifact-manifests/artifact-manifests.js';

export interface MockAppContextOptions {
  hostId: string;
  path: string;
  navigation: AtlasNavigation;
  manifest?: Partial<AtlasManifest>;
}

export interface MockAppContext {
  readonly context: AtlasAppContext;
  tabTitle(): string | undefined;
  isLoaderVisible(): boolean;
  isReady(): boolean;
  failure(): unknown;
}

export function createMockAppContext({
  hostId,
  path,
  navigation,
  manifest,
}: MockAppContextOptions): MockAppContext {
  let tabTitle: string | undefined;
  let isLoaderVisible = false;
  let pendingReadiness = 0;
  let failure: unknown;

  const loading: AtlasAppLoading = {
    show: () => {
      isLoaderVisible = true;
    },
    hide: () => {
      isLoaderVisible = false;
    },
    waitUntilReady: () => {
      pendingReadiness += 1;
      let isReleased = false;

      return () => {
        if (isReleased) return;

        isReleased = true;
        pendingReadiness -= 1;
      };
    },
  };

  const context: AtlasAppContext = {
    manifest: anAppManifest(manifest),
    hostId,
    path,
    navigation: createScopedNavigation(path, navigation),
    route: createRouteContext(path, navigation, {
      setTabTitle: (title) => {
        tabTitle = title;
      },
    }),
    loading,
    fail: (error) => {
      failure = error;
    },
  };

  return {
    context,
    tabTitle: () => tabTitle,
    isLoaderVisible: () => isLoaderVisible,
    isReady: () => pendingReadiness === 0,
    failure: () => failure,
  };
}
