import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@jest/globals";
import { atlasPackageRange, run } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

const ATLAS_PACKAGE_RANGE = await atlasPackageRange();

test("atlas preserves Nx Angular workspace version after native scaffolding", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-angular-generator-"));
  const bin = join(root, "bin");
  const products = join(root, "products");
  await mkdir(bin);
  await mkdir(products);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    dependencies: { "@angular/core": "~20.3.0", "@angular/animations": "~21.2.0" },
    devDependencies: { "@nx/angular": "22.0.0" }
  }));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ files: [], references: [] }));
  await writeFile(join(root, "tsconfig.base.json"), JSON.stringify({
    compilerOptions: { composite: true, declaration: true }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "format:write" ]; then
  printf '%s\n' "$3" > formatted.txt
  exit 0
fi
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/public" "$directory/src"
  printf 'nx public asset\n' > "$directory/public/nx.txt"
  printf 'nx source\n' > "$directory/src/main.ts"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf 'nx jest\n' > "$directory/jest.config.ts"
  printf '{"name":"mobile-host","root":"products/host","marker":"nx-generator","targets":{"build":{"executor":"@nx/angular:application"},"serve":{"executor":"@angular-devkit/build-angular:dev-server","defaultConfiguration":"development","configurations":{"production":{"buildTarget":"mobile-host:build:production"},"development":{"buildTarget":"mobile-host:build:development"}}}}}\n' > "$directory/project.json"
  printf '{"extends":"../../tsconfig.base.json","marker":"nx-generator"}\n' > "$directory/tsconfig.json"
  printf '{"extends":"./tsconfig.json","marker":"nx-generator"}\n' > "$directory/tsconfig.app.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "host", "host",
    "--framework=angular", "--framework-version=~21.2.0", "--skip-install"
  ], { cwd: products, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  const project = JSON.parse(await readFile(join(root, "products/host/project.json"), "utf8"));
  assert.equal(project.marker, "nx-generator");
  assert.equal(project.targets["atlas:config"].options.cwd, undefined);
  assert.equal(project.targets["atlas:config"].options.command, "atlas compile-config mobile-host");
  assert.deepEqual(project.targets["atlas:config"].outputs, ["{projectRoot}/.atlas"]);
  assert.equal(project.targets.build.executor, "@angular-architects/native-federation:build");
  assert.equal(project.targets.build.options.target, "mobile-host:esbuild:production");
  assert.equal(project.targets.build.configurations.development.target, "mobile-host:esbuild:development");
  assert.equal(project.targets.build.configurations.development.dev, true);
  assert.equal(project.targets.esbuild.executor, "@nx/angular:application");
  assert.deepEqual(project.targets.esbuild.options.polyfills, ["es-module-shims"]);
  assert.equal(project.targets.serve.executor, "@angular-architects/native-federation:build");
  assert.equal(project.targets.serve.options.target, "mobile-host:serve-original:development");
  assert.equal(project.targets.serve.options.dev, true);
  assert.equal(project.targets.serve.options.port, 4200);
  assert.equal(project.targets["serve-original"].executor, "@angular-devkit/build-angular:dev-server");
  assert.equal(project.targets["serve-original"].configurations.production.buildTarget, "mobile-host:esbuild:production");
  assert.equal(project.targets["serve-original"].configurations.development.buildTarget, "mobile-host:esbuild:development");
  assert.equal(project.targets.dev.options.command, "atlas dev mobile-host");
  assert.equal(project.targets.dev.options.forwardAllArgs, true);
  assert.equal(project.targets["mobile-host"].options.command, "nx run mobile-host:dev");
  assert.equal(project.targets["build-server"].options.cwd, "products/host");
  assert.equal(project.targets["build-server"].options.command, "tsc -p server/tsconfig.json");
  assert.equal(project.targets["start-server"].options.command, "node server/dist/main.mjs");
  assert.match(await readFile(join(root, "products/host/server/main.mts"), "utf8"), /runAtlasHostServer/);
  assert.match(await readFile(join(root, "products/host/src/main.ts"), "utf8"), /import\("\.\/bootstrap"\)/);
  assert.match(await readFile(join(root, "products/host/src/bootstrap.ts"), "utf8"), /startHost/);
  assert.doesNotMatch(await readFile(join(root, "products/host/src/bootstrap.ts"), "utf8"), /AtlasDefaultHostRouteComponent/);
  await assert.rejects(access(join(root, "products/host/src/app.component.ts")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "products/host/src/app/app.component.ts"), "utf8"), /data-atlas-host-status/);
  assert.match(await readFile(join(root, "products/host/src/app/atlas-host-default-route.component.ts"), "utf8"), /standalone: true/);
  assert.match(await readFile(join(root, "products/host/src/index.html"), "utf8"), /<atlas-host-root><\/atlas-host-root>/);
  assert.equal(await readFile(join(root, "products/host/eslint.config.mjs"), "utf8"), "nx eslint\n");
  assert.equal(await readFile(join(root, "products/host/jest.config.ts"), "utf8"), "nx jest\n");
  assert.equal(JSON.parse(await readFile(join(root, "products/host/tsconfig.json"), "utf8")).marker, "nx-generator");
  const angularHostTsconfig = JSON.parse(await readFile(join(root, "products/host/tsconfig.app.json"), "utf8"));
  assert.equal(angularHostTsconfig.marker, "nx-generator");
  assert.deepEqual(angularHostTsconfig.include, ["atlas.config.ts"]);
  assert.equal(angularHostTsconfig.compilerOptions.emitDeclarationOnly, false);
  assert.equal(await readFile(join(root, "products/host/public/nx.txt"), "utf8"), "nx public asset\n");
  await assert.rejects(access(join(root, "products/host/package.json")), { code: "ENOENT" });
  await assert.rejects(access(join(root, "products/host/angular.json")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "products/host/atlas.config.ts"), "utf8"), /framework: "angular"/);
  assert.doesNotMatch(await readFile(join(root, "products/host/atlas.config.ts"), "utf8"), /resourcesRetryCount/);
  assert.match(await readFile(join(root, "products/host/federation.config.js"), "utf8"), /@atlas\/sdk\/federation-config/);
  assert.match(await readFile(join(root, "products/host/federation.config.js"), "utf8"), /expose: "host"/);
  await assert.rejects(access(join(root, "products/host/public/atlas.runtime.json")), { code: "ENOENT" });
  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(rootPackage.dependencies["@atlas/schema"], ATLAS_PACKAGE_RANGE);
  assert.equal(rootPackage.dependencies["@atlas/host-server"], ATLAS_PACKAGE_RANGE);
  assert.equal(rootPackage.dependencies["@atlas/runtime"], ATLAS_PACKAGE_RANGE);
  assert.equal(rootPackage.dependencies["@atlas/sdk"], ATLAS_PACKAGE_RANGE);
  assert.equal(rootPackage.dependencies["@angular/core"], "~20.3.0");
  assert.equal(rootPackage.dependencies["@angular/animations"], "~20.3.0");
  assert.equal(rootPackage.dependencies["@angular-architects/native-federation"], "^20.0.0");
  assert.equal(rootPackage.dependencies["es-module-shims"], "^2.7.0");
  assert.equal(rootPackage.devDependencies["@nx/angular"], "22.0.0");
  assert.match(stdout, /Detected an Nx workspace/);
  assert.match(stdout, /Delegating Angular scaffolding to @nx\/angular:application at products\/host/);
  assert.match(stdout, /Detected existing Angular version ~20\.3\.0 in package\.json; ignoring --framework-version=~21\.2\.0/);
  assert.match(stdout, /Added Atlas dependencies to package\.json/);
  assert.equal(await readFile(join(root, "formatted.txt"), "utf8"), "products/host\n");
  assert.match(stdout, /Formatted generated files in products\/host/);
});

