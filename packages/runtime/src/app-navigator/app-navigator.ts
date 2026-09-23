import type { AtlasNavigationState } from '@atlas/sdk';
import type { AtlasNavigation } from '@atlas/sdk/navigation';
import { AtlasAppRouteNotFoundError } from './app-navigator.errors.js';
import type {
  AtlasNavigationTarget,
  NavigateToApp,
} from './app-navigator.types.js';

/** Resolves stable Atlas navigation target ids to current host URLs. */
export function createAppNavigator(
  navigation: AtlasNavigation,
  targets: readonly AtlasNavigationTarget[],
): NavigateToApp {
  const pathsByAppId = new Map(
    targets.map((target) => [target.id, target.path]),
  );

  return (appId, state) => {
    const path = pathsByAppId.get(appId);

    if (!path) throw new AtlasAppRouteNotFoundError(appId);

    navigation.navigate(appendNavigationStateToPath(path, state));
  };
}

function appendNavigationStateToPath(
  path: string,
  state: AtlasNavigationState | undefined,
): string {
  const url = new URL(path, 'http://atlas.local');

  for (const [key, value] of Object.entries(state ?? {})) {
    if (value !== undefined)
      url.searchParams.set(key, value === null ? '' : String(value));
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
