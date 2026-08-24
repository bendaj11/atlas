export interface AtlasHostDiscoveryBinding {
  baseUrl: string;
  environment: string;
  manifestUrl: string;
  externalRegistries?: AtlasExternalRegistrySelection[];
}

/** Public registry document used to locate one host's active environment. */
export interface AtlasHostDiscovery {
  schemaVersion: '1';
  hostId: string;
  bindings: AtlasHostDiscoveryBinding[];
}
import type { AtlasExternalRegistrySelection } from './atlas-host-runtime-config.js';
