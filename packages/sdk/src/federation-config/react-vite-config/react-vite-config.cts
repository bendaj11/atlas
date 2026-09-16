import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import {
  federationBuildNotificationsPlugin,
  federationMetadataPlugin,
  reactSourceReloadPlugin,
  type FederationExposeMetadata,
} from '../development-plugins/development-plugins.cjs';
import { toPosixPath } from '../project-paths/project-paths.cjs';
import { commonJsNamedExports } from '../commonjs-exports/commonjs-exports.cjs';
import {
  createSharedModuleProxy,
  sharedProxyId,
} from '../shared-module-proxy/shared-module-proxy.cjs';
import {
  reactSharedDependencies,
  type SharedDependency,
  type SkipEntry,
} from '../shared-dependencies/shared-dependencies.cjs';
import { createReactWidgetEntries } from '../widget-entries/widget-entries.cjs';

export interface ReactFederationConfigOptions {
  readonly projectRoot: string;
  /** Project name; becomes the Native Federation remote name `atlas_<name>`. */
  readonly projectName: string;
  /** React major of the app; 17 selects the legacy `react-dom` root API in generated widget entries. */
  readonly reactMajor?: number;
  /** Packages that Vite bundles into the remote instead of sharing with the host. */
  readonly skip?: readonly SkipEntry[];
}

interface ReactFederationBuild {
  readonly shared: readonly SharedDependency[];
  readonly sharedFallbackPlugin: Plugin;
  readonly commonJsOptions: {
    readonly include: ReadonlyArray<string | RegExp>;
  };
  readonly input: Readonly<Record<string, string>>;
  readonly external: (source: string) => boolean;
}

interface DevelopmentFacadeOptions {
  readonly projectRoot: string;
  readonly name: string;
  readonly sourcePath: string;
  readonly defaultExport: boolean;
}

const DEVELOPMENT_FACADE_DIRECTORY = join('.atlas', 'react-development');

/** Vite config for a React Atlas host: exposes `./host` and shares framework packages. */
export function createReactHostViteConfig(
  options: ReactFederationConfigOptions,
): UserConfig {
  const hostEntry = reactBootstrapPath(options.projectRoot, 'main.tsx');
  const federation = reactFederationBuild(options, { host: hostEntry });
  const developmentHost = writeReactDevelopmentFacade({
    projectRoot: options.projectRoot,
    name: 'host',
    sourcePath: hostEntry,
    defaultExport: false,
  });

  return reactViteConfig({
    options,
    federation,
    pluginName: 'atlas-host-metadata',
    exposes: [{ key: './host', outFileName: 'host.js' }],
    devExposes: [
      {
        key: './host',
        outFileName: relative(options.projectRoot, developmentHost),
      },
    ],
    entryFileNames: ({ name }) => (name === 'host' ? 'host.js' : '[name].js'),
  });
}

/** Vite config for a React Atlas app: exposes `./entry` plus every `src/exported-widgets/*` widget. */
export function createReactAppViteConfig(
  options: ReactFederationConfigOptions,
): UserConfig {
  const widgetEntries = createReactWidgetEntries(options);
  const appEntry = reactBootstrapPath(options.projectRoot, 'entry.tsx');
  const federation = reactFederationBuild(
    options,
    Object.fromEntries([
      ['entry', appEntry],
      ...widgetEntries.map(({ name, entryPoint }) => [
        `widgets/${name}`,
        resolve(options.projectRoot, entryPoint),
      ]),
    ]),
  );
  const developmentExposes = [
    {
      key: './entry',
      path: writeReactDevelopmentFacade({
        projectRoot: options.projectRoot,
        name: 'entry',
        sourcePath: appEntry,
        defaultExport: true,
      }),
    },
    ...widgetEntries.map(({ name, entryPoint }) => ({
      key: `./widgets/${name}`,
      path: writeReactDevelopmentFacade({
        projectRoot: options.projectRoot,
        name: `widget-${name}`,
        sourcePath: resolve(options.projectRoot, entryPoint),
        defaultExport: true,
      }),
    })),
  ];

  return reactViteConfig({
    options,
    federation,
    pluginName: 'atlas-native-federation-metadata',
    exposes: [
      { key: './entry', outFileName: 'entry.js' },
      ...widgetEntries.map(({ name }) => ({
        key: `./widgets/${name}`,
        outFileName: `widgets/${name}.js`,
      })),
    ],
    devExposes: developmentExposes.map(({ key, path }) => ({
      key,
      outFileName: relative(options.projectRoot, path),
    })),
    entryFileNames: '[name].js',
  });
}

