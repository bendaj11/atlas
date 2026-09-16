import { join } from 'node:path';
import type { Plugin } from 'vite';

type ViteResolver = ReturnType<typeof import('vite').createIdResolver>;

interface SharedModuleProxyOptions {
  readonly projectRoot: string;
  readonly specifiers: readonly string[];
}

export interface SharedModuleProxyDependencies {
  readonly loadVite: () => Promise<
    Pick<typeof import('vite'), 'createIdResolver'>
  >;
  readonly readCommonJsExports: (entryPoint: string) => readonly string[];
}

const SHARED_PROXY_PREFIX = 'atlas:shared-proxy:';

export function sharedProxyId(specifier: string): string {
  return `${SHARED_PROXY_PREFIX}${encodeURIComponent(specifier)}`;
}

export function createSharedModuleProxy(
  options: SharedModuleProxyOptions,
  dependencies: SharedModuleProxyDependencies,
): Plugin {
  const specifiers = new Set(options.specifiers);
  const importer = join(options.projectRoot, 'package.json');
  let resolveEntry: ViteResolver | undefined;

  return {
    name: 'atlas-react-shared-fallbacks',
    async configResolved(config) {
      const vite = await dependencies.loadVite();
      resolveEntry = vite.createIdResolver(config);
    },
    resolveId(source) {
      if (source.startsWith(SHARED_PROXY_PREFIX)) return `\0${source}`;
      return undefined;
    },
    async load(id) {
      if (!id.startsWith(`\0${SHARED_PROXY_PREFIX}`)) return undefined;
      const specifier = decodeURIComponent(
        id.slice(SHARED_PROXY_PREFIX.length + 1),
      );
      if (!specifiers.has(specifier)) return undefined;

      const entryPoint = await resolveEntry?.(
        this.environment,
        specifier,
        importer,
      );
      if (!entryPoint) {
        return this.error(
          `Atlas could not resolve shared dependency entry "${specifier}".`,
        );
      }
      const resolved = await this.resolve(entryPoint, importer);
      if (!resolved || resolved.external) {
        return this.error(
          `Atlas could not bundle shared dependency entry "${specifier}".`,
        );
      }

      const moduleInfo = await this.load(resolved);
      const namedExports = moduleInfo.syntheticNamedExports
        ? dependencies.readCommonJsExports(entryPoint)
        : [];

      return proxySource({
        entryPoint: resolved.id,
        namedExports,
        hasDefaultExport: moduleInfo.hasDefaultExport === true,
      });
    },
  };
}

function proxySource(options: {
  readonly entryPoint: string;
  readonly namedExports: readonly string[];
  readonly hasDefaultExport: boolean;
}): string {
  const entry = JSON.stringify(options.entryPoint);
  const imports = options.namedExports.map(
    (name, index) =>
      `import { ${name} as sharedExport${index} } from ${entry};`,
  );
  const exports = options.namedExports.map(
    (name, index) => `sharedExport${index} as ${name}`,
  );

  return [
    ...imports,
    `export * from ${entry};`,
    exports.length > 0 ? `export { ${exports.join(', ')} };` : '',
    options.hasDefaultExport ? `export { default } from ${entry};` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
