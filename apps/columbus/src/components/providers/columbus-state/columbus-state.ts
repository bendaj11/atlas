import type { AtlasHostData as HostData } from '../../../types/contracts';
import { readHostData } from '../../../scripts/host/host-data/host-data';
import {
  readDisabledArtifactVersionOverrides,
  readClearedLocalArtifactIds,
} from '../../../scripts/overrides/override-storage/override-storage';
import { readHostDataCache } from '../../../scripts/host/host-data-cache';
import { failureMessage } from '../../../scripts/shared/errors/errors';
import {
  extractEnabledArtifactVersionOverrides,
  includeOverrideAppsInCatalog,
} from '../../../scripts/overrides/override-artifact-versions';
import type { ColumbusState, HostStatus, Scope } from '../../../types/app';

export const COLUMBUS_STATE_QUERY_KEY = ['columbusState'] as const;

interface HostReadResult {
  hostData: HostData;
  tabId: number;
}

export async function loadColumbusState(
  hasColumbusState: boolean,
): Promise<ColumbusState> {
  const cached = hasColumbusState ? undefined : await readCachedColumbusState();

  return cached ?? readActiveColumbusState();
}

export function hostStatusOf({
  isError,
  isFetching,
}: {
  isError: boolean;
  isFetching: boolean;
}): HostStatus {
  if (isFetching) return 'LOADING';

  return isError ? 'ERROR' : 'LOADED';
}

async function readActiveColumbusState(): Promise<ColumbusState> {
  try {
    return await createColumbusState(await readHostData());
  } catch (error) {
    throw new Error(
      failureMessage(
        error,
        'read Atlas data from the active browser tab',
        'Open an Atlas host or App Preview tab, activate it, then retry.',
      ),
    );
  }
}

async function readCachedColumbusState(): Promise<ColumbusState | undefined> {
  try {
    const cached = await readHostDataCache();

    return cached ? createColumbusState(cached) : undefined;
  } catch {
    return undefined;
  }
}

async function createColumbusState(
  result: HostReadResult,
): Promise<ColumbusState> {
  const scope: Scope = result.hostData.overrideScope === 'tab' ? 'tab' : 'all';
  const enabledArtifactVersionOverrides =
    extractEnabledArtifactVersionOverrides(result.hostData);
  const storageLocation = {
    hostId: result.hostData.config.hostId,
    tabId: result.tabId,
    scope,
  };
  const [disabledArtifactVersionOverrides, clearedLocalArtifactIds] =
    await Promise.all([
      readDisabledArtifactVersionOverrides(storageLocation),
      readClearedLocalArtifactIds(storageLocation),
    ]);
  const hostData = includeOverrideAppsInCatalog({
    hostData: result.hostData,
    overrideArtifactVersions: [
      ...enabledArtifactVersionOverrides.values(),
      ...disabledArtifactVersionOverrides.values(),
    ],
  });

  return {
    hostData,
    tabId: result.tabId,
    enabledArtifactVersionOverrides,
    disabledArtifactVersionOverrides,
    clearedLocalArtifactIds,
    scope,
  };
}
