export { ATLAS_BROWSER_LOADER } from './node/bootstrap-assets.js';

export { createAtlasBootstrapFiles } from './node/bootstrap-files.js';
export {
  artifactUrl,
  assertAtlasRuntimeConfig,
  ATLAS_RUNTIME_CONFIG_PATH,
  environmentManifestUrl,
  environmentRegistryUrl,
  resolveAtlasRuntimeConfig,
} from './shared/runtime-config/runtime-config.js';

export {
  createBootstrapHtml,
  validateBootstrapHtml,
} from './node/bootstrap-html.js';

export type {
  AtlasBootstrapFile,
  AtlasBootstrapOptions,
} from './node/bootstrap-types.js';
