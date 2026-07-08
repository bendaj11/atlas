import { angularHostBootstrap, angularHostComponent, angularHostMain } from "./angular-host-generator.js";
import {
  angularMicrofrontendAppComponent,
  angularMicrofrontendDetailsComponent,
  angularMicrofrontendEntry,
  angularMicrofrontendHomeComponent,
  angularMicrofrontendRoutes,
  appSourceReadme
} from "./angular-microfrontend-generator.js";
import { angularIndex, angularPackage } from "./angular-package-generator.js";
import {
  angularAppTsconfig,
  angularFederationConfig,
  angularTsconfig,
  angularWorkspace,
  atlasConfigTsconfig
} from "./angular-workspace-generator.js";
import { atlasConfig, atlasHostConfig, atlasHostStyles, json, title } from "./common-generator.js";
import { angularVersionProfile } from "./generator-versions.js";
import type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./generator-types.js";

export function generateAngularHostFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  const { name } = options;
  const profile = angularVersionProfile(options);
  return [
    { path: "package.json", contents: json(angularPackage({ packageName: options.packageName ?? name, projectName: name, host: true, profile })) },
    { path: "angular.json", contents: json(angularWorkspace(name, true)) },
    { path: "tsconfig.json", contents: json(angularTsconfig()) },
    { path: "tsconfig.app.json", contents: json(angularAppTsconfig()) },
    { path: "tsconfig.atlas.json", contents: json(atlasConfigTsconfig()) },
    { path: "federation.config.js", contents: angularFederationConfig(name, true) },
    { path: "atlas.config.ts", contents: atlasHostConfig(options) },
    { path: "src/index.html", contents: angularIndex("Atlas Host", "<atlas-host-root></atlas-host-root>") },
    { path: "src/styles.css", contents: atlasHostStyles() },
    { path: "src/app/app.component.ts", contents: angularHostComponent() },
    { path: "src/main.ts", contents: angularHostMain() },
    { path: "src/bootstrap.ts", contents: angularHostBootstrap() }
  ];
}

export function generateAngularMicrofrontendFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  const { name } = options;
  const profile = angularVersionProfile(options);
  return [
    { path: "package.json", contents: json(angularPackage({ packageName: options.packageName ?? name, projectName: name, host: false, profile })) },
    { path: "angular.json", contents: json(angularWorkspace(name, false)) },
    { path: "tsconfig.json", contents: json(angularTsconfig()) },
    { path: "tsconfig.app.json", contents: json(angularAppTsconfig()) },
    { path: "tsconfig.atlas.json", contents: json(atlasConfigTsconfig()) },
    { path: "federation.config.js", contents: angularFederationConfig(name, false) },
    { path: "atlas.config.ts", contents: atlasConfig(options, false) },
    { path: "src/index.html", contents: angularIndex(title(name), "<div>Atlas microfrontend assets</div>") },
    { path: "src/styles.css", contents: "" },
    { path: "src/assets/.gitkeep", contents: "" },
    { path: "src/main.ts", contents: `import { initFederation } from "@angular-architects/native-federation";\n\nvoid initFederation();\n` },
    { path: "src/app/README.md", contents: appSourceReadme() },
    { path: "src/app/app.component.ts", contents: angularMicrofrontendAppComponent(name) },
    { path: "src/app/home/home.component.ts", contents: angularMicrofrontendHomeComponent(name) },
    { path: "src/app/details/details.component.ts", contents: angularMicrofrontendDetailsComponent() },
    { path: "src/app/routes.ts", contents: angularMicrofrontendRoutes() },
    { path: "src/entry.ts", contents: angularMicrofrontendEntry(name) },
    { path: "src/exported-components/README.md", contents: `# Exported widgets\n\nCreate \`<widget-id>/index.ts\`; Atlas exposes it automatically. Consumers declare \`owner-mf/widget-id\` in \`uses\`.\n` }
  ];
}
