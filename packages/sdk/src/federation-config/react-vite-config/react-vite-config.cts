import { relative, resolve } from 'node:path';
import type { UserConfig } from 'vite';
import {
  federationBuildNotificationsPlugin,
  federationMetadataPlugin,
  reactSourceReloadPlugin,
  type FederationExposeMetadata,
} from '../development-plugins/index.cjs';
import { createReactWidgetEntries } from '../widget-entries/widget-entries.cjs';
import {
  reactBootstrapEntryPath,
  writeReactDevelopmentFacade,
} from './development-facade.cjs';
import { planReactFederationBuild } from './react-federation-build.cjs';
import type {
  ReactFederationBuildPlan,
  ReactFederationConfigOptions,
} from './react-vite-config.types.cjs';

interface ReactViteConfigRequest {
  readonly options: ReactFederationConfigOptions;
  readonly federation: ReactFederationBuildPlan;
  readonly pluginName: string;
  readonly exposes: readonly FederationExposeMetadata[];
  readonly devExposes: readonly FederationExposeMetadata[];
  readonly entryFileNames: string | ((chunk: { name: string }) => string);
}

/** Vite config for a React Atlas host: exposes `./host` and shares framework packages. */
export function createReactHostViteConfig(
  options: ReactFederationConfigOptions,
): UserConfig {
  const hostEntry = reactBootstrapEntryPath(options.projectRoot, 'main.tsx');
  const federation = planReactFederationBuild(options, { host: hostEntry });

  const developmentHost = writeReactDevelopmentFacade({
    projectRoot: options.projectRoot,
    name: 'host',
    sourcePath: hostEntry,
    defaultExport: false,
  });

  return composeReactViteConfig({
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
  const appEntry = reactBootstrapEntryPath(options.projectRoot, 'entry.tsx');
  const widgetEntries = createReactWidgetEntries(options).map((entry) => ({
    name: entry.name,
    entryPoint: resolve(options.projectRoot, entry.entryPoint),
  }));

  const federation = planReactFederationBuild(
    options,
    Object.fromEntries([
      ['entry', appEntry],
      ...widgetEntries.map(({ name, entryPoint }) => [
        `widgets/${name}`,
        entryPoint,
      ]),
    ]),
  );

  const developmentFacades = [
    { key: './entry', name: 'entry', sourcePath: appEntry },
    ...widgetEntries.map(({ name, entryPoint }) => ({
      key: `./widgets/${name}`,
      name: `widget-${name}`,
      sourcePath: entryPoint,
    })),
  ].map(({ key, name, sourcePath }) => ({
    key,
    outFileName: relative(
      options.projectRoot,
      writeReactDevelopmentFacade({
        projectRoot: options.projectRoot,
        name,
        sourcePath,
        defaultExport: true,
      }),
    ),
  }));

  return composeReactViteConfig({
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
    devExposes: developmentFacades,
    entryFileNames: '[name].js',
  });
}

export function reactRemoteName(name: string): string {
  return `atlas_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function composeReactViteConfig(request: ReactViteConfigRequest): UserConfig {
  const { options, federation } = request;

  const metadataPlugin = federationMetadataPlugin({
    projectRoot: options.projectRoot,
    pluginName: request.pluginName,
    metadata: {
      name: reactRemoteName(options.projectName),
      exposes: request.exposes,
      shared: federation.shared.map(({ metadata }) => metadata),
    },
    devExposes: request.devExposes,
    devShared: federation.shared.map(({ devMetadata }) => devMetadata),
  });

  return {
    plugins: [
      federation.sharedFallbackPlugin,
      reactSourceReloadPlugin(options.projectRoot),
      federationBuildNotificationsPlugin(options.projectRoot),
      metadataPlugin,
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
