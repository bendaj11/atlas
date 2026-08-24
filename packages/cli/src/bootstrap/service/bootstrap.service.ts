import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  assertAtlasBootstrapManifest,
  normalizeAtlasRegistryUrl,
  createAtlasBootstrapFiles,
  type AtlasBootstrapFile,
  type AtlasBootstrapManifest,
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
    const registryUrl = requiredRegistryUrl(this.args);
    const assetOrigins = optionalAssetOrigins(
      this.args.flag('asset-origins'),
    ).assetOrigins;

    const files = this.dependencies.createFiles({
      ...(template !== undefined ? { html: template } : {}),
      ...(this.args.flag('title') ? { title: this.args.flag('title') } : {}),
      ...(this.args.flag('loading-html')
        ? { loadingHtml: this.args.flag('loading-html') }
        : {}),
      assetOrigins: [...(assetOrigins ?? []), new URL(registryUrl).origin],
    });
    const directory = resolve(
      this.args.flag('out') ?? join(project.root, 'dist', 'bootstrap'),
    );

    const outputFiles = files;
    const bootstrapSettings = {
      schemaVersion: '2',
      hostId: config.id,
      registryUrl,
      resourcesTimeoutMs: config.resourcesTimeoutMs ?? 15000,
      resourcesRetryCount: config.resourcesRetryCount ?? 3,
      ...(assetOrigins?.length ? { assetOrigins } : {}),
    } as const;
    const digest = bootstrapDigest([
      ...outputFiles,
      {
        path: 'atlas.bootstrap.json',
        contents: JSON.stringify(bootstrapSettings),
      },
    ]);

    const metadata: AtlasBootstrapManifest = {
      ...bootstrapSettings,
      digest,
      files: outputFiles.map(({ path }) => path).sort(),
    };
    assertAtlasBootstrapManifest(metadata);

    await this.dependencies.removeDirectory(directory);
    await this.dependencies.createDirectory(directory);

    await Promise.all(
      [
        ...outputFiles,
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
      files: [...outputFiles.map((file) => file.path), 'atlas.bootstrap.json'],
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

function requiredRegistryUrl(args: CliArguments): string {
  const value = args.flag('registry-url') ?? process.env.ATLAS_REGISTRY_URL;
  if (!value) {
    throw new Error(
      'Atlas bootstrap requires --registry-url or ATLAS_REGISTRY_URL. Use the public base URL that serves registry.json.',
    );
  }
  if (value === 'true') throw new Error('--registry-url requires a URL.');
  return normalizeAtlasRegistryUrl(value);
}

function optionalAssetOrigins(
  value: string | undefined,
): Pick<AtlasBootstrapOptions, 'assetOrigins'> {
  if (!value) return {};
  return {
    assetOrigins: [
      ...new Set(
        value
          .split(/[\s,]+/u)
          .filter(Boolean)
          .map((entry) => new URL(entry).origin),
      ),
    ],
  };
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