test("atlas preserves Nx React project scaffolding around host startup files", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-react-host-generator-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    dependencies: { react: "^19.2.0", "react-dom": "^19.2.0" },
    devDependencies: { "@nx/react": "22.0.0" }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "format:write" ]; then
  printf '%s\n' "$3" > formatted.txt
  exit 0
fi
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src" "$directory/public"
  printf 'nx react source\n' > "$directory/src/main.tsx"
  printf 'nx react css\n' > "$directory/src/styles.css"
  printf 'nx react index\n' > "$directory/index.html"
  printf 'nx vite config\n' > "$directory/vite.config.mts"
  printf 'nx react public asset\n' > "$directory/public/nx.txt"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf '{"name":"host","marker":"nx-generator","targets":{}}\n' > "$directory/project.json"
  printf '{"extends":"../../tsconfig.base.json","marker":"nx-generator"}\n' > "$directory/tsconfig.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "host", "apps/host",
    "--framework=react", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  const project = JSON.parse(await readFile(join(root, "apps/host/project.json"), "utf8"));
  assert.equal(project.marker, "nx-generator");
  assert.equal(project.targets.dev.options.command, "atlas dev host");
  assert.equal(project.targets.dev.options.forwardAllArgs, true);
  assert.equal(project.targets.serve.executor, "nx:run-commands");
  assert.equal(project.targets.serve.options.cwd, "apps/host");
  assert.equal(project.targets.serve.options.command, "vite");
  assert.equal(project.targets.serve.continuous, true);
  assert.equal(project.targets["build-server"].options.cwd, "apps/host");
  assert.equal(project.targets["start-server"].options.command, "node server/dist/main.mjs");
  assert.match(await readFile(join(root, "apps/host/server/main.mts"), "utf8"), /runAtlasHostServer/);
  const hostMain = await readFile(join(root, "apps/host/src/main.tsx"), "utf8");
  assert.match(hostMain, /<HostAtlasProvider>/);
  assert.doesNotMatch(hostMain, /startHost|createBrowserRouter|atlasConfig/);
  assert.doesNotMatch(hostMain, /import\.meta\.hot/);
  await assert.rejects(access(join(root, "apps/host/src/atlas-bootstrap.ts")), { code: "ENOENT" });
  const atlasProvider = await readFile(join(root, "apps/host/src/HostAtlasProvider.tsx"), "utf8");
  assert.match(atlasProvider, /AtlasHostProvider/);
  assert.match(atlasProvider, /createBrowserRouter/);
  assert.match(atlasProvider, /Component: HostLayout/);
  assert.match(atlasProvider, /hostId=\{atlasConfig\.id\}/);
  const hostLayout = await readFile(join(root, "apps/host/src/app/HostLayout.tsx"), "utf8");
  assert.match(hostLayout, /data-atlas-route-outlet/);
  const hostViteConfig = await readFile(join(root, "apps/host/vite.config.ts"), "utf8");
  assert.doesNotMatch(hostViteConfig, /ReactBabelOptions/);
  assert.match(hostViteConfig, /babel: \{/);
  assert.match(hostViteConfig, /panicThreshold: "none"/);
  assert.match(hostViteConfig, /target: "19"/);
  assert.match(hostViteConfig, /server: \{ port: 4200, cors: true \}/);
  await assert.rejects(access(join(root, "apps/host/vite.config.mts")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "apps/host/index.html"), "utf8"), /<script type="module" src="\/src\/main\.tsx"><\/script>/);
  assert.match(await readFile(join(root, "apps/host/src/styles.css"), "utf8"), /data-atlas-route-outlet/);
  assert.equal(await readFile(join(root, "apps/host/eslint.config.mjs"), "utf8"), "nx eslint\n");
  assert.equal(await readFile(join(root, "apps/host/public/nx.txt"), "utf8"), "nx react public asset\n");
  await assert.rejects(access(join(root, "apps/host/public/remoteEntry.json")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "apps/host/src/host.tsx"), "utf8"), /AtlasHostClientEntry/);
  const reactHostTsconfig = JSON.parse(await readFile(join(root, "apps/host/tsconfig.json"), "utf8"));
  assert.equal(reactHostTsconfig.marker, "nx-generator");
  assert.deepEqual(reactHostTsconfig.include, ["atlas.config.ts"]);
  assert.match(await readFile(join(root, "apps/host/atlas.config.ts"), "utf8"), /framework: "react"/);
  await assert.rejects(access(join(root, "apps/host/package.json")), { code: "ENOENT" });
  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(rootPackage.dependencies["@atlas/runtime"], ATLAS_PACKAGE_RANGE);
  assert.equal(rootPackage.dependencies.react, "^19.2.0");
  assert.equal(rootPackage.dependencies["react-dom"], "^19.2.0");
  assert.equal(rootPackage.devDependencies["@nx/react"], "22.0.0");
  assert.match(stdout, /Delegating React scaffolding to @nx\/react:application at apps\/host/);
  assert.match(stdout, /Added Atlas dependencies to package\.json/);
  assert.equal(await readFile(join(root, "formatted.txt"), "utf8"), "apps/host\n");
  assert.match(stdout, /Formatted generated files in apps\/host/);
});

