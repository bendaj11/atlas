export { ATLAS_BROWSER_LOADER } from './bootstrap/bootstrap-assets.js';

export { createAtlasBootstrapFiles } from './bootstrap/bootstrap-files.js';
export {
  assertAtlasBootstrapManifest,
  normalizeAtlasRegistryUrl,
} from './bootstrap/bootstrap-manifest.js';
export type { AtlasBootstrapManifest } from './bootstrap/bootstrap-manifest.js';
export {
  atlasHostDiscoveryUrl,
  resolveHostDiscovery,
} from './host-discovery/host-discovery.js';
export {
  atlasDiscoveryRequest,
  resolveAtlasHostRuntime,
} from './runtime-resolution/runtime-resolution.js';
export type { AtlasDiscoveryRequest } from './runtime-resolution/runtime-resolution.js';

export {
  createBootstrapHtml,
  validateBootstrapHtml,
} from './bootstrap/bootstrap-html.js';

export type {
  AtlasBootstrapFile,
  AtlasBootstrapOptions,
} from './bootstrap/bootstrap-types.js';

export { createNginxConfig } from './bootstrap/nginx-config.js';
