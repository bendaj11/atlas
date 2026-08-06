import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { faker } from '@faker-js/faker';
import type { ProcessCommand } from '../../cli/process/process.js';
import {
  createFormatGeneratedCommand,
  createInstallCommand,
  createNxGenerationCommand,
  createNxPluginInstallCommand,
  createTaskCommand,
  detectWorkspace,
  installationRoot,
  type AtlasProject,
} from './workspace.js';

type WorkspaceScenario =
  | 'nx-project'
  | 'missing-config'
  | 'package-workspace'
  | 'pnpm-workspace'
  | 'nx-outputs'
  | 'delegated-output'
  | 'solution-workspace';

type CommandScenario =
  | 'nx-task'
  | 'turbo-task'
  | 'npm-workspace-task'
  | 'install'
  | 'format'
  | 'angular-generation'
  | 'react-generation'
  | 'plugin-install';

export class WorkspaceDriver {
  private readonly projectName = faker.word.noun().toLowerCase();
  private readonly packageName = `@${faker.word.noun().toLowerCase()}/${this.projectName}`;
  private readonly version = faker.system.semver();
  private root = '';
  private projectRoot = '';
  private scenario?: WorkspaceScenario;
  private value?: unknown;

  given = {
    workspace: async (scenario: WorkspaceScenario): Promise<void> => {
      this.scenario = scenario;
      this.root = await mkdtemp(join(tmpdir(), 'atlas-workspace-'));
      this.projectRoot = join(this.root, 'apps', this.projectName);

      if (scenario === 'package-workspace' || scenario === 'pnpm-workspace') {
        this.projectRoot = join(this.root, 'packages', this.projectName);
      }

      await mkdir(this.projectRoot, { recursive: true });
      await this.writeWorkspaceFiles(scenario);
    },
  };

