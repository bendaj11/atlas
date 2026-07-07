import { angularVersionProfile, atlasPackageRange, type AngularVersionProfile } from "./generator-versions.js";
import type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./generator-types.js";
import { atlasConfig, atlasHostConfig, atlasHostStyles, json, title } from "./common-generator.js";

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
    { path: "src/app/starter/shell/starter-shell.component.ts", contents: angularMicrofrontendShellComponent(name) },
    { path: "src/app/starter/home/starter-home.component.ts", contents: angularMicrofrontendHomeComponent(name) },
    { path: "src/app/starter/details/starter-details.component.ts", contents: angularMicrofrontendDetailsComponent() },
    { path: "src/app/routes.ts", contents: angularMicrofrontendRoutes() },
    { path: "src/entry.ts", contents: angularMicrofrontendEntry(name) },
    { path: "src/exported-components/README.md", contents: `# Exported widgets\n\nCreate \`<widget-id>/index.ts\`; Atlas exposes it automatically. Consumers declare \`owner-mf/widget-id\` in \`uses\`.\n` }
  ];
}

interface AngularPackageOptions {
  packageName: string;
  projectName: string;
  host: boolean;
  profile: AngularVersionProfile;
}

function angularPackage(options: AngularPackageOptions): unknown {
  const { packageName, projectName, host, profile } = options;
  const angular = profile.version;
  return {
    name: packageName,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: host ? `atlas runtime-config ${projectName} && ng serve ${projectName}` : `ng serve ${projectName}`,
      "atlas:config": "tsc -p tsconfig.atlas.json",
      build: host ? `atlas runtime-config ${projectName} && ng build` : "tsc -p tsconfig.atlas.json && ng build",
      ...(host ? {} : { "atlas:build": `atlas build ${projectName}` })
    },
    dependencies: {
      "@angular/animations": angular,
      "@angular/common": angular,
      "@angular/compiler": angular,
      "@angular/core": angular,
      "@angular/platform-browser": angular,
      "@angular/router": angular,
      "@angular-architects/native-federation": `^${profile.major}.0.0`,
      "@atlas/schema": atlasPackageRange(),
      "@atlas/sdk": atlasPackageRange(),
      ...(host ? { "@atlas/runtime": atlasPackageRange() } : {}),
      "es-module-shims": "^2.7.0",
      rxjs: "^7.8.0",
      tslib: "^2.8.0",
      "zone.js": profile.zone
    },
    devDependencies: {
      "@angular-devkit/build-angular": angular,
      "@angular/cli": angular,
      "@angular/compiler-cli": angular,
      typescript: profile.typescript
    }
  };
}

function angularIndex(pageTitle: string, body: string): string {
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${pageTitle}</title>\n  <base href="/">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n  ${body}\n</body>\n</html>\n`;
}

function angularWorkspace(name: string, host: boolean): unknown {
  return {
    version: 1,
    projects: {
      [name]: {
        projectType: "application", root: "", sourceRoot: "src",
        architect: {
          build: { builder: "@angular-architects/native-federation:build", options: { target: `${name}:esbuild:production` }, configurations: { development: { target: `${name}:esbuild:development`, dev: true } } },
          serve: { builder: "@angular-architects/native-federation:build", options: { target: `${name}:serve-original:development`, dev: true, port: host ? 4200 : 4201 } },
          esbuild: {
            builder: "@angular-devkit/build-angular:application",
            options: { outputPath: `dist/${name}`, index: "src/index.html", browser: "src/main.ts", polyfills: ["zone.js", "es-module-shims"], tsConfig: "tsconfig.app.json", assets: [{ glob: "**/*", input: "public" }, { glob: "**/*", input: "src/assets", output: "assets" }], styles: ["src/styles.css"] },
            configurations: { production: { outputHashing: "all" }, development: { optimization: false, sourceMap: true } }
          },
          "serve-original": { builder: "@angular-devkit/build-angular:dev-server", configurations: { production: { buildTarget: `${name}:esbuild:production` }, development: { buildTarget: `${name}:esbuild:development` } }, defaultConfiguration: "development" }
        }
      }
    }
  };
}

function angularTsconfig(): unknown {
  return { compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", strict: true, experimentalDecorators: true, useDefineForClassFields: false, lib: ["ES2022", "DOM"], skipLibCheck: true }, angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true } };
}

function angularAppTsconfig(): unknown {
  return { extends: "./tsconfig.json", compilerOptions: { outDir: "./out-tsc/app" }, files: ["src/main.ts"], include: ["src/**/*.ts"] };
}

function atlasConfigTsconfig(): unknown {
  return { extends: "./tsconfig.json", compilerOptions: { outDir: ".atlas", module: "Node16", moduleResolution: "Node16" }, files: ["atlas.config.ts"] };
}

function angularFederationConfig(name: string, host: boolean): string {
  return `// Generated by Atlas for @angular-architects/native-federation.\n// Edit atlas.config.ts and application source; do not hand-edit this compatibility file.\n// Native Federation requires this exact filename next to the Angular tsconfig.\nconst { readdirSync, existsSync } = require("node:fs");\nconst { join } = require("node:path");\nconst { withNativeFederation } = require("@angular-architects/native-federation/config");\n\nconst componentsRoot = join(__dirname, "src/exported-components");\nconst componentExposes = existsSync(componentsRoot)\n  ? Object.fromEntries(readdirSync(componentsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => [\`./components/\${entry.name}\`, \`./src/exported-components/\${entry.name}/index.ts\`]))\n  : {};\n\nmodule.exports = withNativeFederation({\n  name: "${remoteName(name)}",\n  exposes: ${host ? "{}" : `{ "./entry": "./src/entry.ts", ...componentExposes }`},\n  // Product dependencies stay inside this build so hosts never impose their versions.\n  shared: {},\n  skip: ["rxjs/ajax", "rxjs/fetch", "rxjs/testing", "rxjs/webSocket"]\n});\n`;
}

