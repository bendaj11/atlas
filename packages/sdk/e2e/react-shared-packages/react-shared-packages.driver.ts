import { faker } from '@faker-js/faker';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, type Plugin } from 'vite';

const { createReactAppViteConfig, createReactHostViteConfig } = createRequire(
  import.meta.url,
)(
  '../../federation-config.cjs',
) as typeof import('../../federation-config.cjs');

interface PackageFixture {
  readonly manifest?: Readonly<Record<string, unknown>>;
  readonly files: Readonly<Record<string, string>>;
  readonly expected: Readonly<Record<string, unknown>>;
  readonly subpath?: string;
  readonly linked?: true;
  readonly transformedSource?: string;
}

const named = 'export const named = "named value";';
const commonjs = 'exports.named = "named value";';
const namedExports = { named: 'named value' };
const fixtures = {
  'ESM without a package type': {
    files: { 'index.js': named },
    expected: namedExports,
  },
  'declared ESM': {
    manifest: { type: 'module' },
    files: { 'index.js': named },
    expected: namedExports,
  },
  'an mjs entry': {
    manifest: { main: './index.mjs' },
    files: { 'index.mjs': named },
    expected: namedExports,
  },
  'named star reexports': {
    files: { 'index.js': 'export * from "./values.js";', 'values.js': named },
    expected: namedExports,
  },
  'a renamed default reexport': {
    files: {
      'index.js': 'export { default as named } from "./values.js";',
      'values.js': 'export default "named value";',
    },
    expected: namedExports,
  },
  'a real default export': {
    files: { 'index.js': 'export default "default value";' },
    expected: { default: 'default value' },
  },
  'a value reexported as default': {
    files: {
      'index.js': 'export { named as default } from "./values.js";',
      'values.js': named,
    },
    expected: { default: 'named value' },
  },
  'a namespace reexported as default': {
    files: {
      'index.js': 'export * as default from "./values.js";',
      'values.js': named,
    },
    expected: { default: namedExports },
  },
  'a type-only default export': {
    manifest: { main: './index.ts' },
    files: {
      'index.ts': `${named}\nexport type { Value as default } from "./types";`,
      'types.ts': 'export interface Value { value: string }',
    },
    expected: namedExports,
  },
  CommonJS: {
    files: { 'index.js': commonjs },
    expected: { ...namedExports, default: namedExports },
  },
  'a cjs entry': {
    manifest: { main: './index.cjs' },
    files: { 'index.cjs': commonjs },
    expected: { ...namedExports, default: namedExports },
  },
  'CommonJS reexports': {
    files: {
      'index.js': 'module.exports = require("./values.cjs");',
      'values.cjs': commonjs,
    },
    expected: { ...namedExports, default: namedExports },
  },
  'an import-only export map': {
    manifest: { exports: { '.': { import: './index.js' } } },
    files: { 'index.js': named },
    expected: namedExports,
  },
  'an import-only wildcard subpath': {
    manifest: { exports: { './features/*': { import: './*.js' } } },
    subpath: '/features/button',
    files: { 'button.js': named },
    expected: namedExports,
  },
  'different require and import entries': {
    manifest: {
      exports: { '.': { import: './browser.js', require: './index.cjs' } },
    },
    files: {
      'browser.js': named,
      'index.cjs': 'module.exports = "wrong require entry";',
    },
    expected: namedExports,
  },
  'a browser export condition': {
    manifest: {
      exports: { '.': { browser: './browser.js', default: './index.cjs' } },
    },
    files: {
      'browser.js': named,
      'index.cjs': 'module.exports = "wrong server entry";',
    },
    expected: namedExports,
  },
  'a module field beside CommonJS main': {
    manifest: { module: './browser.js' },
    files: {
      'browser.js': named,
      'index.js': 'module.exports = "wrong main entry";',
    },
    expected: namedExports,
  },
  'linked ESM without a package type': {
    linked: true,
    files: { 'index.js': named },
    expected: namedExports,
  },
  'linked CommonJS': {
    linked: true,
    files: { 'index.js': commonjs },
    expected: { ...namedExports, default: namedExports },
  },
  'a plugin adding a default': {
    files: { 'index.js': named },
    transformedSource: `${named}\nexport default "added default";`,
    expected: { ...namedExports, default: 'added default' },
  },
  'a plugin removing a default': {
    files: { 'index.js': 'export default "removed default";' },
    transformedSource: named,
    expected: namedExports,
  },
} satisfies Record<string, PackageFixture>;

