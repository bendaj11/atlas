export {
  ATLAS_BROWSER_LOADER,
  createAtlasBootstrapFiles,
  createBootstrapHtml,
  validateBootstrapHtml,
} from './node/index.js';
export type {
  AtlasBootstrapFile,
  AtlasBootstrapOptions,
} from './node/index.js';
export {
  artifactUrl,
  assertAtlasRuntimeConfig,
  ATLAS_RUNTIME_CONFIG_PATH,
  environmentManifestUrl,
  environmentRegistryUrl,
  resolveAtlasRuntimeConfig,
} from './shared/runtime-config/index.js';
