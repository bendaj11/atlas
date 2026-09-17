import { listCommonJsNamedExports } from '../commonjs-exports/commonjs-exports.cjs';
import { convertToPosixPath } from '../project-paths/project-paths.cjs';
import {
  createSharedModuleProxy,
  buildSharedProxyId,
} from '../shared-module-proxy/index.cjs';
import { resolveReactSharedDependencies } from '../shared-dependencies/index.cjs';
import type {
  ReactFederationBuildPlan,
  ReactFederationConfigOptions,
} from './react-vite-config.types.cjs';

/** Resolves shared dependencies and turns them into rollup inputs, externals, and the fallback plugin. */
export function planReactFederationBuild(
  options: ReactFederationConfigOptions,
  exposedInputs: Readonly<Record<string, string>>,
): ReactFederationBuildPlan {
  const shared = resolveReactSharedDependencies(
    options,
    Object.values(exposedInputs),
  );
  const sharedSpecifiers = new Set(shared.map(({ specifier }) => specifier));

  const sharedFallbackPlugin = createSharedModuleProxy(
    { projectRoot: options.projectRoot, specifiers: [...sharedSpecifiers] },
    {
      loadVite: () => import('vite'),
      readCommonJsExports: listCommonJsNamedExports,
    },
  );

  const packageGlobs = new Set(
    shared.map(
      ({ packageDirectory }) => `${convertToPosixPath(packageDirectory)}/**`,
    ),
  );

  return {
    shared,
    sharedFallbackPlugin,
    commonJsOptions: { include: [/node_modules/, ...packageGlobs] },
    input: Object.fromEntries([
      ...Object.entries(exposedInputs),
      ...shared.map(({ entryName, specifier }) => [
        entryName,
        buildSharedProxyId(specifier),
      ]),
    ]),
    external: (source) => sharedSpecifiers.has(source),
  };
}
