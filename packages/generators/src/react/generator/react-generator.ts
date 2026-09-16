import {
  reactAppBootstrap,
  reactAppComponent,
  reactAppDetails,
  reactAppHome,
  reactAppRoutes,
} from '../app/react-app-generator.js';
import {
  reactHostBootstrap,
  reactHostMain,
  reactHostSdkConfig,
} from '../host/react-host-generator.js';
import {
  reactAppIndex,
  reactIndex,
  reactPackage,
} from '../package/react-package-generator.js';
import { reactTsconfig } from '../tsconfig/react-tsconfig-generator.js';
import { reactViteConfig } from '../vite/react-vite-generator.js';
import {
  atlasAppConfig,
  atlasBootstrapHtml,
  atlasHostConfig,
} from '../../shared/atlas-config/atlas-config.js';
import { atlasHostStyles } from '../../shared/host-styles/host-styles.js';
import { json, title } from '../../shared/text/text.js';
import type {
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
} from '../../shared/types/generator-types.js';
import { reactVersionProfile } from '../../shared/versions/generator-versions.js';
import { exportedWidgetsReadme } from '../../shared/widgets-readme/widgets-readme.js';

interface ReactHostFilesOptions {
  options: AtlasGeneratorOptions;
  hostId: string;
}

export function generateReactHostFiles({
  options,
  hostId,
}: ReactHostFilesOptions): AtlasGeneratedFile[] {
  const { name, devServerPort } = options;
  const profile = reactVersionProfile(options);

  return [
    {
      path: 'package.json',
      contents: json(
        reactPackage({
          packageName: options.packageName ?? name,
          projectName: name,
          type: 'host',
          profile,
        }),
      ),
    },
    { path: 'tsconfig.json', contents: json(reactTsconfig()) },
    {
      path: 'vite.config.ts',
      contents: reactViteConfig({ name, type: 'host', devServerPort }),
    },
    { path: 'atlas.config.ts', contents: atlasHostConfig(options, hostId) },
    { path: 'atlas.bootstrap.html', contents: atlasBootstrapHtml(name) },
    { path: 'index.html', contents: reactIndex('Atlas React Host') },
    { path: 'src/styles.css', contents: atlasHostStyles() },
    { path: 'src/main.tsx', contents: reactHostMain() },
    { path: 'src/bootstrap.tsx', contents: reactHostBootstrap(profile) },
    { path: 'src/host.config.tsx', contents: reactHostSdkConfig() },
  ];
}

export function generateReactAppFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  const { name, devServerPort } = options;
  const profile = reactVersionProfile(options);
  const routed = options.routing ?? true;

  return [
    {
      path: 'package.json',
      contents: json(
        reactPackage({
          packageName: options.packageName ?? name,
          projectName: name,
          type: 'app',
          profile,
          routed,
        }),
      ),
    },
    { path: 'tsconfig.json', contents: json(reactTsconfig()) },
    {
      path: 'vite.config.ts',
      contents: reactViteConfig({
        name,
        type: 'app',
        reactMajor: profile.major,
        devServerPort,
      }),
    },
    { path: 'atlas.config.ts', contents: atlasAppConfig(options) },
    { path: 'index.html', contents: reactAppIndex(title(name)) },
    { path: 'src/index.css', contents: '' },
    { path: 'src/App.tsx', contents: reactAppComponent({ name, routed }) },
    ...(routed
      ? [
          { path: 'src/home/Home.tsx', contents: reactAppHome(name) },
          { path: 'src/details/Details.tsx', contents: reactAppDetails() },
          { path: 'src/routes.tsx', contents: reactAppRoutes() },
        ]
      : []),
    {
      path: 'src/bootstrap.tsx',
      contents: reactAppBootstrap({ name, routed, profile }),
    },
    {
      path: 'src/exported-widgets/README.md',
      contents: exportedWidgetsReadme(),
    },
  ];
}
