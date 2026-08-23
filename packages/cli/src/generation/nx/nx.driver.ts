import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import type { SupportedFramework } from '../../cli/arguments.js';
import {
  alignDelegatedAngularFederationConfig,
  alignDelegatedTsconfig,
  atlasConfigNxTarget,
  ensureDelegatedNxTargets,
  nxTarget,
} from './nx.js';

type ProjectType = 'host' | 'app';

export class NxDriver {
  private readonly name = faker.word.noun().toLowerCase();
  private readonly packageManager = faker.helpers.arrayElement([
    'npm',
    'pnpm',
    'yarn',
  ] as const);
  private readonly script = faker.word.verb();
  private readonly port = faker.number.int({ min: 4500, max: 5999 });
  private workspaceRoot = '';
  private projectRoot = '';
  private value?: unknown;

  given = {
    federationConfig: async (): Promise<void> => {
      await this.createRoots();

      await writeFile(
        join(this.projectRoot, 'federation.config.js'),
        `const { join } = require("node:path");
module.exports = {
  exposes: {
    "./entry": "./src/entry.ts",
    "./legacyEntry": "./apps/${this.name}/src/entry.ts",
    "./widget": \`./src/exported-widgets/\${entry.name}/index.ts\`,
    "./legacyWidget": \`./apps/${this.name}/src/exported-widgets/\${entry.name}/index.ts\`
  }
};
`,
      );
    },
    project: async ({
      framework,
      root,
      type,
    }: {
      framework: SupportedFramework;
      root: 'current' | 'stale';
      type: ProjectType;
    }): Promise<void> => {
      await this.createRoots();
      const relativeRoot = `apps/${this.name}`;
      const configuredRoot =
        root === 'stale' ? `legacy/${this.name}` : relativeRoot;
      const targets =
        framework === 'angular'
          ? {
              build: {
                executor: '@angular-devkit/build-angular:application',
                options: { polyfills: ['zone.js'] },
              },
              dev: {
                executor: '@angular-devkit/build-angular:dev-server',
                options: { buildTarget: `${this.name}:build:development` },
              },
            }
          : {};

      await writeFile(
        join(this.projectRoot, 'project.json'),
        JSON.stringify({
          name: this.name,
          root: configuredRoot,
          sourceRoot: `${configuredRoot}/src`,
          tags: [faker.word.noun()],
          targets,
        }),
      );

      this.value = { framework, type };
    },
    tsconfig: async (framework: SupportedFramework): Promise<void> => {
      await this.createRoots();

      await writeFile(
        join(this.projectRoot, 'tsconfig.app.json'),
        JSON.stringify({
          compilerOptions: {
            emitDeclarationOnly: true,
            types: [faker.word.noun()],
          },
          include: ['src/**/*.ts'],
        }),
      );

      this.value = framework;
    },
  };

  when = {
    alignFederation: async (): Promise<void> => {
      await alignDelegatedAngularFederationConfig(
        this.workspaceRoot,
        this.projectRoot,
      );
      const source = await readFile(
        join(this.projectRoot, 'federation.config.js'),
        'utf8',
      );

      this.value = {
        entryCount: [...source.matchAll(/join\(__dirname, "src\/entry\.ts"\)/g)]
          .length,
        hasRelativeEntry: /\.\/(?:apps\/[^/]+\/)?src\/entry\.ts/.test(source),
        hasRelativeWidget: /\.\/(?:apps\/[^/]+\/)?src\/exported-widgets/.test(
          source,
        ),
        widgetCount: [
          ...source.matchAll(
            /join\(__dirname, "src\/exported-widgets", entry\.name, "index\.ts"\)/g,
          ),
        ].length,
      };
    },
    alignTsconfig: async (): Promise<void> => {
      const framework = this.value as SupportedFramework;

      await alignDelegatedTsconfig(this.projectRoot, framework);

      const tsconfig = JSON.parse(
        await readFile(join(this.projectRoot, 'tsconfig.app.json'), 'utf8'),
      );

      this.value = {
        emitDeclarationOnly: tsconfig.compilerOptions.emitDeclarationOnly,
        hasViteClient: tsconfig.compilerOptions.types.includes('vite/client'),
        include: tsconfig.include,
        module: tsconfig.compilerOptions.module,
        moduleResolution: tsconfig.compilerOptions.moduleResolution,
      };
    },
    createConfigTarget: (): void => {
      this.value = atlasConfigNxTarget(this.packageManager, this.projectRoot);
    },
    createTarget: (): void => {
      this.value = nxTarget(this.packageManager, this.projectRoot, this.script);
    },
    ensureTargets: async ({
      frameworkVersion,
    }: {
      frameworkVersion?: string;
    } = {}): Promise<void> => {
      const { framework, type } = this.value as {
        framework: SupportedFramework;
        type: ProjectType;
      };

      await ensureDelegatedNxTargets(
        this.workspaceRoot,
        this.projectRoot,
        this.name,
        type,
        framework,
        this.packageManager,
        this.port,
        frameworkVersion,
      );

      const project = JSON.parse(
        await readFile(join(this.projectRoot, 'project.json'), 'utf8'),
      );

      this.value = this.normalize({
        buildExecutor: project.targets.build?.executor,
        devCommand: project.targets.dev?.options?.command,
        devForwardsArguments: project.targets.dev?.options?.forwardAllArgs,
        devTty: project.targets.dev?.options?.tty,
        hasBootstrap: Boolean(project.targets['atlas:bootstrap']),
        hasConfig: Boolean(project.targets['atlas:config']),
        hasDev: Boolean(project.targets.dev),
        hasPublish: Boolean(project.targets['atlas:publish']),
        hasServeOriginal: Boolean(project.targets['serve-original']),
        publishCommand: project.targets['atlas:publish']?.options?.command,
        publishDependencies: project.targets['atlas:publish']?.dependsOn,
        serveExecutor: project.targets.serve?.executor,
        tagged: project.tags.includes('atlas'),
      });
    },
  };

  get = {
    configTarget: () => ({
      executor: 'nx:run-commands',
      options: {
        command: `${this.packageManager} run atlas:config`,
        cwd: this.projectRoot,
      },
      outputs: ['{projectRoot}/.atlas'],
    }),
    target: () => ({
      executor: 'nx:run-commands',
      options: {
        command: `${this.packageManager} run ${this.script}`,
        cwd: this.projectRoot,
      },
    }),
    value: <T>(): T => this.value as T,
  };

  private async createRoots(): Promise<void> {
    this.workspaceRoot = await mkdtemp(join(tmpdir(), 'atlas-nx-'));
    this.projectRoot = join(this.workspaceRoot, 'apps', this.name);

    await mkdir(this.projectRoot, { recursive: true });
  }

  private normalize(value: unknown): unknown {
    return JSON.parse(
      JSON.stringify(value)
        .replaceAll(this.name, '{project}')
        .replaceAll(`apps/${this.name}`, 'apps/{project}'),
    );
  }
}
