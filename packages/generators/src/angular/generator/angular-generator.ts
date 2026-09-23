import {
  renderAngularAppComponent,
  renderAngularAppConfig,
  renderAngularAppDetailsComponent,
  renderAngularAppEntry,
  renderAngularAppHomeComponent,
  renderAngularAppMain,
  renderAngularAppRoutes,
} from '../app/angular-app-generator.js';
import {
  renderAngularHostAppConfig,
  renderAngularHostBootstrap,
  renderAngularHostComponent,
  renderAngularHostMain,
  renderAngularHostRoutes,
  renderAngularHostSdkConfig,
} from '../host/angular-host-generator.js';
import {
  buildAngularPackageManifest,
  renderAngularIndexHtml,
} from '../package/angular-package-generator.js';
import {
  buildAngularAppTsconfig,
  buildAngularRootTsconfig,
  buildAngularWorkspaceDocument,
  renderAngularFederationConfig,
  selectAngularFederationConfigFileName,
} from '../workspace/angular-workspace-generator.js';
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
import { resolveAngularVersionProfileFromOptions } from '../../shared/versions/generator-versions.js';
import { renderExportedWidgetsReadme } from '../../shared/widgets-readme/widgets-readme.js';

interface AngularHostFilesOptions {
  options: AtlasGeneratorOptions;
  hostId: string;
}

export function generateAngularHostFiles({
  options,
  hostId,
}: AngularHostFilesOptions): AtlasGeneratedFile[] {
  const { name, devServerPort, stylesheetFormat } = options;
  const profile = resolveAngularVersionProfileFromOptions(options);
  const stylesheetPath = `src/styles.${stylesheetFormat ?? 'css'}`;

  return [
    {
      path: 'package.json',
      contents: formatJsonDocument(
        buildAngularPackageManifest({
          packageName: options.packageName ?? name,
          projectName: name,
          type: 'host',
          profile,
        }),
      ),
    },
    {
      path: 'angular.json',
      contents: formatJsonDocument(
        buildAngularWorkspaceDocument({
          name,
          type: 'host',
          devServerPort,
          stylesheetFormat,
          profile,
        }),
      ),
    },
    {
      path: 'tsconfig.json',
      contents: formatJsonDocument(buildAngularRootTsconfig()),
    },
    {
      path: 'tsconfig.app.json',
      contents: formatJsonDocument(buildAngularAppTsconfig()),
    },
    {
      path: selectAngularFederationConfigFileName(profile),
      contents: renderAngularFederationConfig({ name, type: 'host', profile }),
    },
    {
      path: 'atlas.config.ts',
      contents: renderAtlasHostConfig({ generatorOptions: options, hostId }),
    },
    { path: 'atlas.bootstrap.html', contents: renderAtlasBootstrapHtml(name) },
    { path: 'public/.gitkeep', contents: '' },
    {
      path: 'src/index.html',
      contents: renderAngularIndexHtml({
        pageTitle: 'Atlas Host',
        body: '<atlas-host-root></atlas-host-root>',
      }),
    },
    { path: stylesheetPath, contents: renderAtlasHostStyles() },
    { path: 'src/assets/.gitkeep', contents: '' },
    {
      path: 'src/app/app.component.ts',
      contents: renderAngularHostComponent(),
    },
    {
      path: 'src/app/app.config.ts',
      contents: renderAngularHostAppConfig({
        requiresZonelessProvider: profile.requiresZonelessProvider,
      }),
    },
    { path: 'src/app/app.routes.ts', contents: renderAngularHostRoutes() },
    { path: 'src/app/host.config.ts', contents: renderAngularHostSdkConfig() },
    { path: 'src/main.ts', contents: renderAngularHostMain() },
    { path: 'src/bootstrap.ts', contents: renderAngularHostBootstrap() },
  ];
}

export function generateAngularAppFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  const { name, devServerPort, stylesheetFormat } = options;
  const profile = resolveAngularVersionProfileFromOptions(options);
  const routed = options.routing ?? true;
  const stylesheetPath = `src/styles.${stylesheetFormat ?? 'css'}`;

  return [
    {
      path: 'package.json',
      contents: formatJsonDocument(
        buildAngularPackageManifest({
          packageName: options.packageName ?? name,
          projectName: name,
          type: 'app',
          profile,
          routed,
        }),
      ),
    },
    {
      path: 'angular.json',
      contents: formatJsonDocument(
        buildAngularWorkspaceDocument({
          name,
          type: 'app',
          devServerPort,
          stylesheetFormat,
          profile,
        }),
      ),
    },
    {
      path: 'tsconfig.json',
      contents: formatJsonDocument(buildAngularRootTsconfig()),
    },
    {
      path: 'tsconfig.app.json',
      contents: formatJsonDocument(buildAngularAppTsconfig()),
    },
    {
      path: selectAngularFederationConfigFileName(profile),
      contents: renderAngularFederationConfig({ name, type: 'app', profile }),
    },
    { path: 'atlas.config.ts', contents: renderAtlasAppConfig(options) },
    { path: 'public/.gitkeep', contents: '' },
    {
      path: 'src/index.html',
      contents: renderAngularIndexHtml({
        pageTitle: convertIdToTitle(name),
        body: '',
      }),
    },
    { path: stylesheetPath, contents: '' },
    { path: 'src/main.ts', contents: renderAngularAppMain() },
    {
      path: 'src/entry.ts',
      contents: renderAngularAppEntry({
        name,
        routed,
        zoneless: profile.zoneless,
      }),
    },
    {
      path: 'src/app/app.component.ts',
      contents: renderAngularAppComponent({ name, routed }),
    },
    ...(routed
      ? [
          {
            path: 'src/app/home/home.component.ts',
            contents: renderAngularAppHomeComponent(name),
          },
          {
            path: 'src/app/details/details.component.ts',
            contents: renderAngularAppDetailsComponent(),
          },
        ]
      : []),
    {
      path: 'src/app/app.config.ts',
      contents: renderAngularAppConfig({
        routed,
        requiresZonelessProvider: profile.requiresZonelessProvider,
      }),
    },
    ...(routed
      ? [{ path: 'src/app/app.routes.ts', contents: renderAngularAppRoutes() }]
      : []),
    {
      path: 'src/exported-widgets/README.md',
      contents: renderExportedWidgetsReadme(),
    },
  ];
}
