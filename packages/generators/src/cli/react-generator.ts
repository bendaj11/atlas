import { atlasConfig, atlasHostConfig, atlasHostStyles, json, title } from "./common-generator.js";
import type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./generator-types.js";
import { reactVersionProfile } from "./generator-versions.js";
import { reactHostMain } from "./react-host-generator.js";
import {
  appSourceReadme,
  reactAppApp,
  reactAppDetails,
  reactAppEntry,
  reactAppHome,
  reactAppMain,
  reactAppRoutes,
  reactSinglePageApp,
  reactSinglePageAppEntry,
  reactSinglePageAppMain
} from "./react-app-generator.js";
import { reactRemoteName } from "./react-names.js";
import { reactIndex, reactPackage } from "./react-package-generator.js";
import { reactTsconfig } from "./react-tsconfig-generator.js";
import { reactHostViteConfig, reactAppViteConfig } from "./react-vite-generator.js";

export function generateReactHostFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  const { name } = options;
  const profile = reactVersionProfile(options);
  return [
    { path: "package.json", contents: json(reactPackage({ packageName: options.packageName ?? name, projectName: name, host: true, profile })) },
    { path: "tsconfig.json", contents: json(reactTsconfig()) },
    { path: "vite.config.ts", contents: reactHostViteConfig(profile.compilerTarget, options.devServerPort) },
    { path: "atlas.config.ts", contents: atlasHostConfig(options) },
    { path: "public/remoteEntry.json", contents: json({ name: reactRemoteName(name), exposes: [], shared: [] }) },
    { path: "index.html", contents: reactIndex("Atlas React Host") },
    { path: "src/styles.css", contents: atlasHostStyles() },
    { path: "src/main.tsx", contents: reactHostMain(profile) }
  ];
}

export function generateReactAppFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  const { name } = options;
  const profile = reactVersionProfile(options);
  const routed = options.routing ?? true;
  return [
    { path: "package.json", contents: json(reactPackage({ packageName: options.packageName ?? name, projectName: name, host: false, profile, routed })) },
    { path: "tsconfig.json", contents: json(reactTsconfig()) },
    { path: "vite.config.ts", contents: reactAppViteConfig(name, profile.compilerTarget, options.devServerPort) },
    { path: "atlas.config.ts", contents: atlasConfig(options, false) },
    { path: "index.html", contents: reactIndex(`${title(name)} assets`) },
    { path: "src/styles.css", contents: "" },
    { path: "src/app/README.md", contents: appSourceReadme("src/entry.tsx", "vite.config.ts") },
    ...(routed ? [
      { path: "src/app/App.tsx", contents: reactAppApp(name) },
      { path: "src/app/home/Home.tsx", contents: reactAppHome(name) },
      { path: "src/app/details/Details.tsx", contents: reactAppDetails() },
      { path: "src/app/routes.tsx", contents: reactAppRoutes() },
      { path: "src/main.tsx", contents: reactAppMain(profile) },
      { path: "src/entry.tsx", contents: reactAppEntry(name, profile) },
    ] : [
      { path: "src/app/App.tsx", contents: reactSinglePageApp(name) },
      { path: "src/main.tsx", contents: reactSinglePageAppMain(name, profile) },
      { path: "src/entry.tsx", contents: reactSinglePageAppEntry(name, profile) },
    ]),
    { path: "src/exported-widgets/README.md", contents: `# Exported widgets\n\nCreate \`<widget-id>/index.tsx\`; Atlas exposes it automatically through Native Federation. Consumers declare \`owner-app/widget-id\` in \`uses\`.\n` }
  ];
}