test("atlas adds required Angular app files after Nx scaffolding", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-angular-app-generator-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    dependencies: { "@angular/core": "^20.3.0" },
    devDependencies: { "@nx/angular": "22.0.0" }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "format:write" ]; then
  printf '%s\n' "$3" > formatted.txt
  exit 0
fi
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src/app/nx-only" "$directory/public"
  printf 'nx angular source\n' > "$directory/src/main.ts"
  printf 'nx angular index\n' > "$directory/src/index.html"
  printf 'nx angular styles\n' > "$directory/src/styles.css"
  printf 'nx app component\n' > "$directory/src/app/app.component.ts"
  printf 'nx nested component\n' > "$directory/src/app/nx-only/nx-only.component.ts"
  printf 'nx angular public asset\n' > "$directory/public/nx.txt"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf '{"name":"orders","marker":"nx-generator","targets":{"build":{"executor":"@nx/angular:application"},"serve":{"executor":"@angular-devkit/build-angular:dev-server","defaultConfiguration":"development","configurations":{"production":{"buildTarget":"orders:build:production"},"development":{"buildTarget":"orders:build:development"}}}}}\n' > "$directory/project.json"
  printf '{"extends":"./tsconfig.json","marker":"nx-generator"}\n' > "$directory/tsconfig.app.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders",
    "--framework=angular", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  assert.match(await readFile(join(root, "orders/src/entry.ts"), "utf8"), /defineApp/);
  assert.match(await readFile(join(root, "orders/src/entry.ts"), "utf8"), /bootstrapApplication\(AppComponent/);
  assert.doesNotMatch(await readFile(join(root, "orders/src/entry.ts"), "utf8"), /@Component|router-outlet/);
  await assert.rejects(access(join(root, "orders/src/app.component.ts")), { code: "ENOENT" });
  await assert.rejects(access(join(root, "orders/src/app/nx-only/nx-only.component.ts")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "orders/src/app/README.md"), "utf8"), /Required Atlas wiring/);
  assert.match(await readFile(join(root, "orders/src/app/app.component.ts"), "utf8"), /router-outlet/);
  assert.match(await readFile(join(root, "orders/src/app/routes.ts"), "utf8"), /export const routes: Routes/);
  assert.match(await readFile(join(root, "orders/src/app/home/home.component.ts"), "utf8"), /export class HomeComponent/);
  assert.match(await readFile(join(root, "orders/src/app/details/details.component.ts"), "utf8"), /export class DetailsComponent/);
  assert.match(await readFile(join(root, "orders/src/main.ts"), "utf8"), /initFederation/);
  assert.doesNotMatch(await readFile(join(root, "orders/src/main.ts"), "utf8"), /bootstrapApplication|AppComponent|createAtlasSdk|provideAtlasSdk/);
  assert.match(await readFile(join(root, "orders/src/index.html"), "utf8"), /Atlas app assets/);
  const federationConfig = await readFile(join(root, "orders/federation.config.js"), "utf8");
  assert.match(federationConfig, /@atlas\/sdk\/federation-config/);
  assert.match(federationConfig, /expose: "app"/);
  assert.match(await readFile(join(root, "orders/src/exported-widgets/README.md"), "utf8"), /atlas g widget <name> --app=\./);
  assert.match(await readFile(join(root, "orders/src/exported-widgets/README.md"), "utf8"), /sdk\.getWidget\(widgetId\)/);
  assert.equal(await readFile(join(root, "orders/public/nx.txt"), "utf8"), "nx angular public asset\n");
  assert.equal(await readFile(join(root, "orders/eslint.config.mjs"), "utf8"), "nx eslint\n");
  const project = JSON.parse(await readFile(join(root, "orders/project.json"), "utf8"));
  assert.equal(project.marker, "nx-generator");
  assert.equal(project.targets.build.executor, "@angular-architects/native-federation:build");
  assert.equal(project.targets.build.options.target, "orders:esbuild:production");
  assert.equal(project.targets.esbuild.executor, "@nx/angular:application");
  assert.deepEqual(project.targets.esbuild.options.polyfills, ["es-module-shims"]);
  assert.equal(project.targets.serve.executor, "@angular-architects/native-federation:build");
  assert.equal(project.targets.serve.options.target, "orders:serve-original:development");
  assert.equal(project.targets.serve.options.port, 4201);
  assert.equal(project.targets["serve-original"].executor, "@angular-devkit/build-angular:dev-server");
  assert.equal(project.targets["serve-original"].configurations.production.buildTarget, "orders:esbuild:production");
  assert.equal(project.targets["serve-original"].configurations.development.buildTarget, "orders:esbuild:development");
  assert.equal(project.targets.dev.options.command, "atlas dev orders");
  assert.equal(project.targets.dev.options.forwardAllArgs, true);
  assert.equal(project.targets.orders.options.command, "nx run orders:dev");
  const angularAppTsconfig = JSON.parse(await readFile(join(root, "orders/tsconfig.app.json"), "utf8"));
  assert.equal(angularAppTsconfig.marker, "nx-generator");
  assert.deepEqual(angularAppTsconfig.include, ["atlas.config.ts"]);
  assert.equal(angularAppTsconfig.compilerOptions.emitDeclarationOnly, false);
  assert.match(stdout, /Delegating Angular scaffolding to @nx\/angular:application at orders/);
  assert.equal(await readFile(join(root, "formatted.txt"), "utf8"), "orders\n");
  assert.match(stdout, /Formatted generated files in orders/);
});

