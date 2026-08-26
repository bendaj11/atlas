import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  createAtlasBootstrapFiles,
  type AtlasBootstrapFile,
  type AtlasBootstrapOptions,
} from '@atlas/bootstrap';
import { CliArguments } from '../../cli/arguments.js';
import type { AtlasConfig, AtlasHostConfig } from '@atlas/schema';
import type { AtlasBuildService } from '../../build/service/build.service.js';
import { compileAtlasConfig } from '../../build/config-compiler/config-compiler.js';
import type {
  AtlasProject,
  AtlasWorkspace,
} from '../../workspace/service/workspace.js';
import { loadBootstrapTemplate } from '../template/bootstrap-template.js';

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
  createFiles(options: AtlasBootstrapOptions): AtlasBootstrapFile[];
  removeDirectory(directory: string): Promise<void>;
  createDirectory(directory: string): Promise<void>;
  writeOutput(path: string, contents: string): Promise<void>;
}

export interface AtlasBootstrapServiceOptions {
  workspace: AtlasWorkspace;
  args: CliArguments;
  builds: Pick<AtlasBuildService, 'loadConfig'>;
  dependencies?: AtlasBootstrapDependencies;
}

const defaultDependencies: AtlasBootstrapDependencies = {
  compileConfig: compileAtlasConfig,
  loadTemplate: loadBootstrapTemplate,
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
  private readonly builds: Pick<AtlasBuildService, 'loadConfig'>;
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

    const template = await this.dependencies.loadTemplate(
      project.root,
      this.args.flag('template'),
    );
    const config = await this.builds.loadConfig(project.root);
    assertHostConfig(config, name);
    const files = this.dependencies.createFiles({
      ...(template !== undefined ? { html: template } : {}),
      ...(this.args.flag('title') ? { title: this.args.flag('title') } : {}),
      ...(this.args.flag('loading-html')
        ? { loadingHtml: this.args.flag('loading-html') }
        : {}),
    });
    const directory = resolve(
      this.args.flag('out') ?? join(project.root, 'dist', 'bootstrap'),
    );

    const outputFiles = files;
    const digest = bootstrapDigest(outputFiles);

    await this.dependencies.removeDirectory(directory);
    await this.dependencies.createDirectory(directory);

    await Promise.all(
      outputFiles.map(async (file) => {
        await this.dependencies.writeOutput(
          join(directory, file.path),
          file.contents,
        );
      }),
    );

    return {
      directory,
      files: outputFiles.map((file) => file.path),
      digest,
    };
  }
}

function assertHostConfig(
  config: AtlasConfig,
  projectName: string,
): asserts config is AtlasHostConfig {
  if (
    config.type === 'app' ||
    'routes' in config ||
    'slots' in config ||
    'domIsolation' in config ||
    'requiredHostSdkVersion' in config
  ) {
    throw new Error(
      `Atlas bootstrap expects a host project, but "${projectName}" is an app.`,
    );
  }
}

function bootstrapDigest(
  files: readonly { path: string; contents: string }[],
): string {
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
