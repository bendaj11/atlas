import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@jest/globals';
import { ensureDelegatedNxTargets } from '../dist/generate-nx.js';
import { atlasPackageRange, run } from './build.driver.js';

process.chdir(fileURLToPath(new URL('../../..', import.meta.url)));

const ATLAS_PACKAGE_RANGE = await atlasPackageRange();

test.each(['host', 'app'] as const)(
  'atlas preserves the native Nx React dev target for %s projects when serve aliases it',
  async (type) => {
    const root = await mkdtemp(
      join(tmpdir(), `atlas-nx-react-${type}-dev-alias-`),
    );
    const projectRoot = join(root, `apps/${type}`);
    const nativeDevTarget = {
      executor: '@nx/vite:dev-server',
      options: { buildTarget: `${type}:build` },
    };
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, 'project.json'),
      JSON.stringify({
        name: type,
        tags: ['scope:test'],
        targets: {
          dev: nativeDevTarget,
          serve: {
            executor: 'nx:run-commands',
            options: { command: `nx run ${type}:dev`, forwardAllArgs: true },
          },
        },
      }),
    );

    await ensureDelegatedNxTargets(
      root,
      projectRoot,
      type,
      type,
      'react',
      type === 'host' ? 4200 : 4201,
    );

    const project = JSON.parse(
      await readFile(join(projectRoot, 'project.json'), 'utf8'),
    );
    expect(project.tags).toStrictEqual(['scope:test', 'atlas']);
    expect({
      dev: project.targets.dev,
      serve: project.targets.serve,
    }).toStrictEqual({
      dev: {
        executor: 'nx:run-commands',
        options: { command: `atlas dev ${type}`, forwardAllArgs: true },
      },
      serve: nativeDevTarget,
    });
  },
);

test('atlas preserves the native Nx Angular dev target before federation wraps serve', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-nx-angular-dev-alias-'));
  const projectRoot = join(root, 'apps/orders');
  await mkdir(projectRoot, { recursive: true });
  await writeFile(
    join(projectRoot, 'project.json'),
    JSON.stringify({
      name: 'orders',
      targets: {
        build: {
          executor: '@nx/angular:application',
          options: { polyfills: [] },
        },
        dev: {
          executor: '@angular-devkit/build-angular:dev-server',
          options: { buildTarget: 'orders:build:development' },
        },
        serve: {
          executor: 'nx:run-commands',
          options: { command: 'nx run orders:dev', forwardAllArgs: true },
        },
      },
    }),
  );

  await ensureDelegatedNxTargets(
    root,
    projectRoot,
    'orders',
    'app',
    'angular',
    4201,
  );

  const project = JSON.parse(
    await readFile(join(projectRoot, 'project.json'), 'utf8'),
  );
  expect(project.tags).toStrictEqual(['atlas']);
  expect({
    dev: project.targets.dev,
    serve: project.targets.serve,
    serveOriginal: project.targets['serve-original'],
  }).toStrictEqual({
    dev: {
      executor: 'nx:run-commands',
      options: { command: 'atlas dev orders', forwardAllArgs: true },
    },
    serve: {
      executor: '@angular-architects/native-federation:build',
      options: {
        target: 'orders:serve-original:development',
        dev: true,
        port: 4201,
      },
    },
    serveOriginal: {
      executor: '@angular-devkit/build-angular:dev-server',
      options: { buildTarget: 'orders:esbuild:development' },
    },
  });
});

