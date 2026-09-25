import { dismissedDevelopmentOffersKey } from '@atlas/schema';
import { OVERRIDES_STORAGE_KEY } from '../overrides.constants.js';
import type { FetchOptions } from '../../fetch-json/index.js';
import type {
  DevSession,
  OverridesContext,
  OverridesDependencies,
} from '../overrides.types.js';

export type FetchDevelopmentSession = (
  options: FetchOptions,
) => Promise<DevSession>;

export type DevelopmentSessionSourceDependencies = Pick<
  OverridesDependencies,
  'sessionStorage' | 'localStorage' | 'requestDevelopmentSession'
> & { fetchJson: FetchDevelopmentSession };

export interface DevelopmentSessionSourceContext extends Pick<
  OverridesContext,
  'runtime'
> {
  dependencies: DevelopmentSessionSourceDependencies;
}

export async function discoverDevelopmentSession({
  runtime,
  dependencies,
}: DevelopmentSessionSourceContext): Promise<DevSession | undefined> {
  if (runtime.developmentSessionUrl) {
    return dependencies.fetchJson({
      url: runtime.developmentSessionUrl,
      runtime,
    });
  }

  const session = await dependencies.requestDevelopmentSession({
    hostId: runtime.hostId,
  });

  return session as DevSession | undefined;
}

export function readStoredOverridesDocument(
  dependencies: DevelopmentSessionSourceDependencies,
): string | null {
  return readFromStorages({ dependencies, key: OVERRIDES_STORAGE_KEY });
}

export function readDismissedDevelopmentOffers({
  hostId,
  dependencies,
}: {
  hostId: string;
  dependencies: DevelopmentSessionSourceDependencies;
}): string | null {
  return readFromStorages({
    dependencies,
    key: dismissedDevelopmentOffersKey(hostId),
  });
}

function readFromStorages({
  dependencies,
  key,
}: {
  dependencies: DevelopmentSessionSourceDependencies;
  key: string;
}): string | null {
  return (
    dependencies.sessionStorage.getItem(key) ??
    dependencies.localStorage.getItem(key)
  );
}