test("atlas fails clearly when Nx Angular scaffolding reports stale project paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-angular-stale-root-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    dependencies: { "@angular/core": "^20.3.0" },
    devDependencies: { "@nx/angular": "22.0.0" }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src"
  printf 'nx angular source\n' > "$directory/src/main.ts"
  printf '{"name":"orders","root":"login","sourceRoot":"login/src","targets":{"esbuild":{"options":{"browser":"login/src/main.ts","tsConfig":"login/tsconfig.app.json","styles":["login/src/styles.less"]}}}}\n' > "$directory/project.json"
  printf '{"extends":"./tsconfig.json"}\n' > "$directory/tsconfig.app.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  await assert.rejects(run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders",
    "--framework=angular", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }), {
    message: /Nx project root mismatch.*project\.json points at "login".*generated the project at "orders".*login\/tsconfig\.app\.json.*Update project\.json root\/sourceRoot\/build options/
  });
});

test("atlas adds required React app files after Nx scaffolding", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-react-app-generator-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    dependencies: { react: "^19.2.0", "react-dom": "^19.2.0" },
    devDependencies: { "@nx/react": "22.0.0" }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "format:write" ]; then
  printf '%s\n' "$3" > formatted.txt
  exit 0
fi
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src/app/nx-only" "$directory/public"
  printf 'nx react source\n' > "$directory/src/main.tsx"
  printf 'nx react index\n' > "$directory/index.html"
  printf 'nx react styles\n' > "$directory/src/styles.css"
  printf 'nx vite config\n' > "$directory/vite.config.mts"
  printf 'nx app component\n' > "$directory/src/app/app.tsx"
  printf 'nx nested component\n' > "$directory/src/app/nx-only/nx-only.tsx"
  printf 'nx react public asset\n' > "$directory/public/nx.txt"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf '{"name":"orders","marker":"nx-generator"}\n' > "$directory/project.json"
  printf '{"extends":"./tsconfig.json","marker":"nx-generator"}\n' > "$directory/tsconfig.app.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders",
    "--framework=react", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  const reactEntry = await readFile(join(root, "orders/src/entry.tsx"), "utf8");
  assert.match(reactEntry, /createRoutedApp/);
  assert.match(reactEntry, /import \{ routes \} from "\.\/app\/routes"/);
  assert.doesNotMatch(reactEntry, /await import|import\.meta\.hot/);
  assert.doesNotMatch(reactEntry, /useAtlasSdk|<Outlet|<Link|function Layout/);
  assert.equal((await readdir(join(root, "orders/src/app"))).includes("app.tsx"), false);
  await assert.rejects(access(join(root, "orders/src/app/nx-only/nx-only.tsx")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "orders/src/app/README.md"), "utf8"), /Main app component/);
  assert.match(await readFile(join(root, "orders/src/app/routes.tsx"), "utf8"), /export const routes: RouteObject\[\]/);
  assert.doesNotMatch(await readFile(join(root, "orders/src/app/App.tsx"), "utf8"), /useAtlasSdk/);
  assert.match(await readFile(join(root, "orders/src/app/home/Home.tsx"), "utf8"), /export function Home/);
  assert.match(await readFile(join(root, "orders/src/app/details/Details.tsx"), "utf8"), /export function Details/);
  assert.equal(await readFile(join(root, "orders/src/main.tsx"), "utf8"), "nx react source\n");
  const reactViteConfig = await readFile(join(root, "orders/vite.config.ts"), "utf8");
  assert.match(reactViteConfig, /remoteEntry\.json/);
  assert.match(reactViteConfig, /atlasReactRefreshPreamble/);
  assert.doesNotMatch(reactViteConfig, /ReactBabelOptions/);
  assert.match(reactViteConfig, /babel: \{/);
  assert.match(reactViteConfig, /panicThreshold: "none"/);
  assert.match(reactViteConfig, /target: "19"/);
  await assert.rejects(access(join(root, "orders/vite.config.mts")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "orders/index.html"), "utf8"), /Orders assets/);
  assert.match(await readFile(join(root, "orders/src/exported-widgets/README.md"), "utf8"), /atlas g widget <name> --app=\./);
  assert.match(await readFile(join(root, "orders/src/exported-widgets/README.md"), "utf8"), /sdk\.getWidget\(widgetId\)/);
  assert.equal(await readFile(join(root, "orders/public/nx.txt"), "utf8"), "nx react public asset\n");
  assert.equal(await readFile(join(root, "orders/eslint.config.mjs"), "utf8"), "nx eslint\n");
  assert.equal(JSON.parse(await readFile(join(root, "orders/project.json"), "utf8")).marker, "nx-generator");
  const reactAppTsconfig = JSON.parse(await readFile(join(root, "orders/tsconfig.app.json"), "utf8"));
  assert.equal(reactAppTsconfig.marker, "nx-generator");
  assert.deepEqual(reactAppTsconfig.include, ["atlas.config.ts"]);
  assert.equal(reactAppTsconfig.compilerOptions.module, "ESNext");
  assert.equal(reactAppTsconfig.compilerOptions.moduleResolution, "bundler");
  assert.deepEqual(reactAppTsconfig.compilerOptions.types, ["vite/client"]);
  assert.match(stdout, /Delegating React scaffolding to @nx\/react:application at orders/);
  assert.equal(await readFile(join(root, "formatted.txt"), "utf8"), "orders\n");
  assert.match(stdout, /Formatted generated files in orders/);
});

