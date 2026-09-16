import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { jest } from '@jest/globals';
import { build as buildVite, type Plugin, type UserConfig } from 'vite';
import type {
  AngularProjectExpose,
  SkipEntry,
} from '../../federation-config.cjs';

type FederationConfigModule = typeof import('../../federation-config.cjs');
type ExampleProject =
  | 'hosts/demo-angular-host'
  | 'apps/orders-angular'
  | 'apps/catalog-react'
  | 'hosts/demo-react-host';

interface FederationMetadata {
  readonly name: string;
  readonly exposes: ReadonlyArray<{ key: string; outFileName: string }>;
  readonly shared: ReadonlyArray<{
    packageName: string;
    outFileName: string;
    requiredVersion: string;
    singleton: boolean;
    strictVersion: boolean;
    version: string;
  }>;
}

interface AngularConfigResult {
  readonly exposes: Record<string, string>;
  readonly skip: string[];
  readonly shared: Record<string, Record<string, unknown>>;
}

interface WidgetEntry {
  readonly name: string;
  readonly entryPoint: string;
}

interface FixturePackage {
  readonly packageName: string;
  readonly version: string;
  readonly exports: readonly string[];
}

type Middleware = (
  request: unknown,
  response: {
    setHeader(name: string, value: string): void;
    end(body: string): void;
  },
) => void;

const executeFile = promisify(execFile);
const factoryPath = fileURLToPath(
  new URL('../../federation-config.cjs', import.meta.url),
);
const workspaceRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const { createReactAppViteConfig, createReactHostViteConfig } = createRequire(
  import.meta.url,
)(factoryPath) as FederationConfigModule;

export class FederationConfigDriver {
  private readonly send = jest.fn<(event: unknown) => void>();
  private projectRoot = '';
  private projectName = 'automatic-sharing';
  private reactMajor = 19;
  private skip: readonly SkipEntry[] = [];
  private config: UserConfig | undefined;
  private angularConfig: AngularConfigResult | undefined;
  private widgetEntries: WidgetEntry[] = [];
  private hotUpdateResult: unknown;

  readonly given = {
    exampleProject: (project: ExampleProject): this => {
      this.projectRoot = resolve(workspaceRoot, 'examples', project);
      this.projectName = project.split('/')[1] ?? project;

      return this;
    },
    reactFixtureProject: async (): Promise<this> => {
      this.projectRoot = await createReactFederationFixture();

      return this;
    },
    emptyReactProject: async (): Promise<this> => {
      this.projectRoot = await mkdtemp(join(tmpdir(), 'atlas-react-vite-app-'));
      await mkdir(join(this.projectRoot, 'src/exported-widgets/summary'), {
        recursive: true,
      });
      await writeFile(
        join(this.projectRoot, 'src/bootstrap.tsx'),
        'export default {};\n',
      );

      return this;
    },
    entrySource: async (source: string): Promise<this> => {
      await writeFile(join(this.projectRoot, 'src/entry.tsx'), source);

      return this;
    },
    reactMajor: (reactMajor: number): this => {
      this.reactMajor = reactMajor;

      return this;
    },
    skip: (skip: readonly SkipEntry[]): this => {
      this.skip = skip;

      return this;
    },
  };

  readonly when = {
    angularConfigCreated: async (
      expose: AngularProjectExpose,
    ): Promise<void> => {
      const script = [
        `const { createAngularFederationConfig } = require(${JSON.stringify(factoryPath)});`,
        `const config = createAngularFederationConfig(${JSON.stringify({ projectRoot: this.projectRoot, name: 'test', expose })});`,
        'process.stdout.write(JSON.stringify({ exposes: config.exposes, skip: [...config.skip.strings], shared: config.shared }));',
      ].join('\n');
      const { stdout } = await executeFile(process.execPath, ['-e', script], {
        cwd: workspaceRoot,
      });
      this.angularConfig = JSON.parse(stdout) as AngularConfigResult;
    },
    reactWidgetEntriesCreated: async (): Promise<void> => {
      const options = {
        projectRoot: this.projectRoot,
        reactMajor: this.reactMajor,
      };
      const script = [
        `const { createReactWidgetEntries } = require(${JSON.stringify(factoryPath)});`,
        `process.stdout.write(JSON.stringify(createReactWidgetEntries(${JSON.stringify(options)})));`,
      ].join('\n');
      const { stdout } = await executeFile(process.execPath, ['-e', script], {
        cwd: workspaceRoot,
      });
      this.widgetEntries = JSON.parse(stdout) as WidgetEntry[];
    },
    reactAppConfigCreated: (): void => {
      this.config = createReactAppViteConfig({
        projectRoot: this.projectRoot,
        projectName: this.projectName,
        reactMajor: this.reactMajor,
        skip: this.skip,
      });
    },
    reactHostConfigCreated: (): void => {
      this.config = createReactHostViteConfig({
        projectRoot: this.projectRoot,
        projectName: this.projectName,
      });
    },
    hotUpdateHandled: (file: string): void => {
      const plugin = this.plugin('atlas-react-source-reload');
      const handleHotUpdate = plugin.handleHotUpdate as (
        context: unknown,
      ) => unknown;
      this.hotUpdateResult = handleHotUpdate({
        file: join(this.projectRoot, file),
        server: { ws: { send: this.send } },
      });
    },
    productionBuilt: async (): Promise<void> => {
      await buildVite({
        ...this.config,
        configFile: false,
        root: this.projectRoot,
        logLevel: 'silent',
        resolve: { alias: { '@app': join(this.projectRoot, 'src') } },
      });
    },
  };