test('atlas preserves Nx Angular workspace version after native scaffolding', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-nx-angular-generator-'));
  const bin = join(root, 'bin');
  const products = join(root, 'products');
  await mkdir(bin);
  await mkdir(products);
  await writeFile(join(root, 'nx.json'), '{}\n');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'acme',
      private: true,
      packageManager: 'yarn@1.22.22',
      dependencies: {
        '@angular/core': '~20.3.0',
        '@angular/animations': '~21.2.0',
      },
      devDependencies: { '@nx/angular': '22.0.0' },
    }),
  );
  await writeFile(
    join(root, 'tsconfig.json'),
    JSON.stringify({ files: [], references: [] }),
  );
  await writeFile(
    join(root, 'tsconfig.base.json'),
    JSON.stringify({
      compilerOptions: { composite: true, declaration: true },
    }),
  );
  await writeFile(
    join(bin, 'yarn'),
    `#!/bin/sh
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
`,
    { mode: 0o755 },
  );

  const stdout = await run(
    process.execPath,
    [
      join(process.cwd(), 'packages/cli/dist/index.js'),
      'g',
      'host',
      'host',
      '--framework=angular',
      '--framework-version=~21.2.0',
      '--skip-install',
    ],
    {
      cwd: products,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    },
  );

  const project = JSON.parse(
    await readFile(join(root, 'products/host/project.json'), 'utf8'),
  );
  expect(project.marker).toBe('nx-generator');
  expect(project.targets['atlas:config'].options.cwd).toBe(undefined);
  expect(project.targets['atlas:config'].options.command).toBe(
    'atlas compile-config mobile-host',
  );
  expect(project.targets['atlas:config'].outputs).toStrictEqual([
    '{projectRoot}/.atlas',
  ]);
  expect(project.targets['atlas:publish'].cache).toBe(false);
  expect(project.targets['atlas:publish'].dependsOn).toStrictEqual(['build']);
  expect(project.targets['atlas:publish'].options.command).toBe(
    'atlas publish mobile-host --from-build-output',
  );
  expect(project.targets['atlas:bootstrap'].outputs).toStrictEqual([
    '{projectRoot}/dist/bootstrap',
  ]);
  expect(project.targets['atlas:bootstrap'].options.command).toBe(
    'atlas build-bootstrap mobile-host --skip-compile',
  );
  expect(project.targets.build.executor).toBe(
    '@angular-architects/native-federation:build',
  );
  expect(project.targets.build.options.target).toBe(
    'mobile-host:esbuild:production',
  );
  expect(project.targets.build.configurations.development.target).toBe(
    'mobile-host:esbuild:development',
  );
  expect(project.targets.build.configurations.development.dev).toBe(true);
  expect(project.targets.esbuild.executor).toBe('@nx/angular:application');
  expect(project.targets.esbuild.options.polyfills).toStrictEqual([
    'es-module-shims',
  ]);
  expect(project.targets.serve.executor).toBe(
    '@angular-architects/native-federation:build',
  );
  expect(project.targets.serve.options.target).toBe(
    'mobile-host:serve-original:development',
  );
  expect(project.targets.serve.options.dev).toBe(true);
  expect(project.targets.serve.options.port).toBe(4200);
  expect(project.targets['serve-original'].executor).toBe(
    '@angular-devkit/build-angular:dev-server',
  );
  expect(
    project.targets['serve-original'].configurations.production.buildTarget,
  ).toBe('mobile-host:esbuild:production');
  expect(
    project.targets['serve-original'].configurations.development.buildTarget,
  ).toBe('mobile-host:esbuild:development');
  expect(project.targets.dev.options.command).toBe('atlas dev mobile-host');
  expect(project.targets.dev.options.forwardAllArgs).toBe(true);
  expect(project.targets['mobile-host'].options.command).toBe(
    'nx run mobile-host:dev',
  );
  expect(project.targets['build-server']).toBe(undefined);
  await expect(
    access(join(root, 'products/host/server')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(
    await readFile(join(root, 'products/host/src/main.ts'), 'utf8'),
  ).toMatch(/import\("\.\/bootstrap"\)/);
  expect(
    await readFile(join(root, 'products/host/src/bootstrap.ts'), 'utf8'),
  ).toMatch(/startHost/);
  expect(
    await readFile(join(root, 'products/host/src/bootstrap.ts'), 'utf8'),
  ).not.toMatch(/AtlasDefaultHostRouteComponent/);
  await expect(
    access(join(root, 'products/host/src/app.component.ts')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(
    await readFile(
      join(root, 'products/host/src/app/app.component.ts'),
      'utf8',
    ),
  ).toMatch(/data-atlas-host-status/);
  expect(
    await readFile(
      join(root, 'products/host/src/app/atlas-host-default-route.component.ts'),
      'utf8',
    ),
  ).toMatch(/standalone: true/);
  expect(
    await readFile(join(root, 'products/host/src/index.html'), 'utf8'),
  ).toMatch(/<atlas-host-root><\/atlas-host-root>/);
  expect(
    await readFile(join(root, 'products/host/atlas.bootstrap.html'), 'utf8'),
  ).toMatch(/id="atlas-host-root">Loading product…<\/div>/);
  expect(
    await readFile(join(root, 'products/host/eslint.config.mjs'), 'utf8'),
  ).toBe('nx eslint\n');
  expect(
    await readFile(join(root, 'products/host/jest.config.ts'), 'utf8'),
  ).toBe('nx jest\n');
  expect(
    JSON.parse(
      await readFile(join(root, 'products/host/tsconfig.json'), 'utf8'),
    ).marker,
  ).toBe('nx-generator');
  const angularHostTsconfig = JSON.parse(
    await readFile(join(root, 'products/host/tsconfig.app.json'), 'utf8'),
  );
  expect(angularHostTsconfig.marker).toBe('nx-generator');
  expect(angularHostTsconfig.include).toStrictEqual(['atlas.config.ts']);
  expect(angularHostTsconfig.compilerOptions.emitDeclarationOnly).toBe(false);
  expect(
    await readFile(join(root, 'products/host/public/nx.txt'), 'utf8'),
  ).toBe('nx public asset\n');
  await expect(
    access(join(root, 'products/host/package.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(
    access(join(root, 'products/host/angular.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(
    await readFile(join(root, 'products/host/atlas.config.ts'), 'utf8'),
  ).toMatch(/framework: "angular"/);
  expect(
    await readFile(join(root, 'products/host/atlas.config.ts'), 'utf8'),
  ).not.toMatch(/resourcesRetryCount/);
  expect(
    await readFile(join(root, 'products/host/federation.config.js'), 'utf8'),
  ).toMatch(/@atlas\/sdk\/federation-config/);
  expect(
    await readFile(join(root, 'products/host/federation.config.js'), 'utf8'),
  ).toMatch(/expose: "host"/);
  await expect(
    access(join(root, 'products/host/public/atlas.runtime.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  const rootPackage = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  expect(rootPackage.dependencies['@atlas/schema']).toBe(ATLAS_PACKAGE_RANGE);
  expect(rootPackage.dependencies['@atlas/bootstrap']).toBe(undefined);
  expect(rootPackage.dependencies['@atlas/runtime']).toBe(ATLAS_PACKAGE_RANGE);
  expect(rootPackage.dependencies['@atlas/sdk']).toBe(ATLAS_PACKAGE_RANGE);
  expect(rootPackage.dependencies['@angular/core']).toBe('~20.3.0');
  expect(rootPackage.dependencies['@angular/animations']).toBe('~20.3.0');
  expect(
    rootPackage.dependencies['@angular-architects/native-federation'],
  ).toBe('^20.0.0');
  expect(rootPackage.dependencies['es-module-shims']).toBe('^2.7.0');
  expect(rootPackage.devDependencies['@nx/angular']).toBe('22.0.0');
  expect(stdout).toMatch(/Detected an Nx workspace/);
  expect(stdout).toMatch(
    /Delegating Angular scaffolding to @nx\/angular:application at products\/host/,
  );
  expect(stdout).toMatch(
    /Detected existing Angular version ~20\.3\.0 in package\.json; ignoring --framework-version=~21\.2\.0/,
  );
  expect(stdout).toMatch(/Added Atlas dependencies to package\.json/);
  expect(await readFile(join(root, 'formatted.txt'), 'utf8')).toBe(
    'products/host\n',
  );
  expect(stdout).toMatch(/Formatted generated files in products\/host/);
});

test('atlas preserves Nx React project scaffolding around host startup files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-nx-react-host-generator-'));
  const bin = join(root, 'bin');
  await mkdir(bin);
  await writeFile(join(root, 'nx.json'), '{}\n');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'acme',
      private: true,
      packageManager: 'yarn@1.22.22',
      dependencies: { react: '^19.2.0', 'react-dom': '^19.2.0' },
      devDependencies: { '@nx/react': '22.0.0' },
    }),
  );
  await writeFile(
    join(bin, 'yarn'),
    `#!/bin/sh
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
`,
    { mode: 0o755 },
  );

  const stdout = await run(
    process.execPath,
    [
      join(process.cwd(), 'packages/cli/dist/index.js'),
      'g',
      'host',
      'apps/host',
      '--framework=react',
      '--skip-install',
    ],
    { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } },
  );

  const project = JSON.parse(
    await readFile(join(root, 'apps/host/project.json'), 'utf8'),
  );
  expect(project.marker).toBe('nx-generator');
  expect(project.targets.dev.options.command).toBe('atlas dev host');
  expect(project.targets.dev.options.forwardAllArgs).toBe(true);
  expect(project.targets.serve.executor).toBe('nx:run-commands');
  expect(project.targets.serve.options.cwd).toBe('apps/host');
  expect(project.targets.serve.options.command).toBe('vite');
  expect(project.targets.serve.continuous).toBe(true);
  expect(project.targets['build-server']).toBe(undefined);
  await expect(access(join(root, 'apps/host/server'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  const hostMain = await readFile(join(root, 'apps/host/src/main.tsx'), 'utf8');
  expect(hostMain).toMatch(/<HostAtlasProvider>/);
  expect(hostMain).not.toMatch(/startHost|createBrowserRouter|atlasConfig/);
  expect(hostMain).not.toMatch(/import\.meta\.hot/);
  await expect(
    access(join(root, 'apps/host/src/atlas-bootstrap.ts')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  const atlasProvider = await readFile(
    join(root, 'apps/host/src/HostAtlasProvider.tsx'),
    'utf8',
  );
  expect(atlasProvider).toMatch(/AtlasHostProvider/);
  expect(atlasProvider).toMatch(/createBrowserRouter/);
  expect(atlasProvider).toMatch(/Component: HostLayout/);
  expect(atlasProvider).toMatch(/hostId=\{atlasConfig\.id\}/);
  const hostLayout = await readFile(
    join(root, 'apps/host/src/app/HostLayout.tsx'),
    'utf8',
  );
  expect(hostLayout).toMatch(/data-atlas-route-outlet/);
  const hostViteConfig = await readFile(
    join(root, 'apps/host/vite.config.ts'),
    'utf8',
  );
  expect(hostViteConfig).toMatch(/createReactHostViteConfig/);
  expect(hostViteConfig).not.toMatch(/remoteEntry\.json|rollupOptions/);
  expect(hostViteConfig).toMatch(/plugins: \[react\(\)\]/);
  expect(hostViteConfig).not.toMatch(
    /babel|reactCompilerPreset|ReactBabelOptions/,
  );
  expect(hostViteConfig).toMatch(/server: \{ port: 4200, cors: true \}/);
  await expect(
    access(join(root, 'apps/host/vite.config.mts')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readFile(join(root, 'apps/host/index.html'), 'utf8')).toMatch(
    /<script type="module" src="\/src\/main\.tsx"><\/script>/,
  );
  expect(
    await readFile(join(root, 'apps/host/src/styles.css'), 'utf8'),
  ).toMatch(/data-atlas-route-outlet/);
  expect(
    await readFile(join(root, 'apps/host/eslint.config.mjs'), 'utf8'),
  ).toBe('nx eslint\n');
  expect(await readFile(join(root, 'apps/host/public/nx.txt'), 'utf8')).toBe(
    'nx react public asset\n',
  );
  await expect(
    access(join(root, 'apps/host/public/remoteEntry.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readFile(join(root, 'apps/host/src/host.tsx'), 'utf8')).toMatch(
    /AtlasHostClientEntry/,
  );
  const reactHostTsconfig = JSON.parse(
    await readFile(join(root, 'apps/host/tsconfig.json'), 'utf8'),
  );
  expect(reactHostTsconfig.marker).toBe('nx-generator');
  expect(reactHostTsconfig.include).toStrictEqual(['atlas.config.ts']);
  expect(
    await readFile(join(root, 'apps/host/atlas.config.ts'), 'utf8'),
  ).toMatch(/framework: "react"/);
  await expect(
    access(join(root, 'apps/host/package.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  const rootPackage = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  expect(rootPackage.dependencies['@atlas/runtime']).toBe(ATLAS_PACKAGE_RANGE);
  expect(rootPackage.dependencies.react).toBe('^19.2.0');
  expect(rootPackage.dependencies['react-dom']).toBe('^19.2.0');
  expect(rootPackage.devDependencies['@nx/react']).toBe('22.0.0');
  expect(stdout).toMatch(
    /Delegating React scaffolding to @nx\/react:application at apps\/host/,
  );
  expect(stdout).toMatch(/Added Atlas dependencies to package\.json/);
  expect(await readFile(join(root, 'formatted.txt'), 'utf8')).toBe(
    'apps/host\n',
  );
  expect(stdout).toMatch(/Formatted generated files in apps\/host/);
});

test('atlas adds required Angular app files after Nx scaffolding', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-nx-angular-app-generator-'));
  const bin = join(root, 'bin');
  await mkdir(bin);
  await writeFile(join(root, 'nx.json'), '{}\n');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'acme',
      private: true,
      packageManager: 'yarn@1.22.22',
      dependencies: { '@angular/core': '^20.3.0' },
      devDependencies: { '@nx/angular': '22.0.0' },
    }),
  );
  await writeFile(
    join(bin, 'yarn'),
    `#!/bin/sh
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
`,
    { mode: 0o755 },
  );

  const stdout = await run(
    process.execPath,
    [
      join(process.cwd(), 'packages/cli/dist/index.js'),
      'g',
      'app',
      'orders',
      '--framework=angular',
      '--skip-install',
    ],
    { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } },
  );

  expect(await readFile(join(root, 'orders/src/entry.ts'), 'utf8')).toMatch(
    /defineApp/,
  );
  expect(await readFile(join(root, 'orders/src/entry.ts'), 'utf8')).toMatch(
    /bootstrapApplication\(AppComponent/,
  );
  expect(await readFile(join(root, 'orders/src/entry.ts'), 'utf8')).not.toMatch(
    /@Component|router-outlet/,
  );
  await expect(
    access(join(root, 'orders/src/app.component.ts')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(
    access(join(root, 'orders/src/app/nx-only/nx-only.component.ts')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(
    await readFile(join(root, 'orders/src/app/README.md'), 'utf8'),
  ).toMatch(/Required Atlas wiring/);
  expect(
    await readFile(join(root, 'orders/src/app/app.component.ts'), 'utf8'),
  ).toMatch(/router-outlet/);
  expect(
    await readFile(join(root, 'orders/src/app/routes.ts'), 'utf8'),
  ).toMatch(/export const routes: Routes/);
  expect(
    await readFile(join(root, 'orders/src/app/home/home.component.ts'), 'utf8'),
  ).toMatch(/export class HomeComponent/);
  expect(
    await readFile(
      join(root, 'orders/src/app/details/details.component.ts'),
      'utf8',
    ),
  ).toMatch(/export class DetailsComponent/);
  expect(await readFile(join(root, 'orders/src/main.ts'), 'utf8')).toMatch(
    /initFederation/,
  );
  expect(await readFile(join(root, 'orders/src/main.ts'), 'utf8')).not.toMatch(
    /bootstrapApplication|AppComponent|createAtlasSdk|provideAtlasSdk/,
  );
  expect(await readFile(join(root, 'orders/src/index.html'), 'utf8')).toMatch(
    /Atlas app assets/,
  );
  const federationConfig = await readFile(
    join(root, 'orders/federation.config.js'),
    'utf8',
  );
  expect(federationConfig).toMatch(/@atlas\/sdk\/federation-config/);
  expect(federationConfig).toMatch(/expose: "app"/);
  expect(
    await readFile(join(root, 'orders/src/exported-widgets/README.md'), 'utf8'),
  ).toMatch(/atlas g widget <name>.*--app-id=<app-id>/);
  expect(
    await readFile(join(root, 'orders/src/exported-widgets/README.md'), 'utf8'),
  ).toMatch(/sdk\.getWidget\(widgetId\)/);
  expect(await readFile(join(root, 'orders/public/nx.txt'), 'utf8')).toBe(
    'nx angular public asset\n',
  );
  expect(await readFile(join(root, 'orders/eslint.config.mjs'), 'utf8')).toBe(
    'nx eslint\n',
  );
  const project = JSON.parse(
    await readFile(join(root, 'orders/project.json'), 'utf8'),
  );
  expect(project.marker).toBe('nx-generator');
  expect(project.targets.build.executor).toBe(
    '@angular-architects/native-federation:build',
  );
  expect(project.targets.build.options.target).toBe(
    'orders:esbuild:production',
  );
  expect(project.targets.esbuild.executor).toBe('@nx/angular:application');
  expect(project.targets.esbuild.options.polyfills).toStrictEqual([
    'es-module-shims',
  ]);
  expect(project.targets.serve.executor).toBe(
    '@angular-architects/native-federation:build',
  );
  expect(project.targets.serve.options.target).toBe(
    'orders:serve-original:development',
  );
  expect(project.targets.serve.options.port).toBe(4201);
  expect(project.targets['serve-original'].executor).toBe(
    '@angular-devkit/build-angular:dev-server',
  );
  expect(
    project.targets['serve-original'].configurations.production.buildTarget,
  ).toBe('orders:esbuild:production');
  expect(
    project.targets['serve-original'].configurations.development.buildTarget,
  ).toBe('orders:esbuild:development');
  expect(project.targets.dev.options.command).toBe('atlas dev orders');
  expect(project.targets.dev.options.forwardAllArgs).toBe(true);
  expect(project.targets.orders.options.command).toBe('nx run orders:dev');
  const angularAppTsconfig = JSON.parse(
    await readFile(join(root, 'orders/tsconfig.app.json'), 'utf8'),
  );
  expect(angularAppTsconfig.marker).toBe('nx-generator');
  expect(angularAppTsconfig.include).toStrictEqual(['atlas.config.ts']);
  expect(angularAppTsconfig.compilerOptions.emitDeclarationOnly).toBe(false);
  expect(stdout).toMatch(
    /Delegating Angular scaffolding to @nx\/angular:application at orders/,
  );
  expect(await readFile(join(root, 'formatted.txt'), 'utf8')).toBe('orders\n');
  expect(stdout).toMatch(/Formatted generated files in orders/);
});

test('atlas fails clearly when Nx Angular scaffolding reports stale project paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-nx-angular-stale-root-'));
  const bin = join(root, 'bin');
  await mkdir(bin);
  await writeFile(join(root, 'nx.json'), '{}\n');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'acme',
      private: true,
      packageManager: 'yarn@1.22.22',
      dependencies: { '@angular/core': '^20.3.0' },
      devDependencies: { '@nx/angular': '22.0.0' },
    }),
  );
  await writeFile(
    join(bin, 'yarn'),
    `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src"
  printf 'nx angular source\n' > "$directory/src/main.ts"
  printf '{"name":"orders","root":"login","sourceRoot":"login/src","targets":{"esbuild":{"options":{"browser":"login/src/main.ts","tsConfig":"login/tsconfig.app.json","styles":["login/src/styles.less"]}}}}\n' > "$directory/project.json"
  printf '{"extends":"./tsconfig.json"}\n' > "$directory/tsconfig.app.json"
  exit 0
fi
exit 1
`,
    { mode: 0o755 },
  );

  await expect(
    run(
      process.execPath,
      [
        join(process.cwd(), 'packages/cli/dist/index.js'),
        'g',
        'app',
        'orders',
        '--framework=angular',
        '--skip-install',
      ],
      {
        cwd: root,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      },
    ),
  ).rejects.toThrow(
    /Nx project root mismatch.*project\.json points at "login".*generated the project at "orders".*login\/tsconfig\.app\.json.*Update project\.json root\/sourceRoot\/build options/,
  );
});

test('atlas adds required React app files after Nx scaffolding', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-nx-react-app-generator-'));
  const bin = join(root, 'bin');
  await mkdir(bin);
  await writeFile(join(root, 'nx.json'), '{}\n');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'acme',
      private: true,
      packageManager: 'yarn@1.22.22',
      dependencies: { react: '^19.2.0', 'react-dom': '^19.2.0' },
      devDependencies: {
        '@nx/react': '22.0.0',
        '@vitejs/plugin-react': '^6.0.3',
        vite: '^8.1.5',
      },
    }),
  );
  await writeFile(
    join(bin, 'yarn'),
    `#!/bin/sh
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
`,
    { mode: 0o755 },
  );

  const stdout = await run(
    process.execPath,
    [
      join(process.cwd(), 'packages/cli/dist/index.js'),
      'g',
      'app',
      'orders',
      '--framework=react',
      '--skip-install',
    ],
    { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } },
  );

  const reactEntry = await readFile(join(root, 'orders/src/entry.tsx'), 'utf8');
  expect(reactEntry).toMatch(/createRoutedApp/);
  expect(reactEntry).toMatch(/import \{ routes \} from "\.\/app\/routes"/);
  expect(reactEntry).not.toMatch(/await import|import\.meta\.hot/);
  expect(reactEntry).not.toMatch(/useAtlasSdk|<Outlet|<Link|function Layout/);
  expect(
    (await readdir(join(root, 'orders/src/app'))).includes('app.tsx'),
  ).toBe(false);
  await expect(
    access(join(root, 'orders/src/app/nx-only/nx-only.tsx')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(
    await readFile(join(root, 'orders/src/app/README.md'), 'utf8'),
  ).toMatch(/Main app component/);
  expect(
    await readFile(join(root, 'orders/src/app/routes.tsx'), 'utf8'),
  ).toMatch(/export const routes: RouteObject\[\]/);
  expect(
    await readFile(join(root, 'orders/src/app/App.tsx'), 'utf8'),
  ).not.toMatch(/useAtlasSdk/);
  expect(
    await readFile(join(root, 'orders/src/app/home/Home.tsx'), 'utf8'),
  ).toMatch(/export function Home/);
  expect(
    await readFile(join(root, 'orders/src/app/details/Details.tsx'), 'utf8'),
  ).toMatch(/export function Details/);
  expect(await readFile(join(root, 'orders/src/main.tsx'), 'utf8')).toBe(
    'nx react source\n',
  );
  const reactViteConfig = await readFile(
    join(root, 'orders/vite.config.ts'),
    'utf8',
  );
  expect(reactViteConfig).toMatch(/createReactAppViteConfig/);
  expect(reactViteConfig).not.toMatch(
    /remoteEntry\.json|atlasReactRefreshPreamble|rollupOptions/,
  );
  expect(reactViteConfig).toMatch(/plugins: \[react\(\)\]/);
  expect(reactViteConfig).not.toMatch(
    /babel|reactCompilerPreset|ReactBabelOptions/,
  );
  const packageJson = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  expect(packageJson.devDependencies['@vitejs/plugin-react']).toBe('^6.0.3');
  expect(packageJson.devDependencies.vite).toBe('^8.1.5');
  await expect(
    access(join(root, 'orders/vite.config.mts')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readFile(join(root, 'orders/index.html'), 'utf8')).toMatch(
    /Orders assets/,
  );
  expect(
    await readFile(join(root, 'orders/src/exported-widgets/README.md'), 'utf8'),
  ).toMatch(/atlas g widget <name>.*--app-id=<app-id>/);
  expect(
    await readFile(join(root, 'orders/src/exported-widgets/README.md'), 'utf8'),
  ).toMatch(/sdk\.getWidget\(widgetId\)/);
  expect(await readFile(join(root, 'orders/public/nx.txt'), 'utf8')).toBe(
    'nx react public asset\n',
  );
  expect(await readFile(join(root, 'orders/eslint.config.mjs'), 'utf8')).toBe(
    'nx eslint\n',
  );
  expect(
    JSON.parse(await readFile(join(root, 'orders/project.json'), 'utf8'))
      .marker,
  ).toBe('nx-generator');
  const reactAppTsconfig = JSON.parse(
    await readFile(join(root, 'orders/tsconfig.app.json'), 'utf8'),
  );
  expect(reactAppTsconfig.marker).toBe('nx-generator');
  expect(reactAppTsconfig.include).toStrictEqual(['atlas.config.ts']);
  expect(reactAppTsconfig.compilerOptions.module).toBe('ESNext');
  expect(reactAppTsconfig.compilerOptions.moduleResolution).toBe('bundler');
  expect(reactAppTsconfig.compilerOptions.types).toStrictEqual(['vite/client']);
  expect(stdout).toMatch(
    /Delegating React scaffolding to @nx\/react:application at orders/,
  );
  expect(await readFile(join(root, 'formatted.txt'), 'utf8')).toBe('orders\n');
  expect(stdout).toMatch(/Formatted generated files in orders/);
});

test('atlas aligns React dependencies to an Nx project package framework version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-nx-package-generator-'));
  const bin = join(root, 'bin');
  await mkdir(bin);
  await writeFile(join(root, 'nx.json'), '{}\n');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'acme',
      private: true,
      packageManager: 'yarn@1.22.22',
      devDependencies: { '@nx/react': '22.0.0' },
    }),
  );
  await writeFile(
    join(bin, 'yarn'),
    `#!/bin/sh
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
`,
    { mode: 0o755 },
  );

  const stdout = await run(
    process.execPath,
    [
      join(process.cwd(), 'packages/cli/dist/index.js'),
      'g',
      'app',
      'packages/orders',
      '--framework=react',
      '--framework-version=^19.2.0',
      '--skip-install',
    ],
    { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } },
  );

  const rootPackage = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  const projectPackage = JSON.parse(
    await readFile(join(root, 'packages/orders/package.json'), 'utf8'),
  );
  expect(rootPackage.dependencies?.['@atlas/sdk']).toBe(undefined);
  expect(projectPackage.dependencies.react).toBe('^17.0.2');
  expect(projectPackage.dependencies['@atlas/schema']).toBe(
    ATLAS_PACKAGE_RANGE,
  );
  expect(projectPackage.dependencies['@atlas/sdk']).toBe(ATLAS_PACKAGE_RANGE);
  expect(
    projectPackage.dependencies['@softarc/native-federation-runtime'],
  ).toBe(undefined);
  expect(projectPackage.dependencies['react-dom']).toBe('^17.0.2');
  expect(projectPackage.dependencies['react-router-dom']).toBe('^6.30.1');
  expect(projectPackage.devDependencies['@rolldown/plugin-babel']).toBe(
    undefined,
  );
  expect(projectPackage.devDependencies['@vitejs/plugin-react']).toBe('^5.0.4');
  expect(projectPackage.devDependencies.vite).toBe('^7.3.6');
  expect(stdout).toMatch(
    /Detected existing React version \^17\.0\.2 in packages\/orders\/package\.json; ignoring --framework-version=\^19\.2\.0/,
  );
  expect(stdout).toMatch(
    /Added Atlas dependencies to packages\/orders\/package\.json/,
  );
});
