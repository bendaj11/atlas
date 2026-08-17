import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { build as buildVite } from 'vite';
import {
  createReactAppViteConfig,
  createReactHostViteConfig,
} from '../federation-config.cjs';
import { expect, jest, test } from '@jest/globals';

const executeFile = promisify(execFile);
const factoryPath = fileURLToPath(
  new URL('../federation-config.cjs', import.meta.url),
);
const workspaceRoot = fileURLToPath(new URL('../../..', import.meta.url));

interface AtlasVitePlugin {
  readonly name: string;
  readonly transform?: (code: string, id: string) => string | undefined;
  readonly handleHotUpdate?: (context: {
    file: string;
    server: { ws: { send: (event: unknown) => void } };
  }) => unknown;
  readonly configureServer?: (server: {
    middlewares: { use: (path: string, handler: Middleware) => void };
  }) => void;
  readonly writeBundle?: () => void;
}

type Middleware = (
  request: unknown,
  response: {
    setHeader(name: string, value: string): void;
    end(body: string): void;
  },
) => void;

test('Angular host federation exposes workspace-relative source', async () => {
  const projectRoot = fileURLToPath(
    new URL('../../../examples/hosts/demo-angular-host', import.meta.url),
  );
  const exposes = await federationExposes(projectRoot, 'host');

  expect(exposes).toStrictEqual({
    './host': './examples/hosts/demo-angular-host/src/bootstrap.ts',
  });
  await expectSourcesToResolve(exposes);
});

test('Angular app federation exposes workspace-relative entry and widgets', async () => {
  const projectRoot = fileURLToPath(
    new URL('../../../examples/apps/orders-angular', import.meta.url),
  );
  const exposes = await federationExposes(projectRoot, 'app');

  expect(exposes).toStrictEqual({
    './entry': './examples/apps/orders-angular/src/entry.ts',
    './widgets/order-status':
      './examples/apps/orders-angular/.atlas/widgets/order-status.ts',
  });
  await expectSourcesToResolve(exposes);
  const widgetEntry = await readFile(
    resolve(workspaceRoot, exposes['./widgets/order-status']),
    'utf8',
  );
  expect(widgetEntry).toMatch(/createExportedWidget\(Widget, widgetConfig\)/);
  expect(widgetEntry).toMatch(/widget\.config/);
  expect(widgetEntry).toMatch(/src\/exported-widgets\/order-status\/index/);
});

test('Angular federation skips React-only Atlas adapters', async () => {
  const projectRoot = fileURLToPath(
    new URL('../../../examples/hosts/demo-angular-host', import.meta.url),
  );
  const skippedAtlasPackages = (
    await angularFederationSkipEntries(projectRoot)
  ).filter((packageName) => packageName.startsWith('@atlas/'));

  expect(skippedAtlasPackages).toStrictEqual([
    '@atlas/runtime/react',
    '@atlas/sdk/react',
  ]);
});

test('Angular federation keeps discovered secondary entry points', async () => {
  const projectRoot = fileURLToPath(
    new URL('../../../examples/apps/orders-angular', import.meta.url),
  );
  const sharedEntry = await angularFederationSharedEntry(
    projectRoot,
    '@angular/core/rxjs-interop',
  );

  expect(sharedEntry).toMatchObject({
    includeSecondaries: true,
    singleton: true,
    strictVersion: true,
  });
  await expect(
    angularFederationSharedEntry(projectRoot, '@atlas/sdk/angular'),
  ).resolves.not.toHaveProperty('includeSecondaries');
});

