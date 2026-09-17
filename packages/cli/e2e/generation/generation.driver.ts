import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { runCli } from '../cli-process.testkit.js';

type GeneratedProjectType = 'app' | 'host';
type GeneratedFramework = 'angular' | 'react';
type WorkspaceKind = 'standalone' | 'nx' | 'pnpm';

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

export class GenerationDriver {
  private readonly projectName = faker.string.alpha({
    length: 10,
    casing: 'lower',
  });
  private readonly hostId = faker.string.uuid();
  private root = '';
  private projectRoot = '';
  private output = '';

  readonly given = {
    workspace: async (kind: WorkspaceKind) => {
      this.root = await mkdtemp(join(tmpdir(), `atlas-generate-${kind}-`));
      this.projectRoot = join(
        this.root,
        ...(kind === 'pnpm' ? ['packages'] : []),
        this.projectName,
      );

      if (kind === 'nx') await this.writeNxWorkspace();
      if (kind === 'pnpm') await this.writePnpmWorkspace();

      return this;
    },
  };

  readonly when = {
    generated: async ({
      type,
      framework,
      flags = [],
    }: {
      type: GeneratedProjectType;
      framework: GeneratedFramework;
      flags?: string[];
    }) => {
      const result = await runCli({
        cwd: this.root,
        args: [
          'g',
          type,
          this.projectName,
          `--framework=${framework}`,
          '--skip-install',
          ...flags,
        ],
      });
      if (result.code !== 0) throw new Error(result.stderr);
      this.output = result.stdout + result.stderr;
    },
  };

  readonly get = {
    projectName: () => this.projectName,
    projectRoot: () => this.projectRoot,
    hostId: () => this.hostId,
    output: () => this.output,
    fileExists: (path: string) => this.doesPathExist(path),
    file: (path: string) => readFile(join(this.projectRoot, path), 'utf8'),
    angularProject: async () =>
      (await this.readJson<AngularWorkspaceDocument>('angular.json')).projects[
        this.projectName
      ],
    packageJson: () => this.readJson<PackageDocument>('package.json'),
    nxProject: () => this.readJson<NxProjectDocument>('project.json'),
  };

  private async writeNxWorkspace(): Promise<void> {
    await writeFile(join(this.root, 'nx.json'), '{}\n');
    await writeFile(
      join(this.root, 'package.json'),
      JSON.stringify({
        name: faker.string.alpha({ length: 8, casing: 'lower' }),
        private: true,
        packageManager: 'yarn@1.22.22',
      }),
    );
  }

  private async writePnpmWorkspace(): Promise<void> {
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
  }

  private async doesPathExist(path: string): Promise<boolean> {
    try {
      await access(join(this.projectRoot, path));

      return true;
    } catch {
      return false;
    }
  }

  private async readJson<T>(path: string): Promise<T> {
    return JSON.parse(
      await readFile(join(this.projectRoot, path), 'utf8'),
    ) as T;
  }
}
