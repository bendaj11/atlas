import { dismissedDevelopmentOffersKey } from '@atlas/schema';
import { OVERRIDES_STORAGE_KEY } from '../overrides.constants.js';
import type { OverridesDependencies } from '../overrides.types.js';

export type DevelopmentSessionSourceDependencies = Pick<
  OverridesDependencies,
  'sessionStorage' | 'localStorage'
>;

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
