import {
  atlasAppConfig,
  atlasBootstrapHtml,
  atlasHostConfig,
  atlasHostStyles,
  json,
  title,
} from './common-generator.js';
import type {
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
} from './generator-types.js';
import { reactVersionProfile } from './generator-versions.js';
import {
  reactHostMain,
} from './react-host-generator.js';
import {
  appSourceReadme,
  reactAppApp,
  reactAppDetails,
  reactAppEntry,
  reactAppHome,
  reactAppRoutes,
  reactSinglePageApp,
  reactSinglePageAppEntry,
} from './react-app-generator.js';
import {
  reactAppIndex,
  reactIndex,
  reactPackage,
} from './react-package-generator.js';
import { reactTsconfig } from './react-tsconfig-generator.js';
import {
  reactHostViteConfig,
  reactAppViteConfig,
} from './react-vite-generator.js';

export function generateReactHostFiles(
  options: AtlasGeneratorOptions,
  hostId: string,
): AtlasGeneratedFile[] {
  const { name } = options;
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
      contents: reactHostViteConfig(name, options.devServerPort),
    },
    { path: 'atlas.config.ts', contents: atlasHostConfig(options, hostId) },
    { path: 'atlas.bootstrap.html', contents: atlasBootstrapHtml(name) },
    { path: 'index.html', contents: reactIndex('Atlas React Host') },
    { path: 'src/styles.css', contents: atlasHostStyles() },
    { path: 'src/main.tsx', contents: reactHostMain(profile) },
  ];
}

export function generateReactAppFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  const { name } = options;
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
      contents: reactAppViteConfig(
        name,
        profile.major,
        options.devServerPort,
      ),
    },
    { path: 'atlas.config.ts', contents: atlasAppConfig(options) },
    { path: 'index.html', contents: reactAppIndex(`${title(name)} assets`) },
    { path: 'src/styles.css', contents: '' },
    {
      path: 'src/app/README.md',
      contents: appSourceReadme('src/entry.tsx', 'vite.config.ts'),
    },
    ...(routed
      ? [
          { path: 'src/app/App.tsx', contents: reactAppApp(name) },
          { path: 'src/app/home/Home.tsx', contents: reactAppHome(name) },
          { path: 'src/app/details/Details.tsx', contents: reactAppDetails() },
          { path: 'src/app/routes.tsx', contents: reactAppRoutes() },
          { path: 'src/entry.tsx', contents: reactAppEntry(profile) },
        ]
      : [
          { path: 'src/app/App.tsx', contents: reactSinglePageApp(name) },
          {
            path: 'src/entry.tsx',
            contents: reactSinglePageAppEntry(name, profile),
          },
        ]),
    {
      path: 'src/exported-widgets/README.md',
      contents: `# Exported widgets\n\nRun \`atlas g widget <name>\` to choose an app, or pass its stable config ID with \`--app-id=<app-id>\`. Atlas generates widget source plus \`atlas.config.ts\` with stable UUIDv4 identity. Consumers call \`sdk.getWidget(widgetId)\`; do not maintain widget lists in app config.\n`,
    },
  ];
}
