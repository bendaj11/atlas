import type { AtlasHostData as HostData } from '../../../types/contracts';
import { writeHostDataCache } from '../host-data-cache';
import { findAtlasHostTab } from '../host-tabs/host-tabs';
import { readPersistedOverrideDocument } from '../../overrides/override-storage/override-storage';

export interface ActiveHostData {
  hostData: HostData;
  tabId: number;
}

export async function readHostData(): Promise<ActiveHostData> {
  const { tab, hostData } = await findAtlasHostTab();

  if (!hostData.overrides)
    hostData.overrides = await readPersistedOverrideDocument(hostData);
  await writeHostDataCache({ hostData, tabId: tab.id, tabUrl: tab.url }).catch(
    () => undefined,
  );

  return { hostData, tabId: tab.id };
}
