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
import { build, type Plugin, type UserConfig } from 'vite';

type ReactViteConfigFactory = (options: {
  projectRoot: string;
  projectName: string;
}) => UserConfig & { plugins: Plugin[] };

const { createReactAppViteConfig, createReactHostViteConfig } = createRequire(
  import.meta.url,
)('../../federation-config.cjs') as {
  createReactAppViteConfig: ReactViteConfigFactory;
  createReactHostViteConfig: ReactViteConfigFactory;
};

import {
  PACKAGE_FIXTURES,
  type PackageFixture,
  type PackageFormat,
} from './react-shared-packages.testkit.js';

export class ReactSharedPackagesDriver {
  private fixture: PackageFixture =
    PACKAGE_FIXTURES['ESM without a package type'];
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
      this.fixture = PACKAGE_FIXTURES[format];

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
