import {
  angularAppComponent,
  angularAppConfig,
  angularAppDetailsComponent,
  angularAppEntry,
  angularAppHomeComponent,
  angularAppMain,
  angularAppRoutes,
} from '../app/angular-app-generator.js';
import {
  angularHostAppConfig,
  angularHostBootstrap,
  angularHostComponent,
  angularHostMain,
  angularHostRoutes,
  angularHostSdkConfig,
} from '../host/angular-host-generator.js';
import {
  angularIndex,
  angularPackage,
} from '../package/angular-package-generator.js';
import {
  angularAppTsconfig,
  angularFederationConfig,
  angularFederationConfigFile,
  angularRootTsconfig,
  angularWorkspace,
} from '../workspace/angular-workspace-generator.js';
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
import { angularVersionProfile } from '../../shared/versions/generator-versions.js';
import { exportedWidgetsReadme } from '../../shared/widgets-readme/widgets-readme.js';

interface AngularHostFilesOptions {
  options: AtlasGeneratorOptions;
  hostId: string;
}

export function generateAngularHostFiles({
  options,
  hostId,
}: AngularHostFilesOptions): AtlasGeneratedFile[] {
  const { name, devServerPort, stylesheetFormat } = options;
  const profile = angularVersionProfile(options);
  const stylesheetPath = `src/styles.${stylesheetFormat ?? 'css'}`;

  return [
    {
      path: 'package.json',
      contents: json(
        angularPackage({
          packageName: options.packageName ?? name,
          projectName: name,
          type: 'host',
          profile,
        }),
      ),
    },
    {
      path: 'angular.json',
      contents: json(
        angularWorkspace({
          name,
          type: 'host',
          devServerPort,
          stylesheetFormat,
          profile,
        }),
      ),
    },
    { path: 'tsconfig.json', contents: json(angularRootTsconfig()) },
    { path: 'tsconfig.app.json', contents: json(angularAppTsconfig()) },
    {
      path: angularFederationConfigFile(profile),
      contents: angularFederationConfig({ name, type: 'host', profile }),
    },
    { path: 'atlas.config.ts', contents: atlasHostConfig(options, hostId) },
    { path: 'atlas.bootstrap.html', contents: atlasBootstrapHtml(name) },
    { path: 'public/.gitkeep', contents: '' },
    {
      path: 'src/index.html',
      contents: angularIndex({
        pageTitle: 'Atlas Host',
        body: '<atlas-host-root></atlas-host-root>',
      }),
    },
    { path: stylesheetPath, contents: atlasHostStyles() },
    { path: 'src/assets/.gitkeep', contents: '' },
    { path: 'src/app/app.component.ts', contents: angularHostComponent() },
    {
      path: 'src/app/app.config.ts',
      contents: angularHostAppConfig({
        requiresZonelessProvider: profile.requiresZonelessProvider,
      }),
    },
    { path: 'src/app/app.routes.ts', contents: angularHostRoutes() },
    { path: 'src/app/host.config.ts', contents: angularHostSdkConfig() },
    { path: 'src/main.ts', contents: angularHostMain() },
    { path: 'src/bootstrap.ts', contents: angularHostBootstrap() },
  ];
}

export function generateAngularAppFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  const { name, devServerPort, stylesheetFormat } = options;
  const profile = angularVersionProfile(options);
  const routed = options.routing ?? true;
  const stylesheetPath = `src/styles.${stylesheetFormat ?? 'css'}`;

  return [
    {
      path: 'package.json',
      contents: json(
        angularPackage({
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
      contents: json(
        angularWorkspace({
          name,
          type: 'app',
          devServerPort,
          stylesheetFormat,
          profile,
        }),
      ),
    },
    { path: 'tsconfig.json', contents: json(angularRootTsconfig()) },
    { path: 'tsconfig.app.json', contents: json(angularAppTsconfig()) },
    {
      path: angularFederationConfigFile(profile),
      contents: angularFederationConfig({ name, type: 'app', profile }),
    },
    { path: 'atlas.config.ts', contents: atlasAppConfig(options) },
    { path: 'public/.gitkeep', contents: '' },
    {
      path: 'src/index.html',
      contents: angularIndex({ pageTitle: title(name), body: '' }),
    },
    { path: stylesheetPath, contents: '' },
    { path: 'src/main.ts', contents: angularAppMain() },
    {
      path: 'src/entry.ts',
      contents: angularAppEntry({ name, routed, zoneless: profile.zoneless }),
    },
    {
      path: 'src/app/app.component.ts',
      contents: angularAppComponent({ name, routed }),
    },
    ...(routed
      ? [
          {
            path: 'src/app/home/home.component.ts',
            contents: angularAppHomeComponent(name),
          },
          {
            path: 'src/app/details/details.component.ts',
            contents: angularAppDetailsComponent(),
          },
        ]
      : []),
    {
      path: 'src/app/app.config.ts',
      contents: angularAppConfig({
        routed,
        requiresZonelessProvider: profile.requiresZonelessProvider,
      }),
    },
    ...(routed
      ? [{ path: 'src/app/app.routes.ts', contents: angularAppRoutes() }]
      : []),
    {
      path: 'src/exported-widgets/README.md',
      contents: exportedWidgetsReadme(),
    },
  ];
}
