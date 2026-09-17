import { commonJsNamedExports } from '../commonjs-exports/commonjs-exports.cjs';
import { toPosixPath } from '../project-paths/project-paths.cjs';
import {
  createSharedModuleProxy,
  sharedProxyId,
} from '../shared-module-proxy/index.cjs';
import { reactSharedDependencies } from '../shared-dependencies/index.cjs';
import type {
  ReactFederationBuildPlan,
  ReactFederationConfigOptions,
} from './react-vite-config.types.cjs';

/** Resolves shared dependencies and turns them into rollup inputs, externals, and the fallback plugin. */
export function planReactFederationBuild(
  options: ReactFederationConfigOptions,
  exposedInputs: Readonly<Record<string, string>>,
): ReactFederationBuildPlan {
  const shared = reactSharedDependencies(options, Object.values(exposedInputs));
  const sharedSpecifiers = new Set(shared.map(({ specifier }) => specifier));

  const sharedFallbackPlugin = createSharedModuleProxy(
    { projectRoot: options.projectRoot, specifiers: [...sharedSpecifiers] },
    {
      loadVite: () => import('vite'),
      readCommonJsExports: commonJsNamedExports,
    },
  );

  const packageGlobs = new Set(
    shared.map(({ packageDirectory }) => `${toPosixPath(packageDirectory)}/**`),
  );

  return {
    shared,
    sharedFallbackPlugin,
    commonJsOptions: { include: [/node_modules/, ...packageGlobs] },
    input: Object.fromEntries([
      ...Object.entries(exposedInputs),
      ...shared.map(({ entryName, specifier }) => [
        entryName,
        sharedProxyId(specifier),
      ]),
    ]),
    external: (source) => sharedSpecifiers.has(source),
  };
}
