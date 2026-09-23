import type { HostData } from '../../types/host-data';
import { readHostData } from '../host-data/host-data';
import {
  readDisabledArtifactVersionOverrides,
  readClearedLocalArtifactIds,
} from '../override-storage/override-storage';
import { readHostDataCache } from '../host-data-cache/host-data-cache';
import { readPageStateFromHostTab } from '../host-tabs/host-tabs';
import { failureMessage } from '../errors/errors';
import {
  extractEnabledArtifactVersionOverrides,
  includeOverrideAppsInCatalog,
} from '../override-artifact-versions/override-artifact-versions';
import type { ColumbusState, Scope } from '../../types/columbus-state';

interface HostReadResult {
  hostData: HostData;
  tabId: number;
}

interface LoadColumbusStateOptions {
  bypassCache: boolean;
}

export async function loadColumbusState({
  bypassCache,
}: LoadColumbusStateOptions): Promise<ColumbusState> {
  const cached = bypassCache ? undefined : await readCachedColumbusState();

  return cached ?? readActiveColumbusState();
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
    if (!cached) return undefined;

    const pageState = await readPageStateFromHostTab(cached.tabId);

    return await createColumbusState({
      hostData: { ...cached.hostData, ...pageState },
      tabId: cached.tabId,
    });
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