export type PackageFormat = keyof typeof fixtures;

export class ReactSharedPackagesDriver {
  private fixture: PackageFixture = fixtures['ESM without a package type'];
  private workspace?: string;
  private exports?: Record<string, unknown>;
  private metadata?: {
    shared: Array<{
      packageName: string;
      singleton: boolean;
      outFileName: string;
    }>;
  };
  private readonly packageName = `@fixture/${faker.string.alpha(10).toLowerCase()}`;
  private factory:
    typeof createReactAppViteConfig | typeof createReactHostViteConfig =
    createReactAppViteConfig;

  readonly given = {
    packageFormat: (format: PackageFormat): this => {
      this.fixture = fixtures[format];
      return this;
    },
    consumer: (consumer: 'app' | 'host'): this => {
      this.factory =
        consumer === 'app'
          ? createReactAppViteConfig
          : createReactHostViteConfig;
      return this;
    },
  };

  readonly when = {
    build: async (): Promise<void> => {
      this.workspace = await realpath(
        await mkdtemp(join(tmpdir(), 'atlas-shared-packages-')),
      );
      const projectRoot = join(this.workspace, 'app');
      const installedPackage = join(
        projectRoot,
        'node_modules',
        this.packageName,
      );
      const packageRoot = this.fixture.linked
        ? join(this.workspace, 'packages', 'api')
        : installedPackage;
      await mkdir(join(projectRoot, 'src'), { recursive: true });
      await mkdir(packageRoot, { recursive: true });
      if (this.fixture.linked) {
        await mkdir(dirname(installedPackage), { recursive: true });
        await symlink(packageRoot, installedPackage, 'junction');
      }
      await writeFile(
        join(projectRoot, 'package.json'),
        JSON.stringify({
          name: faker.string.alpha(10).toLowerCase(),
          type: 'module',
          dependencies: { [this.packageName]: '1.0.0' },
        }),
      );
      await writeFile(
        join(packageRoot, 'package.json'),
        JSON.stringify({
          name: this.packageName,
          version: '1.0.0',
          main: './index.js',
          ...this.fixture.manifest,
        }),
      );
      for (const [path, source] of Object.entries(this.fixture.files)) {
        await writeFile(join(packageRoot, path), source);
      }
      const specifier = this.packageName + (this.fixture.subpath ?? '');
      await writeFile(
        join(projectRoot, 'src/bootstrap.tsx'),
        `import * as api from ${JSON.stringify(specifier)}; export default api;`,
      );
      const config = this.factory({
        projectRoot,
        projectName: 'shared-package-consumer',
      });
      const transformedSource = this.fixture.transformedSource;
      const transform: Plugin = {
        name: 'fixture-package-transform',
        transform(code, id) {
          return id === join(packageRoot, 'index.js').replaceAll('\\', '/') &&
            transformedSource
            ? transformedSource
            : code;
        },
      };
      await build({
        ...config,
        root: projectRoot,
        configFile: false,
        logLevel: 'silent',
        plugins: [...config.plugins, transform],
      });
      this.metadata = JSON.parse(
        await readFile(join(projectRoot, 'dist/remoteEntry.json'), 'utf8'),
      );
      const shared = this.metadata?.shared.find(
        ({ packageName }) => packageName === specifier,
      );
      if (!shared)
        throw new Error('Built package is missing from shared metadata.');
      this.exports = (await import(
        pathToFileURL(join(projectRoot, 'dist', shared.outFileName)).href
      )) as Record<string, unknown>;
    },
    cleanup: async (): Promise<void> => {
      if (this.workspace)
        await rm(this.workspace, { recursive: true, force: true });
    },
  };

  readonly get = {
    exports: () => runtimeValues(this.exports),
    expectedExports: () => this.fixture.expected,
    sharedSingleton: () => this.metadata?.shared[0]?.singleton,
  };
}

function runtimeValues(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, runtimeValues(child)]),
  );
}
