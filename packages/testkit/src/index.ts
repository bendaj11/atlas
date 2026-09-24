import { createAtlasSdk, type AtlasSdk } from '@atlas/sdk/host';
import { createMemoryNavigation } from './navigation.js';

export function createTestHostSdk(hostId = 'host'): AtlasSdk {
  return createAtlasSdk({
    hostId,
    navigation: createMemoryNavigation(),
  });
}

export { createMemoryNavigation } from './navigation.js';
export {
  anAppManifest,
  aHostManifest,
  aVersionOf,
  anExportedWidgetManifest,
  aRoutePlacement,
  aSlotPlacement,
  aStylesheet,
} from './manifests.js';
export { aHostCatalog, aHostRuntimeConfig } from './host.js';