  when = {
    createCommand: async (scenario: CommandScenario): Promise<void> => {
      const project = this.project();

      if (scenario === 'nx-task') {
        this.value = this.normalizeCommand(
          createTaskCommand('nx', 'yarn', this.root, project, 'build'),
        );
      }

      if (scenario === 'turbo-task') {
        this.value = this.normalizeCommand(
          createTaskCommand('turbo', 'pnpm', this.root, project, 'dev', [
            '--port',
            '4201',
          ]),
        );
      }

      if (scenario === 'npm-workspace-task') {
        this.value = this.normalizeCommand(
          createTaskCommand('workspace', 'npm', this.root, project, 'build'),
        );
      }

      if (scenario === 'install') {
        this.value = this.normalizeCommand(
          createInstallCommand('pnpm', this.root, this.projectRoot),
        );
      }

      if (scenario === 'format') {
        this.root = await mkdtemp(join(tmpdir(), 'atlas-format-command-'));
        this.projectRoot = join(this.root, 'apps', this.projectName);

        await mkdir(this.projectRoot, { recursive: true });
        await writeFile(
          join(this.projectRoot, 'package.json'),
          JSON.stringify({ scripts: { format: 'prettier --write .' } }),
        );
        this.value = this.normalizeCommand(
          await createFormatGeneratedCommand(
            'workspace',
            'pnpm',
            this.root,
            this.projectRoot,
          ),
        );
      }

      if (scenario === 'angular-generation') {
        const command = createNxGenerationCommand('pnpm', this.root, {
          directory: `apps/${this.projectName}`,
          framework: 'angular',
          interactive: false,
          routing: true,
          type: 'host',
        });

        this.value = this.generationDefaults(command, [
          '@nx/angular:application',
          '--interactive=false',
          '--port=4200',
          '--ssr=false',
          '--bundler=esbuild',
        ]);
      }

      if (scenario === 'react-generation') {
        const command = createNxGenerationCommand('yarn', this.root, {
          directory: `apps/${this.projectName}`,
          framework: 'react',
          interactive: false,
          routing: false,
          type: 'app',
        });

        this.value = this.generationDefaults(command, [
          '@nx/react:application',
          '--interactive=false',
          '--port=4201',
          '--bundler=vite',
        ]);
      }

      if (scenario === 'plugin-install') {
        this.value = this.normalizeCommand(
          createNxPluginInstallCommand('npm', this.root, 'react'),
        );
      }
    },
    detect: async (): Promise<void> => {
      if (!this.scenario) throw new Error('Workspace setup is required.');

      const workspace = await detectWorkspace(this.projectRoot);

      if (this.scenario === 'missing-config') {
        await workspace.findProject(this.projectName);
        return;
      }

      if (this.scenario === 'solution-workspace') {
        this.value = {
          generationRoot: relative(
            this.root,
            workspace.generationRoot('host', 'host'),
          ),
          missingPlugin: await workspace.missingScaffoldDependency('angular'),
        };

        return;
      }

      const project = await workspace.findProject(this.projectName);

      this.value = this.normalizeValue({
        generationRoot: relative(
          this.root,
          workspace.generationRoot('app', 'catalog'),
        ),
        kind: workspace.kind,
        outputPaths: project.outputPaths.map((path) =>
          relative(this.root, path),
        ),
        packageManager: workspace.packageManager,
        projectRoot: relative(this.root, project.root),
        version: project.version,
        workspaceRoot: relative(this.root, workspace.root) || '.',
      });
    },
    resolveInstallationRoot: async ({
      projectPackage,
    }: {
      projectPackage: 'missing' | 'present';
    }): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-installation-root-'));
      this.projectRoot = join(this.root, 'apps', this.projectName);

      await mkdir(this.projectRoot, { recursive: true });

      if (projectPackage === 'present') {
        await writeFile(
          join(this.projectRoot, 'package.json'),
          JSON.stringify({ name: this.packageName }),
        );
      }

      this.value = this.normalizeValue(
        relative(
          this.root,
          await installationRoot('nx', this.root, this.projectRoot),
        ) || '.',
      );
    },
  };

  get = {
    value: <T>(): T => this.value as T,
    version: (): string => this.version,
  };

  private async writeWorkspaceFiles(
    scenario: WorkspaceScenario,
  ): Promise<void> {
    const isNx = [
      'nx-project',
      'missing-config',
      'nx-outputs',
      'delegated-output',
      'solution-workspace',
    ].includes(scenario);

    if (isNx) await writeFile(join(this.root, 'nx.json'), '{}\n');

    if (scenario === 'package-workspace') {
      await writeFile(
        join(this.root, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] }),
      );
    } else if (scenario === 'pnpm-workspace') {
      await writeFile(
        join(this.root, 'package.json'),
        JSON.stringify({ packageManager: 'pnpm@10.0.0' }),
      );
      await writeFile(
        join(this.root, 'pnpm-workspace.yaml'),
        'packages:\n  - packages/*\n',
      );
    } else {
      await writeFile(
        join(this.root, 'package.json'),
        JSON.stringify({
          packageManager: 'yarn@1.22.22',
          version: this.version,
          ...(scenario === 'solution-workspace'
            ? { workspaces: ['packages/*'] }
            : {}),
        }),
      );
    }

    if (scenario === 'solution-workspace') {
      await writeFile(
        join(this.root, 'tsconfig.json'),
        JSON.stringify({ files: [], references: [] }),
      );

      return;
    }

    const projectJson = this.projectJson(scenario);

    if (projectJson) {
      await writeFile(
        join(this.projectRoot, 'project.json'),
        JSON.stringify(projectJson),
      );
    }

    if (scenario !== 'missing-config') {
      await writeFile(
        join(this.projectRoot, 'package.json'),
        JSON.stringify({ name: this.packageName, version: this.version }),
      );
      await writeFile(
        join(this.projectRoot, 'atlas.config.ts'),
        'export default {};\n',
      );
    }
  }

  private projectJson(
    scenario: WorkspaceScenario,
  ): Record<string, unknown> | undefined {
    if (scenario === 'package-workspace' || scenario === 'pnpm-workspace') {
      return undefined;
    }

    if (scenario === 'nx-outputs') {
      return {
        name: this.projectName,
        targets: {
          build: {
            configurations: {
              development: { outputPath: `dist/dev/${this.projectName}` },
              production: {
                outputPath: {
                  base: `dist/${this.projectName}`,
                  browser: 'browser',
                },
              },
            },
            defaultConfiguration: 'production',
            outputs: [
              '{workspaceRoot}/custom/{projectName}',
              '{projectRoot}/public',
            ],
          },
        },
      };
    }

    if (scenario === 'delegated-output') {
      return {
        name: this.projectName,
        targets: {
          build: {
            executor: '@angular-architects/native-federation:build',
            options: {
              target: `${this.projectName}:esbuild:production`,
            },
          },
          esbuild: {
            executor: '@nx/angular:application',
            options: {
              outputPath: {
                base: `apps/${this.projectName}/dist`,
                browser: 'browser',
              },
            },
          },
        },
      };
    }

    return {
      name: this.projectName,
      targets: {
        build: { options: { outputPath: `dist/apps/${this.projectName}` } },
      },
    };
  }

  private project(): AtlasProject {
    this.root ||= '/repo';
    this.projectRoot ||= `${this.root}/apps/${this.projectName}`;

    return {
      id: this.projectName,
      outputPaths: [],
      packageName: this.packageName,
      root: this.projectRoot,
      version: this.version,
    };
  }

  private normalizeCommand(command: ProcessCommand | undefined): unknown {
    if (!command) return undefined;

    return JSON.parse(
      JSON.stringify(command)
        .replaceAll(this.projectRoot, '{projectRoot}')
        .replaceAll(this.root, '{root}')
        .replaceAll(this.packageName, '@scope/{project}')
        .replaceAll(this.projectName, '{project}'),
    );
  }

  private generationDefaults(
    command: ProcessCommand,
    requiredArguments: readonly string[],
  ): Record<string, boolean> {
    return Object.fromEntries(
      requiredArguments.map((argument) => [
        argument,
        command.args.includes(argument),
      ]),
    );
  }

  private normalizeValue(value: unknown): unknown {
    return JSON.parse(
      JSON.stringify(value).replaceAll(this.projectName, '{project}'),
    );
  }
}