  readonly get = {
    angularExposes: (): Record<string, string> =>
      this.angularConfig?.exposes ?? {},
    angularSkip: (): string[] => this.angularConfig?.skip ?? [],
    angularShared: (packageName: string): Record<string, unknown> | undefined =>
      this.angularConfig?.shared[packageName],
    widgetEntrySource: (name: string): Promise<string> => {
      const entry = this.widgetEntries.find(
        (candidate) => candidate.name === name,
      );
      if (!entry) throw new Error(`Widget entry "${name}" was not generated.`);

      return readFile(resolve(this.projectRoot, entry.entryPoint), 'utf8');
    },
    pluginNames: (): string[] =>
      (this.config?.plugins as Plugin[]).map(({ name }) => name),
    rollupInputNames: (): string[] =>
      Object.keys(
        this.config?.build?.rollupOptions?.input as Record<string, string>,
      ),
    external: (source: string): boolean =>
      (
        this.config?.build?.rollupOptions?.external as (
          source: string,
        ) => boolean
      )(source),
    servedMetadata: (pluginName: string): FederationMetadata =>
      this.servedMetadata(pluginName),
    sharedPackageNames: (): string[] =>
      this.servedMetadata('atlas-native-federation-metadata').shared.map(
        ({ packageName }) => packageName,
      ),
    sendMock: (): jest.Mock<(event: unknown) => void> => this.send,
    hotUpdateResult: (): unknown => this.hotUpdateResult,
    projectFile: (path: string): Promise<string> =>
      readFile(join(this.projectRoot, path), 'utf8'),
    workspaceFile: (path: string): Promise<string> =>
      readFile(resolve(workspaceRoot, path), 'utf8'),
    distModule: (path: string): Promise<Record<string, unknown>> =>
      import(pathToFileURL(join(this.projectRoot, 'dist', path)).href),
    missingWorkspaceFiles: async (
      paths: readonly string[],
    ): Promise<string[]> => {
      const checks = await Promise.all(
        paths.map((path) =>
          access(resolve(workspaceRoot, path)).then(
            () => undefined,
            () => path,
          ),
        ),
      );

      return checks.filter((path): path is string => path !== undefined);
    },
    missingDistFiles: async (paths: readonly string[]): Promise<string[]> => {
      const checks = await Promise.all(
        paths.map((path) =>
          access(join(this.projectRoot, 'dist', path)).then(
            () => undefined,
            () => path,
          ),
        ),
      );

      return checks.filter((path): path is string => path !== undefined);
    },
  };

  private plugin(name: string): Plugin {
    const plugin = (this.config?.plugins as Plugin[]).find(
      (entry) => entry.name === name,
    );
    if (!plugin) throw new Error(`Vite plugin "${name}" was not configured.`);

    return plugin;
  }

  private servedMetadata(pluginName: string): FederationMetadata {
    const plugin = this.plugin(pluginName);
    let middleware: Middleware | undefined;
    (plugin.configureServer as (server: unknown) => void)({
      middlewares: {
        use: (_path: string, handler: Middleware) => {
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
    peerDependencies: { 'peer-lib': '^5.0.0' },
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
  const packages: FixturePackage[] = [
    {
      packageName: 'react',
      version: '19.2.0',
      exports: ['.', './jsx-runtime', './jsx-dev-runtime'],
    },
    { packageName: 'react-dom', version: '19.2.0', exports: ['.', './client'] },
    {
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
    },
    {
      packageName: '@company/design-system',
      version: '4.2.3',
      exports: ['./button', './theme'],
    },
    { packageName: 'lazy-lib', version: '2.1.0', exports: ['./modal'] },
    { packageName: 'peer-lib', version: '5.1.0', exports: ['.'] },
    { packageName: 'side-effects', version: '3.0.1', exports: ['.'] },
    { packageName: 'types-only', version: '1.0.0', exports: ['.'] },
    { packageName: 'unused-lib', version: '1.0.0', exports: ['.'] },
    { packageName: 'comment-only', version: '1.0.0', exports: ['.'] },
  ];
  for (const fixture of packages)
    await createFixturePackage(projectRoot, fixture);
  await createCommonJsFixturePackage(projectRoot);
  await createStyleFixturePackage(projectRoot);

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

async function createFixturePackage(
  projectRoot: string,
  fixture: FixturePackage,
): Promise<void> {
  const packageRoot = join(projectRoot, 'node_modules', fixture.packageName);
  await mkdir(packageRoot, { recursive: true });
  const packageExports = Object.fromEntries(
    fixture.exports.map((specifier) => [
      specifier,
      `./${specifier === '.' ? 'index.js' : `${specifier.slice(2).replaceAll('/', '-')}.js`}`,
    ]),
  );
  await writeJson(join(packageRoot, 'package.json'), {
    name: fixture.packageName,
    version: fixture.version,
    type: 'module',
    exports: packageExports,
  });
  await Promise.all(
    Object.values(packageExports).map((fileName) =>
      writeFile(
        join(packageRoot, fileName.slice(2)),
        [
          `export const value = ${JSON.stringify(`${fixture.packageName}:${fileName}`)};`,
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