test('React federation generates ignored widget lifecycle entries', async () => {
  const projectRoot = fileURLToPath(
    new URL('../../../examples/apps/catalog-react', import.meta.url),
  );
  const script = [
    `const { createReactWidgetEntries } = require(${JSON.stringify(factoryPath)});`,
    `process.stdout.write(JSON.stringify(createReactWidgetEntries(${JSON.stringify({ projectRoot, reactMajor: 19 })})));`,
  ].join('\n');
  const { stdout } = await executeFile(process.execPath, ['-e', script], {
    cwd: workspaceRoot,
  });
  const entries = JSON.parse(stdout) as Array<{
    name: string;
    entryPoint: string;
  }>;
  const productCount = entries.find((entry) => entry.name === 'product-count');

  expect(productCount).toBeDefined();
  const source = await readFile(
    resolve(projectRoot, productCount!.entryPoint),
    'utf8',
  );
  expect(source).toMatch(/defineExportedWidget/);
  expect(source).toMatch(/src\/exported-widgets\/product-count\/index/);
});

test('React 17 federation uses legacy root lifecycle internally', async () => {
  const projectRoot = fileURLToPath(
    new URL('../../../examples/apps/catalog-react', import.meta.url),
  );
  const script = [
    `const { createReactWidgetEntries } = require(${JSON.stringify(factoryPath)});`,
    `process.stdout.write(JSON.stringify(createReactWidgetEntries(${JSON.stringify({ projectRoot, reactMajor: 17 })})));`,
  ].join('\n');
  const { stdout } = await executeFile(process.execPath, ['-e', script], {
    cwd: workspaceRoot,
  });
  const [entry] = JSON.parse(stdout) as Array<{ entryPoint: string }>;
  const source = await readFile(resolve(projectRoot, entry.entryPoint), 'utf8');

  expect(source).toMatch(/unmountComponentAtNode/);
  expect(source).not.toMatch(/react-dom\/client/);
});

test('React app Vite factory owns federation build and development behavior', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'atlas-react-vite-app-'));
  await mkdir(join(projectRoot, 'src/exported-widgets/summary'), {
    recursive: true,
  });
  const config = createReactAppViteConfig({
    projectRoot,
    projectName: 'order-history',
    reactMajor: 19,
  });
  const plugins = config.plugins as AtlasVitePlugin[];

  expect(plugins.map(({ name }) => name)).toStrictEqual([
    'atlas-react-shared-fallbacks',
    'atlas-react-refresh-preamble',
    'atlas-react-source-reload',
    'atlas-native-federation-metadata',
  ]);
  const refreshPlugin = plugins.find(
    ({ name }) => name === 'atlas-react-refresh-preamble',
  );
  const sourceReloadPlugin = plugins.find(
    ({ name }) => name === 'atlas-react-source-reload',
  );
  expect(
    refreshPlugin?.transform?.(
      'export default {};',
      join(projectRoot, 'src/entry.tsx'),
    ),
  ).toMatch(/plugin-react\/preamble/);

  const send = jest.fn();
  expect(
    sourceReloadPlugin?.handleHotUpdate?.({
      file: join(projectRoot, 'src/entry.tsx'),
      server: { ws: { send } },
    }),
  ).toStrictEqual([]);
  expect(send).toHaveBeenCalledWith({ type: 'full-reload', path: '*' });

  send.mockClear();
  expect(
    sourceReloadPlugin?.handleHotUpdate?.({
      file: join(projectRoot, 'src/app/OrderSummary.tsx'),
      server: { ws: { send } },
    }),
  ).toStrictEqual([]);
  expect(send).toHaveBeenCalledWith({ type: 'full-reload', path: '*' });

  send.mockClear();
  expect(
    sourceReloadPlugin?.handleHotUpdate?.({
      file: join(projectRoot, 'README.md'),
      server: { ws: { send } },
    }),
  ).toBeUndefined();
  expect(send).not.toHaveBeenCalled();

  const rollupOptions = config.build?.rollupOptions as {
    input: Record<string, string>;
  };
  expect(Object.keys(rollupOptions.input)).toStrictEqual([
    'entry',
    'widgets/summary',
  ]);
});

