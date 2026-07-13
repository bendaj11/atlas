import { angularHostBootstrap, angularHostComponent, angularHostDefaultRouteComponent, angularHostMain } from "./angular-host-generator.js";
import {
  angularAppAppComponent,
  angularAppDetailsComponent,
  angularAppEntry,
  angularAppHomeComponent,
  angularAppRoutes,
  angularSinglePageAppComponent,
  angularSinglePageAppEntry,
  appSourceReadme
} from "./angular-app-generator.js";
import { angularIndex, angularPackage } from "./angular-package-generator.js";
import {
  angularAppTsconfig,
  angularFederationConfig,
  angularWorkspace,
} from "./angular-workspace-generator.js";
import { atlasAppConfig, atlasHostConfig, atlasHostStyles, json, title } from "./common-generator.js";
import { angularVersionProfile } from "./generator-versions.js";
import type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./generator-types.js";

export function generateAngularHostFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  const { name } = options;
  const profile = angularVersionProfile(options);
  return [
    { path: "package.json", contents: json(angularPackage({ packageName: options.packageName ?? name, projectName: name, host: true, profile })) },
    { path: "angular.json", contents: json(angularWorkspace(name, true, options.devServerPort)) },
    { path: "tsconfig.app.json", contents: json(angularAppTsconfig()) },
    { path: "federation.config.js", contents: angularFederationConfig(name, true) },
    { path: "atlas.config.ts", contents: atlasHostConfig(options) },
    { path: "src/index.html", contents: angularIndex("Atlas Host", "<atlas-host-root></atlas-host-root>") },
    { path: "src/styles.css", contents: atlasHostStyles() },
    { path: "src/app/app.component.ts", contents: angularHostComponent() },
    { path: "src/app/atlas-host-default-route.component.ts", contents: angularHostDefaultRouteComponent() },
    { path: "src/main.ts", contents: angularHostMain() },
    { path: "src/bootstrap.ts", contents: angularHostBootstrap() }
  ];
}

export function generateAngularAppFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  const { name } = options;
  const profile = angularVersionProfile(options);
  const routed = options.routing ?? true;
  return [
    { path: "package.json", contents: json(angularPackage({ packageName: options.packageName ?? name, projectName: name, host: false, profile, routed })) },
    { path: "angular.json", contents: json(angularWorkspace(name, false, options.devServerPort)) },
    { path: "tsconfig.app.json", contents: json(angularAppTsconfig()) },
    { path: "federation.config.js", contents: angularFederationConfig(name, false) },
    { path: "atlas.config.ts", contents: atlasAppConfig(options) },
    { path: "src/index.html", contents: angularIndex(title(name), "<div>Atlas app assets</div>") },
    { path: "src/styles.css", contents: "" },
    { path: "src/assets/.gitkeep", contents: "" },
    { path: "src/main.ts", contents: `import { initFederation } from "@atlas/sdk/federation";\n\nvoid initFederation();\n` },
    { path: "src/app/README.md", contents: appSourceReadme() },
    ...(routed ? [
      { path: "src/app/app.component.ts", contents: angularAppAppComponent(name) },
      { path: "src/app/home/home.component.ts", contents: angularAppHomeComponent(name) },
      { path: "src/app/details/details.component.ts", contents: angularAppDetailsComponent() },
      { path: "src/app/routes.ts", contents: angularAppRoutes() },
      { path: "src/entry.ts", contents: angularAppEntry(name) },
    ] : [
      { path: "src/app/app.component.ts", contents: angularSinglePageAppComponent(name) },
      { path: "src/entry.ts", contents: angularSinglePageAppEntry(name) },
    ]),
    { path: "src/exported-widgets/README.md", contents: `# Exported widgets\n\nCreate \`<widget-id>/index.ts\`; Atlas exposes it automatically. Consumers declare \`owner-app/widget-id\` in \`uses\`.\n` }
  ];
}
