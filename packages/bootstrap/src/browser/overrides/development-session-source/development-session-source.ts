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

export function storeDevelopmentSession({
  session,
  dependencies,
}: {
  session: DevSession;
  dependencies: DevelopmentSessionSourceDependencies;
}): string {
  const stored = JSON.stringify(session);

  dependencies.sessionStorage.setItem(OVERRIDES_STORAGE_KEY, stored);

  return stored;
}

export function readStoredOverridesDocument(
  dependencies: DevelopmentSessionSourceDependencies,
): string | null {
  return (
    dependencies.sessionStorage.getItem(OVERRIDES_STORAGE_KEY) ||
    dependencies.localStorage.getItem(OVERRIDES_STORAGE_KEY)
  );
}