test('React host Vite factory serves Atlas metadata', () => {
  const projectRoot = resolve(workspaceRoot, 'examples/hosts/demo-react-host');
  const config = createReactHostViteConfig({
    projectRoot,
    projectName: 'demo-react-host',
  });
  const plugins = config.plugins as AtlasVitePlugin[];
  const refreshPlugin = plugins.find(
    ({ name }) => name === 'atlas-react-refresh-preamble',
  );
  expect(
    refreshPlugin?.transform?.(
      'export default {};',
      join(projectRoot, 'src/bootstrap.tsx'),
    ),
  ).toMatch(/plugin-react\/preamble/);
  const metadataPlugin = (config.plugins as AtlasVitePlugin[]).find(
    ({ name }) => name === 'atlas-host-metadata',
  );
  let middleware: Middleware | undefined;
  metadataPlugin?.configureServer?.({
    middlewares: {
      use(path, handler) {
        expect(path).toBe('/remoteEntry.json');
        middleware = handler;
      },
    },
  });
  let body = '';
  middleware?.(
    {},
    {
      setHeader() {},
      end(value) {
        body = value;
      },
    },
  );

  const metadata = JSON.parse(body) as {
    name: string;
    exposes: Array<{ key: string; outFileName: string }>;
    shared: Array<{
      packageName: string;
      outFileName: string;
      singleton: boolean;
      strictVersion: boolean;
    }>;
  };
  expect(metadata.name).toBe('atlas_demo_react_host');
  expect(metadata.exposes).toStrictEqual([
    { key: './host', outFileName: 'src/bootstrap.tsx' },
  ]);
  expect(metadata.shared.map(({ packageName }) => packageName)).toEqual(
    expect.arrayContaining([
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      '@atlas/sdk',
      '@atlas/sdk/react',
    ]),
  );
  expect(metadata.shared).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        packageName: 'react',
        outFileName: '@id/react',
        singleton: true,
        strictVersion: true,
      }),
    ]),
  );
});

test('React federation discovers runtime package imports recursively', async () => {
  const projectRoot = await createReactFederationFixture();
  const config = createReactAppViteConfig({
    projectRoot,
    projectName: 'automatic-sharing',
    reactMajor: 19,
  });

  expect(sharedPackageNames(config)).toStrictEqual([
    '@atlas/sdk',
    '@atlas/sdk/federation',
    '@atlas/sdk/host',
    '@atlas/sdk/lifecycle',
    '@atlas/sdk/navigation',
    '@atlas/sdk/react',
    '@company/design-system/button',
    'cjs-lib',
    'lazy-lib/modal',
    'react',
    'react-dom',
    'react-dom/client',
    'react/jsx-dev-runtime',
    'react/jsx-runtime',
  ]);
});

test('React federation ignores type-only, side-effect-only, commented, and unused dependencies', async () => {
  const projectRoot = await createReactFederationFixture();
  const config = createReactAppViteConfig({
    projectRoot,
    projectName: 'automatic-sharing',
    reactMajor: 19,
  });
  const shared = sharedPackageNames(config);

  expect(shared).not.toContain('types-only');
  expect(shared).not.toContain('unused-lib');
  expect(shared).not.toContain('comment-only');
  expect(shared).not.toContain('@company/design-system/theme');
  expect(shared).not.toContain('peer-lib');
  expect(shared).not.toContain('side-effects');
  expect(shared).not.toContain('style-lib/styles.css');
});

test('React federation externalizes every discovered exact entry point', async () => {
  const projectRoot = await createReactFederationFixture();
  const config = createReactAppViteConfig({
    projectRoot,
    projectName: 'automatic-sharing',
    reactMajor: 19,
  });
  const external = (
    config.build?.rollupOptions as {
      external: (source: string) => boolean;
    }
  ).external;

  expect(external('@company/design-system/button')).toBe(true);
  expect(external('@company/design-system')).toBe(false);
  expect(external('unused-lib')).toBe(false);
  expect(external('./feature')).toBe(false);
});