export function reactRemoteName(name: string): string {
  return `atlas_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function reactViteConfig(request: {
  readonly options: ReactFederationConfigOptions;
  readonly federation: ReactFederationBuild;
  readonly pluginName: string;
  readonly exposes: readonly FederationExposeMetadata[];
  readonly devExposes: readonly FederationExposeMetadata[];
  readonly entryFileNames: string | ((chunk: { name: string }) => string);
}): UserConfig {
  const { options, federation } = request;

  return {
    plugins: [
      federation.sharedFallbackPlugin,
      reactSourceReloadPlugin(options.projectRoot),
      federationBuildNotificationsPlugin(options.projectRoot),
      federationMetadataPlugin({
        projectRoot: options.projectRoot,
        pluginName: request.pluginName,
        metadata: {
          name: reactRemoteName(options.projectName),
          exposes: request.exposes,
          shared: federation.shared.map(({ metadata }) => metadata),
        },
        devExposes: request.devExposes,
        devShared: federation.shared.map(({ devMetadata }) => devMetadata),
      }),
    ],
    build: {
      target: 'esnext',
      commonjsOptions: { include: [...federation.commonJsOptions.include] },
      rollupOptions: {
        input: { ...federation.input },
        external: federation.external,
        output: {
          entryFileNames: request.entryFileNames,
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
        preserveEntrySignatures: 'exports-only',
      },
    },
  };
}

function reactFederationBuild(
  options: ReactFederationConfigOptions,
  exposedInputs: Readonly<Record<string, string>>,
): ReactFederationBuild {
  const shared = reactSharedDependencies(options, Object.values(exposedInputs));
  const sharedSpecifiers = new Set(shared.map(({ specifier }) => specifier));

  return {
    shared,
    sharedFallbackPlugin: createSharedModuleProxy(
      { projectRoot: options.projectRoot, specifiers: [...sharedSpecifiers] },
      {
        loadVite: () => import('vite'),
        readCommonJsExports: commonJsNamedExports,
      },
    ),
    commonJsOptions: {
      include: [
        /node_modules/,
        ...new Set(
          shared.map(
            ({ packageDirectory }) => `${toPosixPath(packageDirectory)}/**`,
          ),
        ),
      ],
    },
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

function reactBootstrapPath(projectRoot: string, legacyEntry: string): string {
  const bootstrap = resolve(projectRoot, 'src/bootstrap.tsx');

  return existsSync(bootstrap)
    ? bootstrap
    : resolve(projectRoot, 'src', legacyEntry);
}

function writeReactDevelopmentFacade(
  options: DevelopmentFacadeOptions,
): string {
  const directory = join(options.projectRoot, DEVELOPMENT_FACADE_DIRECTORY);
  const facadePath = join(directory, `${options.name}.ts`);
  const source = toPosixPath(relative(directory, options.sourcePath));
  const sourceSpecifier = JSON.stringify(
    source.startsWith('.') ? source : `./${source}`,
  );
  const exports = options.defaultExport
    ? `export { default } from ${sourceSpecifier};`
    : `export * from ${sourceSpecifier};`;
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    facadePath,
    `import "@vitejs/plugin-react/preamble";\n${exports}\n`,
  );

  return facadePath;
}
