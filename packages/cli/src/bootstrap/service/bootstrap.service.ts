import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  createAtlasBootstrapFiles,
  type AtlasBootstrapFile,
  type AtlasBootstrapOptions,
} from '@atlas/bootstrap';
import type { AtlasConfig, AtlasHostRuntimeConfig } from '@atlas/schema';
import { CliArguments } from '../../cli/arguments.js';
import type { AtlasBuildService } from '../../build/service/build.service.js';
import { compileAtlasConfig } from '../../build/config-compiler/config-compiler.js';
import { createHostRuntimeConfig } from '../../build/runtime-config/runtime-config.js';
import type {
  AtlasProject,
  AtlasWorkspace,
} from '../../workspace/service/workspace.js';
import { loadBootstrapTemplate } from '../template/bootstrap-template.js';

type BootstrapBuildService = Pick<AtlasBuildService, 'loadConfig'>;

export interface AtlasBootstrapBuildResult {
  directory: string;
  files: string[];
  digest: string;
}

export interface AtlasBootstrapDependencies {
  compileConfig(
    workspace: AtlasWorkspace,
    project: AtlasProject,
  ): Promise<void>;
  loadTemplate(
    projectRoot: string,
    templatePath?: string,
  ): Promise<string | undefined>;
  createRuntime(
    config: AtlasConfig,
    args: CliArguments,
    version?: string,
  ): AtlasHostRuntimeConfig;
  createFiles(options: AtlasBootstrapOptions): AtlasBootstrapFile[];
  removeDirectory(directory: string): Promise<void>;
  createDirectory(directory: string): Promise<void>;
  writeOutput(path: string, contents: string): Promise<void>;
}

export interface AtlasBootstrapServiceOptions {
  workspace: AtlasWorkspace;
  args: CliArguments;
  builds: BootstrapBuildService;
  dependencies?: AtlasBootstrapDependencies;
}

const defaultDependencies: AtlasBootstrapDependencies = {
  compileConfig: compileAtlasConfig,
  loadTemplate: loadBootstrapTemplate,
  createRuntime: createHostRuntimeConfig,
  createFiles: createAtlasBootstrapFiles,
  removeDirectory: async (directory) =>
    rm(directory, { recursive: true, force: true }),
  createDirectory: async (directory) => {
    await mkdir(directory, { recursive: true });
  },
  writeOutput: async (path, contents) => writeFile(path, contents, 'utf8'),
};

export class AtlasBootstrapService {
  private readonly workspace: AtlasWorkspace;
  private readonly args: CliArguments;
  private readonly builds: BootstrapBuildService;
  private readonly dependencies: AtlasBootstrapDependencies;

  constructor(options: AtlasBootstrapServiceOptions) {
    this.workspace = options.workspace;
    this.args = options.args;
    this.builds = options.builds;
    this.dependencies = options.dependencies ?? defaultDependencies;
  }

  async build(name: string): Promise<AtlasBootstrapBuildResult> {
    const project = await this.workspace.findProject(name);

    if (!this.args.hasFlag('skip-compile'))
      await this.dependencies.compileConfig(this.workspace, project);

    const config = await this.builds.loadConfig(project.root);

    const runtime = this.dependencies.createRuntime(
      config,
      this.args,
      project.version,
    );

    const template = await this.dependencies.loadTemplate(
      project.root,
      this.args.flag('template'),
    );

    const files = this.dependencies.createFiles({
      runtime,
      ...(template !== undefined ? { html: template } : {}),
      ...(this.args.flag('title') ? { title: this.args.flag('title') } : {}),
      ...(this.args.flag('loading-html')
        ? { loadingHtml: this.args.flag('loading-html') }
        : {}),
    });

    const directory = resolve(
      this.args.flag('out') ?? join(project.root, 'dist', 'bootstrap'),
    );

    const digest = bootstrapDigest(files);

    const metadata = {
      schemaVersion: '1',
      digest,
      files: files.map(({ path }) => path).sort(),
    };

    await this.dependencies.removeDirectory(directory);
    await this.dependencies.createDirectory(directory);

    await Promise.all(
      [
        ...files,
        {
          path: 'atlas.bootstrap.json',
          contents: `${JSON.stringify(metadata, null, 2)}\n`,
        },
      ].map(async (file) => {
        await this.dependencies.writeOutput(
          join(directory, file.path),
          file.contents,
        );
      }),
    );

    return {
      directory,
      files: [...files.map((file) => file.path), 'atlas.bootstrap.json'],
      digest,
    };
  }
}

function bootstrapDigest(files: readonly AtlasBootstrapFile[]): string {
  const hash = createHash('sha256');

  for (const file of [...files].sort((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.contents);
    hash.update('\0');
  }

  return `sha256:${hash.digest('hex')}`;
}