test('React development metadata maps discovered dependencies to Vite ids', async () => {
  const projectRoot = await createReactFederationFixture();
  const config = createReactAppViteConfig({
    projectRoot,
    projectName: 'automatic-sharing',
    reactMajor: 19,
  });
  const metadata = developmentMetadata(config);
  const designSystem = metadata.shared.find(
    ({ packageName }) => packageName === '@company/design-system/button',
  );

  expect(designSystem).toEqual(
    expect.objectContaining({
      outFileName: '@id/@company/design-system/button',
      requiredVersion: '^4.2.0',
      singleton: true,
      strictVersion: true,
      version: '4.2.3',
    }),
  );
});

test('React production build emits every shared fallback referenced by metadata', async () => {
  const projectRoot = await createReactFederationFixture();
  const config = createReactAppViteConfig({
    projectRoot,
    projectName: 'automatic-sharing',
    reactMajor: 19,
  });

  await buildVite({
    ...config,
    configFile: false,
    root: projectRoot,
    logLevel: 'silent',
    resolve: {
      alias: { '@app': join(projectRoot, 'src') },
    },
  });

  const metadata = JSON.parse(
    await readFile(join(projectRoot, 'dist/remoteEntry.json'), 'utf8'),
  ) as FederationMetadata;
  await Promise.all(
    metadata.shared.map(({ outFileName }) =>
      access(join(projectRoot, 'dist', outFileName)),
    ),
  );
  expect(await readFile(join(projectRoot, 'dist/entry.js'), 'utf8')).toMatch(
    /from"@company\/design-system\/button"/,
  );
  const commonJsFallback = await import(
    pathToFileURL(join(projectRoot, 'dist/shared/cjs-lib.js')).href
  );
  expect(commonJsFallback.named).toBe('named CommonJS export');
  expect(commonJsFallback.default).toEqual(
    expect.objectContaining({ named: 'named CommonJS export' }),
  );
});

test('React federation fails clearly when an imported package entry is missing', async () => {
  const projectRoot = await createReactFederationFixture();
  await writeFile(
    join(projectRoot, 'src/entry.tsx'),
    'import { missing } from "unused-lib/missing"; export default missing;\n',
  );

  expect(() =>
    createReactAppViteConfig({
      projectRoot,
      projectName: 'automatic-sharing',
      reactMajor: 19,
    }),
  ).toThrow(
    'Atlas could not resolve shared dependency entry "unused-lib/missing".',
  );
});

async function federationExposes(
  projectRoot: string,
  expose: 'host' | 'app',
): Promise<Record<string, string>> {
  const script = [
    `const { createAngularFederationConfig } = require(${JSON.stringify(factoryPath)});`,
    `const config = createAngularFederationConfig(${JSON.stringify({ projectRoot, name: 'test', expose })});`,
    'process.stdout.write(JSON.stringify(config.exposes));',
  ].join('\n');
  const { stdout } = await executeFile(process.execPath, ['-e', script], {
    cwd: workspaceRoot,
  });
  return JSON.parse(stdout) as Record<string, string>;
}

async function angularFederationSkipEntries(
  projectRoot: string,
): Promise<string[]> {
  const script = [
    `const { createAngularFederationConfig } = require(${JSON.stringify(factoryPath)});`,
    `const config = createAngularFederationConfig(${JSON.stringify({ projectRoot, name: 'test', expose: 'host' })});`,
    'process.stdout.write(JSON.stringify([...config.skip.strings]));',
  ].join('\n');
  const { stdout } = await executeFile(process.execPath, ['-e', script], {
    cwd: workspaceRoot,
  });
  return JSON.parse(stdout) as string[];
}

