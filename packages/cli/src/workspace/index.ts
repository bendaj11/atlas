export { getDefaultDevServerPort } from '@atlas/generators';
export {
  compileAtlasConfig,
  compiledAtlasConfigCandidates,
} from './config-compiler/config-compiler.js';
export { ATLAS_NX_TAG } from './constants.js';
export { loadEnvFiles } from './env/env.js';
export { detectWorkspace } from './service/workspace.js';
export type {
  AtlasNxProjectType,
  AtlasPackageManager,
  AtlasProject,
  AtlasProjectType,
  AtlasScaffoldOptions,
  AtlasTask,
  AtlasWorkspace,
  AtlasWorkspaceKind,
} from './types.js';
