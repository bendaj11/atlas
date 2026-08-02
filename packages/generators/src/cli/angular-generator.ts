import {
  angularHostAppConfig,
  angularHostBootstrap,
  angularHostComponent,
  angularHostMain,
  angularHostRoutes,
  angularHostSdkConfig,
} from './angular-host-generator.js';
import {
  angularAppAppComponent,
  angularAppConfig,
  angularAppDetailsComponent,
  angularAppEntry,
  angularAppHomeComponent,
  angularAppMain,
  angularAppRoutes,
  angularSinglePageAppComponent,
  angularSinglePageAppConfig,
  angularSinglePageAppEntry,
  angularSinglePageAppMain,
} from './angular-app-generator.js';
import { angularIndex, angularPackage } from './angular-package-generator.js';
import {
  angularAppTsconfig,
  angularFederationConfig,
  angularFederationConfigFile,
  angularRootTsconfig,
  angularWorkspace,
} from './angular-workspace-generator.js';
import {
  atlasAppConfig,
  atlasBootstrapHtml,
  atlasHostConfig,
  atlasHostStyles,
  json,
  title,
} from './common-generator.js';
import { angularVersionProfile } from './generator-versions.js';
import type {
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
} from './generator-types.js';

export function generateAngularHostFiles(
  options: AtlasGeneratorOptions,
  hostId: string,
): AtlasGeneratedFile[] {
  const { name } = options;
  const profile = angularVersionProfile(options);
  const stylesheetPath = `src/styles.${options.stylesheetFormat ?? 'css'}`;
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
        angularWorkspace(
          name,
          true,
          options.devServerPort,
          options.stylesheetFormat,
          profile,
        ),
      ),
    },
    { path: 'tsconfig.json', contents: json(angularRootTsconfig()) },
    { path: 'tsconfig.app.json', contents: json(angularAppTsconfig()) },
    {
      path: angularFederationConfigFile(profile),
      contents: angularFederationConfig(name, true, profile),
    },
    { path: 'atlas.config.ts', contents: atlasHostConfig(options, hostId) },
    { path: 'atlas.bootstrap.html', contents: atlasBootstrapHtml(name) },
    { path: 'public/.gitkeep', contents: '' },
    {
      path: 'src/index.html',
      contents: angularIndex(
        'Atlas Host',
        '<atlas-host-root></atlas-host-root>',
      ),
    },
    { path: stylesheetPath, contents: atlasHostStyles() },
    { path: 'src/assets/.gitkeep', contents: '' },
    { path: 'src/app/app.component.ts', contents: angularHostComponent() },
    { path: 'src/app/app.config.ts', contents: angularHostAppConfig(profile) },
    { path: 'src/app/app.routes.ts', contents: angularHostRoutes() },
    { path: 'src/app/host.config.ts', contents: angularHostSdkConfig() },
    { path: 'src/main.ts', contents: angularHostMain() },
    { path: 'src/bootstrap.ts', contents: angularHostBootstrap() },
  ];
}

export function generateAngularAppFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  const { name } = options;
  const profile = angularVersionProfile(options);
  const routed = options.routing ?? true;
  const stylesheetPath = `src/styles.${options.stylesheetFormat ?? 'css'}`;
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
        angularWorkspace(
          name,
          false,
          options.devServerPort,
          options.stylesheetFormat,
          profile,
        ),
      ),
    },
    { path: 'tsconfig.json', contents: json(angularRootTsconfig()) },
    { path: 'tsconfig.app.json', contents: json(angularAppTsconfig()) },
    {
      path: angularFederationConfigFile(profile),
      contents: angularFederationConfig(name, false, profile),
    },
    { path: 'atlas.config.ts', contents: atlasAppConfig(options) },
    { path: 'public/.gitkeep', contents: '' },
    {
      path: 'src/index.html',
      contents: angularIndex(title(name), ''),
    },
    { path: stylesheetPath, contents: '' },
    {
      path: 'src/main.ts',
      contents: routed ? angularAppMain() : angularSinglePageAppMain(),
    },
    {
      path: 'src/entry.ts',
      contents: routed
        ? angularAppEntry(name, profile.zoneless)
        : angularSinglePageAppEntry(name, profile.zoneless),
    },
    ...(routed
      ? [
          {
            path: 'src/app/app.component.ts',
            contents: angularAppAppComponent(name),
          },
          {
            path: 'src/app/home/home.component.ts',
            contents: angularAppHomeComponent(name),
          },
          {
            path: 'src/app/details/details.component.ts',
            contents: angularAppDetailsComponent(),
          },
          {
            path: 'src/app/app.config.ts',
            contents: angularAppConfig(profile.requiresZonelessProvider),
          },
          { path: 'src/app/app.routes.ts', contents: angularAppRoutes() },
        ]
      : [
          {
            path: 'src/app/app.component.ts',
            contents: angularSinglePageAppComponent(name),
          },
          {
            path: 'src/app/app.config.ts',
            contents: angularSinglePageAppConfig(
              profile.requiresZonelessProvider,
            ),
          },
        ]),
    {
      path: 'src/exported-widgets/README.md',
      contents: `# Exported widgets\n\nRun \`atlas g widget <name>\` to choose an app, or pass its stable config ID with \`--app-id=<app-id>\`. Atlas generates widget source plus \`atlas.config.ts\` with stable UUIDv4 identity. Consumers call \`sdk.getWidget(widgetId)\`; do not maintain widget lists in app config.\n`,
    },
  ];
}
