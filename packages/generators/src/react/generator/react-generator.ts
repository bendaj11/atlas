import {
  renderReactAppBootstrap,
  renderReactAppComponent,
  renderReactAppDetails,
  renderReactAppHome,
  renderReactAppRoutes,
} from '../app/react-app-generator.js';
import {
  renderReactHostBootstrap,
  renderReactHostMain,
  renderReactHostSdkConfig,
} from '../host/react-host-generator.js';
import {
  buildReactPackageManifest,
  renderReactAppIndexHtml,
  renderReactHostIndexHtml,
} from '../package/react-package-generator.js';
import { buildReactTsconfig } from '../tsconfig/react-tsconfig-generator.js';
import { renderReactViteConfig } from '../vite/react-vite-generator.js';
import {
  renderAtlasAppConfig,
  renderAtlasBootstrapHtml,
  renderAtlasHostConfig,
} from '../../shared/atlas-config/atlas-config.js';
import { renderAtlasHostStyles } from '../../shared/host-styles/host-styles.js';
import {
  convertIdToTitle,
  formatJsonDocument,
} from '../../shared/text/text.js';
import type {
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
} from '../../shared/types/generator-types.js';
import { resolveReactVersionProfileFromOptions } from '../../shared/versions/generator-versions.js';
import { renderExportedWidgetsReadme } from '../../shared/widgets-readme/widgets-readme.js';

interface ReactHostFilesOptions {
  options: AtlasGeneratorOptions;
  hostId: string;
}

export function generateReactHostFiles({
  options,
  hostId,
}: ReactHostFilesOptions): AtlasGeneratedFile[] {
  const { name, devServerPort } = options;
  const profile = resolveReactVersionProfileFromOptions(options);

  return [
    {
      path: 'package.json',
      contents: formatJsonDocument(
        buildReactPackageManifest({
          packageName: options.packageName ?? name,
          projectName: name,
          type: 'host',
          profile,
        }),
      ),
    },
    {
      path: 'tsconfig.json',
      contents: formatJsonDocument(buildReactTsconfig()),
    },
    {
      path: 'vite.config.ts',
      contents: renderReactViteConfig({ name, type: 'host', devServerPort }),
    },
    {
      path: 'atlas.config.ts',
      contents: renderAtlasHostConfig({ generatorOptions: options, hostId }),
    },
    { path: 'atlas.bootstrap.html', contents: renderAtlasBootstrapHtml(name) },
    {
      path: 'index.html',
      contents: renderReactHostIndexHtml('Atlas React Host'),
    },
    { path: 'src/styles.css', contents: renderAtlasHostStyles() },
    { path: 'src/main.tsx', contents: renderReactHostMain() },
    { path: 'src/bootstrap.tsx', contents: renderReactHostBootstrap(profile) },
    { path: 'src/host.config.tsx', contents: renderReactHostSdkConfig() },
  ];
}

export function generateReactAppFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  const { name, devServerPort } = options;
  const profile = resolveReactVersionProfileFromOptions(options);
  const routed = options.routing ?? true;

  return [
    {
      path: 'package.json',
      contents: formatJsonDocument(
        buildReactPackageManifest({
          packageName: options.packageName ?? name,
          projectName: name,
          type: 'app',
          profile,
          routed,
        }),
      ),
    },
    {
      path: 'tsconfig.json',
      contents: formatJsonDocument(buildReactTsconfig()),
    },
    {
      path: 'vite.config.ts',
      contents: renderReactViteConfig({
        name,
        type: 'app',
        reactMajor: profile.major,
        devServerPort,
      }),
    },
    { path: 'atlas.config.ts', contents: renderAtlasAppConfig(options) },
    {
      path: 'index.html',
      contents: renderReactAppIndexHtml(convertIdToTitle(name)),
    },
    { path: 'src/index.css', contents: '' },
    {
      path: 'src/App.tsx',
      contents: renderReactAppComponent({ name, routed }),
    },
    ...(routed
      ? [
          { path: 'src/home/Home.tsx', contents: renderReactAppHome(name) },
          {
            path: 'src/details/Details.tsx',
            contents: renderReactAppDetails(),
          },
          { path: 'src/routes.tsx', contents: renderReactAppRoutes() },
        ]
      : []),
    {
      path: 'src/bootstrap.tsx',
      contents: renderReactAppBootstrap({ name, routed, profile }),
    },
    {
      path: 'src/exported-widgets/README.md',
      contents: renderExportedWidgetsReadme(),
    },
  ];
}
