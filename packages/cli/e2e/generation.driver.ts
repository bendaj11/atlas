import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { cliEntrypointPath, run } from '../src/test-utils/build.testkit.js';

type GeneratedProjectType = 'app' | 'host';
type GeneratedFramework = 'angular' | 'react';

interface AngularWorkspaceDocument {
  projects: Record<
    string,
    {
      architect: {
        build: { options: { target: string } };
        serve: { options: { target: string } };
      };
    }
  >;
}

interface PackageDocument {
  name: string;
  scripts: Record<string, string>;
}

interface NxProjectDocument {
  name: string;
  tags: string[];
  targets: Record<
    string,
    {
      dependsOn?: string[];
      executor: string;
      options: { command: string };
    }
  >;
}

export class GenerationE2eDriver {
  private readonly projectName = faker.string.alpha({
    length: 10,
    casing: 'lower',
  });
  private readonly hostId = faker.string.uuid();
  private root = '';
  private projectRoot = '';
  private output = '';

  given = {
    standaloneProject: async (
      type: GeneratedProjectType,
      framework: GeneratedFramework,
    ): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-generate-'));
      this.projectRoot = join(this.root, this.projectName);

      await this.generate(type, framework, [
        `--directory=${this.projectRoot}`,
        ...(type === 'app' ? [`--host-id=${this.hostId}`] : []),
      ]);
    },

    nxWorkspace: async (): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-generate-nx-'));
      this.projectRoot = join(this.root, this.projectName);

      await writeFile(join(this.root, 'nx.json'), '{}\n');
      await writeFile(
        join(this.root, 'package.json'),
        JSON.stringify({
          name: faker.string.alpha({ length: 8, casing: 'lower' }),
          private: true,
          packageManager: 'yarn@1.22.22',
        }),
      );

      await this.generate('app', 'react', ['--skip-workspace-generator']);
    },

    pnpmWorkspace: async (): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-generate-pnpm-'));
      this.projectRoot = join(this.root, 'packages', this.projectName);

      await writeFile(
        join(this.root, 'package.json'),
        JSON.stringify({
          name: faker.string.alpha({ length: 8, casing: 'lower' }),
          private: true,
          packageManager: 'pnpm@10.0.0',
        }),
      );
      await writeFile(
        join(this.root, 'pnpm-workspace.yaml'),
        'packages:\n  - packages/*\n',
      );

      await this.generate('app', 'angular');
    },
  };

  when = {
    inspectAngularHost: async (): Promise<Record<string, unknown>> => {
      const angular =
        await this.readJson<AngularWorkspaceDocument>('angular.json');
      const project = angular.projects[this.projectName];
      const packageJson = await this.readJson<PackageDocument>('package.json');

      return {
        bootstrapTemplate: await this.exists('atlas.bootstrap.html'),
        framework: await this.fileContains(
          'atlas.config.ts',
          'framework: "angular"',
        ),
        buildTarget: project.architect.build.options.target,
        serveTarget: project.architect.serve.options.target,
        devCommand: packageJson.scripts.dev,
      };
    },

    inspectRoutedReactApp: async (): Promise<Record<string, unknown>> => ({
      framework: await this.fileContains(
        'atlas.config.ts',
        'framework: "react"',
      ),
      host: await this.fileContains('atlas.config.ts', this.hostId),
      routedEntry: await this.fileContains(
        'src/bootstrap.tsx',
        'createRoutedApp',
      ),
      federation: await this.fileContains(
        'vite.config.ts',
        'createReactAppViteConfig',
      ),
    }),

    inspectNxRegistration: async (): Promise<Record<string, unknown>> => {
      const project = await this.readJson<NxProjectDocument>('project.json');

      return {
        name: project.name,
        tags: project.tags,
        buildExecutor: project.targets.build.executor,
        configCommand: project.targets['atlas:config'].options.command,
        detected: this.output.includes('Detected an Nx workspace'),
        publishCommand: project.targets['atlas:publish'].options.command,
        publishDependencies: project.targets['atlas:publish'].dependsOn,
      };
    },

    inspectPnpmAngularApp: async (): Promise<Record<string, unknown>> => {
      const packageJson = await this.readJson<PackageDocument>('package.json');

      return {
        name: packageJson.name,
        framework: await this.fileContains(
          'atlas.config.ts',
          'framework: "angular"',
        ),
        entry: await this.fileContains('src/entry.ts', 'defineApp'),
        federation: await this.fileContains(
          'federation.config.mjs',
          'createAngularV4FederationConfig',
        ),
        detected: this.output.includes('package-manager workspace'),
      };
    },
  };

  get = {
    projectName: (): string => this.projectName,
  };

  private async generate(
    type: GeneratedProjectType,
    framework: GeneratedFramework,
    extraArguments: string[] = [],
  ): Promise<void> {
    this.output = await run(
      process.execPath,
      [
        cliEntrypointPath(),
        'g',
        type,
        this.projectName,
        `--framework=${framework}`,
        '--skip-install',
        ...extraArguments,
      ],
      { cwd: this.root },
    );
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await access(join(this.projectRoot, path));
      return true;
    } catch {
      return false;
    }
  }

  private async fileContains(path: string, value: string): Promise<boolean> {
    const source = await readFile(join(this.projectRoot, path), 'utf8');
    return source.includes(value);
  }

  private async readJson<T>(path: string): Promise<T> {
    return JSON.parse(
      await readFile(join(this.projectRoot, path), 'utf8'),
    ) as T;
  }
}