async function angularFederationSharedEntry(
  projectRoot: string,
  packageName: string,
): Promise<Record<string, unknown>> {
  const script = [
    `const { createAngularFederationConfig } = require(${JSON.stringify(factoryPath)});`,
    `const config = createAngularFederationConfig(${JSON.stringify({ projectRoot, name: 'test', expose: 'app' })});`,
    `process.stdout.write(JSON.stringify(config.shared[${JSON.stringify(packageName)}]));`,
  ].join('\n');
  const { stdout } = await executeFile(process.execPath, ['-e', script], {
    cwd: workspaceRoot,
  });
  return JSON.parse(stdout) as Record<string, unknown>;
}

interface FederationMetadata {
  name: string;
  exposes: Array<{ key: string; outFileName: string }>;
  shared: Array<{
    packageName: string;
    outFileName: string;
    requiredVersion: string;
    singleton: boolean;
    strictVersion: boolean;
    version: string;
  }>;
}

function sharedPackageNames(
  config: ReturnType<typeof createReactAppViteConfig>,
) {
  return developmentMetadata(config).shared.map(
    ({ packageName }) => packageName,
  );
}

function developmentMetadata(
  config: ReturnType<typeof createReactAppViteConfig>,
): FederationMetadata {
  const metadataPlugin = (config.plugins as AtlasVitePlugin[]).find(
    ({ name }) => name === 'atlas-native-federation-metadata',
  );
  let middleware: Middleware | undefined;
  metadataPlugin?.configureServer?.({
    middlewares: {
      use: (_path, handler) => {
        middleware = handler;
      },
    },
  });
  let body = '';
  middleware?.(
    {},
    {
      setHeader() {},
      end(value) {
        body = value;
      },
    },
  );
  if (!body)
    throw new Error('Federation metadata middleware was not installed.');
  return JSON.parse(body) as FederationMetadata;
}

