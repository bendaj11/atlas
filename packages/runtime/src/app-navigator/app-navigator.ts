import type { AtlasNavigationState } from '@atlas/sdk';
import type { AtlasNavigation } from '@atlas/sdk/navigation';
import { runtimeError } from '../runtime-error.js';

export interface AtlasNavigationTarget {
  id: string;
  path: string;
}

/** Resolves stable Atlas navigation target ids to current host URLs. */
export function createAppNavigator(
  navigation: AtlasNavigation,
  targets: readonly AtlasNavigationTarget[],
): (appId: string, state?: AtlasNavigationState) => void {
  const pathsById = new Map(targets.map((target) => [target.id, target.path]));

  return (appId, state) => {
    const path = pathsById.get(appId);
    if (!path) {
      throw runtimeError(
        `Atlas cannot navigate to "${appId}" because it has no navigation target in this host.`,
        {
          suggestedActions:
            'Use an id selected by this host that declares an app route or headless app path.',
          code: 'ATLAS_APP_ROUTE_NOT_FOUND',
        },
      );
    }
    navigation.navigate(addNavigationState(path, state));
  };
}

function addNavigationState(
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