test("atlas aligns React dependencies to an Nx project package framework version", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-package-generator-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    devDependencies: { "@nx/react": "22.0.0" }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "format:write" ]; then
  printf '%s\n' "$3" > formatted.txt
  exit 0
fi
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src"
  printf 'react source\n' > "$directory/src/main.tsx"
  printf '{"name":"@acme/orders","version":"0.0.1","dependencies":{"react":"^17.0.2","react-dom":"^18.3.1"},"devDependencies":{}}\n' > "$directory/package.json"
  printf '{"name":"orders","marker":"nx-generator"}\n' > "$directory/project.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "packages/orders",
    "--framework=react", "--framework-version=^19.2.0", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const projectPackage = JSON.parse(await readFile(join(root, "packages/orders/package.json"), "utf8"));
  assert.equal(rootPackage.dependencies?.["@atlas/sdk"], undefined);
  assert.equal(projectPackage.dependencies.react, "^17.0.2");
  assert.equal(projectPackage.dependencies["@atlas/schema"], ATLAS_PACKAGE_RANGE);
  assert.equal(projectPackage.dependencies["@atlas/sdk"], ATLAS_PACKAGE_RANGE);
  assert.equal(projectPackage.dependencies["@softarc/native-federation-runtime"], undefined);
  assert.equal(projectPackage.dependencies["react-dom"], "^17.0.2");
  assert.equal(projectPackage.dependencies["react-router-dom"], "^6.30.1");
  assert.equal(projectPackage.devDependencies["@rolldown/plugin-babel"], undefined);
  assert.equal(projectPackage.devDependencies["@vitejs/plugin-react"], "^5.0.4");
  assert.equal(projectPackage.devDependencies.vite, "^7.3.6");
  assert.match(stdout, /Detected existing React version \^17\.0\.2 in packages\/orders\/package\.json; ignoring --framework-version=\^19\.2\.0/);
  assert.match(stdout, /Added Atlas dependencies to packages\/orders\/package\.json/);
});
