import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createManifestFromConfig,
  type AtlasConfig,
  type AtlasHostManifest,
  type AtlasManifest,
  type AtlasVersionChannel,
} from '@atlas/schema';
import {
  assertAppConfig,
  CliArguments,
  cliError,
  compileAtlasConfig,
  isHostConfig,
  sha256Integrity,
  trimTrailingSlash,
} from '../../shared/index.js';
import type { AtlasWorkspace } from '../../workspace/index.js';
import {
  findArtifactRoot,
  findArtifactRootIfPresent,
  hashArtifactDirectory,
  listArtifactFiles,
} from '../artifact-root/artifact-root.js';
import { loadCompiledAtlasConfig } from '../config-loader/config-loader.js';
import { discoverExportedWidgets } from '../exported-widgets/exported-widgets.js';
import {
  DEFAULT_ENTRY_PATH,
  writeLocalHostManifest,
} from '../local-host-manifest/local-host-manifest.js';
import { buildPublishedManifest } from '../published-manifest/published-manifest.js';
import { releaseIdentity } from '../release-identity/release-identity.js';
import { discoverStylesheets } from '../stylesheets/stylesheets.js';
import { buildTimestamp } from '../timestamp/timestamp.js';
import type { AtlasBuildResult, BuildManifestOptions } from '../types.js';

const LOCAL_REGISTRY_URL = 'http://localhost:4400';

export class AtlasBuildService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
  ) {}

  async publication(name: string): Promise<AtlasBuildResult> {
    const project = await this.workspace.findProject(name);

    if (!this.args.hasFlag('skip-compile'))
      await compileAtlasConfig(this.workspace, project);

    const config = await this.loadConfig(project.root);
    const entryPath = this.entryPath();
    const sourceDirectory = await findArtifactRoot({
      workspaceRoot: this.workspace.root,
      project,
      config,
      entryPath,
    });
    const files = await listArtifactFiles(sourceDirectory);
    const manifest = await buildPublishedManifest({
      args: this.args,
      project,
      config,
      sourceDirectory,
      files,
      entryPath,
    });

    return {
      artifact: manifest.kind === 'app-artifact' ? 'app' : 'host',
      manifest,
      project,
      sourceDirectory,
      files,
    };
  }

  async buildManifest(
    name: string,
    forcedChannel?: AtlasVersionChannel,
    options: BuildManifestOptions = {},
  ): Promise<AtlasManifest> {
    const project = await this.workspace.findProject(name);

    if (!options.skipCompile && !this.args.hasFlag('skip-compile'))
      await this.workspace.run(project, 'build');

    const config = assertAppConfig(await this.loadConfig(project.root));
    const release = releaseIdentity({ args: this.args, project });
    const channel = forcedChannel ?? release.channel;
    const entryPath = this.entryPath();
    const lookup = {
      workspaceRoot: this.workspace.root,
      project,
      config,
      entryPath,
    };
    const artifactRoot =
      channel === 'local'
        ? await findArtifactRootIfPresent(lookup)
        : await findArtifactRoot(lookup);
    const artifactDigest = artifactRoot
      ? await hashArtifactDirectory(artifactRoot)
      : 'local';
    const buildId = this.args.flag('build-id') ?? artifactDigest.slice(0, 12);
    const baseUrl = trimTrailingSlash(
      options.baseUrl ?? this.registryUrl(channel),
    );
    const remoteEntryUrl =
      channel === 'local'
        ? `${baseUrl}/${entryPath}`
        : `${baseUrl}/apps/${config.id}/${release.version}/${buildId}/${entryPath}`;
    const artifactBaseUrl = trimTrailingSlash(
      remoteEntryUrl.slice(0, -entryPath.length),
    );
    const integrity =
      artifactRoot && channel !== 'local'
        ? sha256Integrity(await readFile(join(artifactRoot, entryPath)))
        : undefined;

    return createManifestFromConfig({
      config,
      version: release.version,
      buildId,
      remoteEntryUrl,
      channel,
      gitSha: release.gitSha,
      gitBranch: release.gitBranch,
      gitCommitTitle: release.gitCommitTitle,
      prNumber: release.prNumber,
      createdAt: buildTimestamp(),
      exportedWidgets: await discoverExportedWidgets({
        projectRoot: project.root,
        config,
        ownerRemoteEntryUrl: remoteEntryUrl,
      }),
      styles: await discoverStylesheets({
        artifactRoot: artifactRoot ?? project.root,
        artifactBaseUrl,
        framework: config.framework,
        channel,
      }),
      ...(integrity ? { integrity } : {}),
    });
  }

  async buildLocalHostManifest(
    projectName: string,
    baseUrl: string,
  ): Promise<AtlasHostManifest> {
    const project = await this.workspace.findProject(projectName);
    const config = await this.loadConfig(project.root);
    if (!isHostConfig(config))
      throw new Error(`Atlas dev expected "${projectName}" to be a host.`);

    return writeLocalHostManifest({ project, config, baseUrl });
  }

  loadConfig(root: string): Promise<AtlasConfig> {
    return loadCompiledAtlasConfig(root);
  }

  private entryPath(): string {
    return this.args.flag('entry') ?? DEFAULT_ENTRY_PATH;
  }

  private registryUrl(channel: AtlasVersionChannel): string {
    const explicit =
      this.args.flag('registry-url') ?? process.env.ATLAS_REGISTRY_URL;
    if (explicit) return explicit;

    if (channel === 'local') return LOCAL_REGISTRY_URL;

    throw cliError(
      '--registry-url or ATLAS_REGISTRY_URL is required for non-local builds.',
      'Pass --registry-url <https://registry-root> or export ATLAS_REGISTRY_URL.',
      { code: 'ATLAS_REGISTRY_URL_MISSING' },
    );
  }
}