async function createReactFederationFixture(): Promise<string> {
  const projectRoot = await mkdtemp(
    join(tmpdir(), 'atlas-react-auto-sharing-'),
  );
  await mkdir(join(projectRoot, 'src'), { recursive: true });
  await writeJson(join(projectRoot, 'package.json'), {
    name: 'automatic-sharing-fixture',
    private: true,
    type: 'module',
    dependencies: {
      '@atlas/sdk': '*',
      '@company/design-system': '^4.2.0',
      'cjs-lib': '^1.0.0',
      'comment-only': '^1.0.0',
      'lazy-lib': '^2.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'side-effects': '^3.0.0',
      'style-lib': '^1.0.0',
      'types-only': '^1.0.0',
      'unused-lib': '^1.0.0',
    },
    peerDependencies: {
      'peer-lib': '^5.0.0',
    },
  });
  await writeJson(join(projectRoot, 'tsconfig.json'), {
    compilerOptions: {
      allowJs: true,
      baseUrl: '.',
      jsx: 'react-jsx',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      paths: { '@app/*': ['src/*'] },
    },
  });
  await writeFile(
    join(projectRoot, 'src/entry.tsx'),
    [
      'import { createElement } from "react";',
      'import { createRoot } from "react-dom/client";',
      'import type { TypeOnly } from "types-only";',
      'import { Button } from "@company/design-system/button";',
      'import "@company/design-system/theme";',
      'import { named } from "cjs-lib";',
      'import "style-lib/styles.css";',
      'import { feature } from "@app/feature";',
      'import "peer-lib";',
      '// import "comment-only";',
      'const computedPackage = "unused-lib";',
      'export const computed = () => import(computedPackage);',
      'export const lazy = () => import("lazy-lib/modal");',
      'export default { Button, createElement, createRoot, feature, named };',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(projectRoot, 'src/feature.ts'),
    [
      'import "side-effects";',
      'export type { TypeOnly } from "types-only";',
      'export const feature = true;',
      '',
    ].join('\n'),
  );
  await createFixturePackage({
    projectRoot,
    packageName: 'react',
    version: '19.2.0',
    exports: ['.', './jsx-runtime', './jsx-dev-runtime'],
  });
  await createFixturePackage({
    projectRoot,
    packageName: 'react-dom',
    version: '19.2.0',
    exports: ['.', './client'],
  });
  await createFixturePackage({
    projectRoot,
    packageName: '@atlas/sdk',
    version: '0.3.21',
    exports: [
      '.',
      './federation',
      './host',
      './lifecycle',
      './navigation',
      './react',
    ],
  });
  await createFixturePackage({
    projectRoot,
    packageName: '@company/design-system',
    version: '4.2.3',
    exports: ['./button', './theme'],
  });
  await createCommonJsFixturePackage(projectRoot);
  await createFixturePackage({
    projectRoot,
    packageName: 'lazy-lib',
    version: '2.1.0',
    exports: ['./modal'],
  });
  await createFixturePackage({
    projectRoot,
    packageName: 'peer-lib',
    version: '5.1.0',
    exports: ['.'],
  });
  await createFixturePackage({
    projectRoot,
    packageName: 'side-effects',
    version: '3.0.1',
    exports: ['.'],
  });
  await createStyleFixturePackage(projectRoot);
  await createFixturePackage({
    projectRoot,
    packageName: 'types-only',
    version: '1.0.0',
    exports: ['.'],
  });
  await createFixturePackage({
    projectRoot,
    packageName: 'unused-lib',
    version: '1.0.0',
    exports: ['.'],
  });
  await createFixturePackage({
    projectRoot,
    packageName: 'comment-only',
    version: '1.0.0',
    exports: ['.'],
  });
  return projectRoot;
}

async function createStyleFixturePackage(projectRoot: string): Promise<void> {
  const packageRoot = join(projectRoot, 'node_modules/style-lib');
  await mkdir(packageRoot, { recursive: true });
  await writeJson(join(packageRoot, 'package.json'), {
    name: 'style-lib',
    version: '1.0.0',
    exports: { './styles.css': './styles.css' },
  });
  await writeFile(
    join(packageRoot, 'styles.css'),
    '.fixture { color: red; }\n',
  );
}

async function createCommonJsFixturePackage(
  projectRoot: string,
): Promise<void> {
  const packageRoot = join(projectRoot, 'node_modules/cjs-lib');
  await mkdir(packageRoot, { recursive: true });
  await writeJson(join(packageRoot, 'package.json'), {
    name: 'cjs-lib',
    version: '1.0.0',
    main: './index.js',
  });
  await writeFile(
    join(packageRoot, 'index.js'),
    'exports.named = "named CommonJS export";\n',
  );
}

interface FixturePackage {
  projectRoot: string;
  packageName: string;
  version: string;
  exports: string[];
}

async function createFixturePackage(options: FixturePackage): Promise<void> {
  const packageRoot = join(
    options.projectRoot,
    'node_modules',
    options.packageName,
  );
  await mkdir(packageRoot, { recursive: true });
  const packageExports = Object.fromEntries(
    options.exports.map((specifier) => {
      const fileName =
        specifier === '.'
          ? 'index.js'
          : `${specifier.slice(2).replaceAll('/', '-')}.js`;
      return [specifier, `./${fileName}`];
    }),
  );
  await writeJson(join(packageRoot, 'package.json'), {
    name: options.packageName,
    version: options.version,
    type: 'module',
    exports: packageExports,
  });
  await Promise.all(
    Object.values(packageExports).map((fileName) =>
      writeFile(
        join(packageRoot, fileName.slice(2)),
        [
          `export const value = ${JSON.stringify(`${options.packageName}:${fileName}`)};`,
          'export const Button = value;',
          'export const createElement = () => value;',
          'export const createRoot = () => value;',
          'export default value;',
          '',
        ].join('\n'),
      ),
    ),
  );
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function expectSourcesToResolve(
  exposes: Record<string, string>,
): Promise<void> {
  await Promise.all(
    Object.values(exposes).map((source) =>
      access(resolve(workspaceRoot, source)),
    ),
  );
}
