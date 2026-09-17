import { join } from 'node:path';
import type { Plugin } from 'vite';
import type {
  ReadCommonJsExports,
  SharedModuleProxyDependencies,
  SharedModuleProxyOptions,
  SharedProxyLoadContext,
  ViteIdResolver,
} from './shared-module-proxy.types.cjs';
import { proxyModuleSource } from './proxy-module-source.cjs';

const SHARED_PROXY_PREFIX = 'atlas:shared-proxy:';
const RESOLVED_PREFIX = `\0${SHARED_PROXY_PREFIX}`;

export function sharedProxyId(specifier: string): string {
  return `${SHARED_PROXY_PREFIX}${encodeURIComponent(specifier)}`;
}

/** Vite plugin that turns `atlas:shared-proxy:<specifier>` inputs into re-export modules of the real package entry. */
export function createSharedModuleProxy(
  options: SharedModuleProxyOptions,
  dependencies: SharedModuleProxyDependencies,
): Plugin {
  const specifiers = new Set(options.specifiers);
  const importer = join(options.projectRoot, 'package.json');
  let resolveEntry: ViteIdResolver | undefined;

  return {
    name: 'atlas-react-shared-fallbacks',

    async configResolved(config) {
      const vite = await dependencies.loadVite();
      resolveEntry = vite.createIdResolver(config);
    },

    resolveId(source) {
      return source.startsWith(SHARED_PROXY_PREFIX) ? `\0${source}` : undefined;
    },

    async load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return undefined;

      const specifier = decodeURIComponent(id.slice(RESOLVED_PREFIX.length));

      if (!specifiers.has(specifier)) return undefined;

      return loadSharedProxy({
        context: this,
        specifier,
        importer,
        resolveEntry,
        readCommonJsExports: dependencies.readCommonJsExports,
      });
    },
  };
}

export interface LoadSharedProxyRequest {
  readonly context: SharedProxyLoadContext;
  readonly specifier: string;
  readonly importer: string;
  readonly resolveEntry: ViteIdResolver | undefined;
  readonly readCommonJsExports: ReadCommonJsExports;
}

/** Resolves one shared specifier through Vite and emits the proxy module source. */
export async function loadSharedProxy(
  request: LoadSharedProxyRequest,
): Promise<string> {
  const { context, specifier, importer } = request;

  const entryPoint = await request.resolveEntry?.(
    context.environment,
    specifier,
    importer,
  );

  if (!entryPoint) {
    return context.error(
      `Atlas could not resolve shared dependency entry "${specifier}".`,
    );
  }

  const resolved = await context.resolve(entryPoint, importer);

  if (!resolved || resolved.external) {
    return context.error(
      `Atlas could not bundle shared dependency entry "${specifier}".`,
    );
  }

  const moduleInfo = await context.load(resolved);
  const namedExports = moduleInfo.syntheticNamedExports
    ? request.readCommonJsExports(entryPoint)
    : [];

  return proxyModuleSource({
    entryPoint: resolved.id,
    namedExports,
    hasDefaultExport: moduleInfo.hasDefaultExport === true,
  });
}