function angularHostComponent(): string {
  return `import { Component } from "@angular/core";\nimport { RouterOutlet } from "@angular/router";\n\n@Component({ selector: "atlas-host-root", standalone: true, imports: [RouterOutlet], template: \`<div data-atlas-host-status></div><header><strong>Atlas</strong><div data-atlas-slot="header"></div></header><nav data-atlas-navigation aria-label="Application"></nav><main data-atlas-route-outlet></main><router-outlet hidden />\` })\nexport class AppComponent {}\n`;
}

function angularHostMain(): string {
  return `import { initFederation } from "@angular-architects/native-federation";\n\nvoid initFederation()\n  .then(() => import("./bootstrap"))\n  .then(({ bootstrap }) => bootstrap())\n  .catch((error) => console.error("Atlas host failed to start", error));\n`;
}

function angularHostBootstrap(): string {
  return `import { Location } from "@angular/common";\nimport { bootstrapApplication } from "@angular/platform-browser";\nimport { provideRouter, Router } from "@angular/router";\nimport { initFederation, loadRemoteModule } from "@angular-architects/native-federation";\nimport { AtlasRouterAnchorComponent, startHost } from "@atlas/runtime/angular";\nimport { createFetchAtlasHttpClient, type AtlasHostData } from "@atlas/sdk";\nimport atlasConfig from "../atlas.config";\nimport { AppComponent } from "./app/app.component";\n\nexport async function bootstrap(): Promise<void> {\n  const app = await bootstrapApplication(AppComponent, { providers: [provideRouter([{ path: "**", component: AtlasRouterAnchorComponent }])] });\n  const hostData: AtlasHostData = { hostId: atlasConfig.id, name: atlasConfig.name ?? atlasConfig.id };\n  await startHost({\n    router: app.injector.get(Router),\n    location: app.injector.get(Location),\n    federation: { initFederation, loadRemoteModule },\n    showToast: (toast) => console.info("[Atlas toast]", toast.title),\n    hostData,\n    httpClient: createFetchAtlasHttpClient(fetch)\n  });\n}\n`;
}

function angularMicrofrontendEntry(name: string): string {
  const selector = `atlas-${name.replace(/[^a-zA-Z0-9-]/g, "-")}-root`;
  return `import "zone.js";
import { LocationStrategy } from "@angular/common";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { createLocationStrategy, defineMicrofrontend, provideAtlasMfContext, provideAtlasSdk } from "@atlas/sdk/angular";
import { routes } from "./app/routes";
import { StarterShellComponent } from "./app/starter/shell/starter-shell.component";

export default defineMicrofrontend(async ({ container, sdk, context }) => {
  const element = document.createElement("${selector}");
  const locationStrategy = createLocationStrategy(context);

  container.append(element);

  const app = await bootstrapApplication(StarterShellComponent, {
    providers: [
      provideRouter(routes),
      provideAtlasMfContext(context),
      provideAtlasSdk(sdk),
      { provide: LocationStrategy, useValue: locationStrategy }
    ]
  });

  return {
    unmount() {
      app.destroy();
      locationStrategy.ngOnDestroy();
      element.remove();
    }
  };
});
`;
}

function angularMicrofrontendShellComponent(name: string): string {
  const selector = `atlas-${name.replace(/[^a-zA-Z0-9-]/g, "-")}-root`;
  return `import { Component } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";

@Component({
  selector: "${selector}",
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: \`
    <section>
      <h1>${title(name)}</h1>
      <nav>
        <a routerLink="/">Home</a>
        <a routerLink="details/42">Details</a>
      </nav>
      <router-outlet />
    </section>
  \`
})
export class StarterShellComponent {}
`;
}

function angularMicrofrontendHomeComponent(name: string): string {
  return `import { Component } from "@angular/core";

@Component({
  selector: "atlas-mf-home",
  standalone: true,
  template: \`<p>${title(name)} home</p>\`
})
export class StarterHomeComponent {}
`;
}

function angularMicrofrontendDetailsComponent(): string {
  return `import { Component } from "@angular/core";

@Component({
  selector: "atlas-mf-details",
  standalone: true,
  template: \`<p>Routed details page</p>\`
})
export class StarterDetailsComponent {}
`;
}

function angularMicrofrontendRoutes(): string {
  return `import type { Routes } from "@angular/router";
import { StarterDetailsComponent } from "./starter/details/starter-details.component";
import { StarterHomeComponent } from "./starter/home/starter-home.component";

export const routes: Routes = [
  { path: "", component: StarterHomeComponent },
  { path: "details/:id", component: StarterDetailsComponent }
];
`;
}

function appSourceReadme(): string {
  return `# App source

Required Atlas wiring lives in \`src/entry.ts\`, \`atlas.config.ts\`, and \`federation.config.js\`. Keep those files aligned with Atlas docs when changing platform wiring.

Replaceable starter UI lives in \`src/app/starter\`. Delete or replace those folders when adding product screens.

\`src/app/routes.ts\` connects starter screens to the router. Update it when replacing starter UI.
`;
}

function remoteName(name: string): string {
  return `atlas_${name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}
