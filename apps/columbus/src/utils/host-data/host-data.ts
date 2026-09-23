import type { HostData } from '../../../types/host-data';
import { writeHostDataCache } from '../host-data-cache/host-data-cache';
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
