import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createManifestFromConfig,
  assertPublishedArtifactManifest,
  type AtlasConfig,
  type AtlasAppArtifactManifest,
  type AtlasHostArtifactManifest,
  type AtlasHostManifest,
  type AtlasManifest,
  type AtlasPublishedArtifactManifest,
  type AtlasVersionChannel,
} from '@atlas/schema';
import {
  findArtifactRoot,
  findArtifactRootIfPresent,
  hashArtifactDirectory,
  listArtifactFiles,
} from '../artifact-root/artifact-root.js';
import { loadCompiledAtlasConfig } from '../config-loader/config-loader.js';
import { discoverExportedWidgets } from '../exported-widgets/exported-widgets.js';
import {
  normalizeArtifactPath,
  payloadDescriptors,
} from '../payload/payload.js';
import {
  publicationIdentity,
  releaseIdentity,
} from '../release-identity/release-identity.js';
import { discoverStylesheets } from '../stylesheets/stylesheets.js';
import { buildTimestamp } from '../timestamp/timestamp.js';
import {
  CliArguments,
  cliError,
  assertAppConfig,
  isHostConfig,
  integrityFromDigest,
  sha256Integrity,
  type Sha256Digest,
  writeJsonFile,
  trimTrailingSlash,
  compileAtlasConfig,
} from '../../shared/index.js';
import type { AtlasProject, AtlasWorkspace } from '../../workspace/index.js';

const DEFAULT_ENTRY_PATH = 'remoteEntry.json';
const LOCAL_REGISTRY_URL = 'http://localhost:4400';
const CANONICAL_MANIFEST_ORIGIN = 'https://atlas.invalid';

export type AtlasBuildResult = {
  artifact: 'app' | 'host';
  manifest: AtlasPublishedArtifactManifest;
  project: AtlasProject;
  sourceDirectory: string;
  files: string[];
};

export interface BuildManifestOptions {
  skipCompile?: boolean;
  baseUrl?: string;
}

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
    const manifest = await this.buildPublishedManifest({
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
    const origin = trimTrailingSlash(baseUrl);
    const styles = await discoverStylesheets({
      artifactRoot: project.root,
      artifactBaseUrl: origin,
      framework: config.framework,
      channel: 'local',
    });
    const manifest: AtlasHostManifest = {
      schemaVersion: '1',
      kind: 'host',
      id: config.id,
      name: config.name ?? config.id,
      version: project.version,
      buildId: 'local',
      channel: 'local',
      framework: config.framework,
      remoteEntryUrl: `${origin}/${DEFAULT_ENTRY_PATH}`,
      exposes: { entry: './host' },
      requiredLoaderApiVersion: '^1.0.0',
      createdAt: buildTimestamp(),
      ...(styles.length ? { styles } : {}),
    };
    await mkdir(join(project.root, '.atlas'), { recursive: true });
    await writeJsonFile(
      join(project.root, '.atlas', 'local-host.manifest.json'),
      manifest,
    );

    return manifest;
  }

  loadConfig(root: string): Promise<AtlasConfig> {
    return loadCompiledAtlasConfig(root);
  }

  private async buildPublishedManifest(options: {
    project: AtlasProject;
    config: AtlasConfig;
    sourceDirectory: string;
    files: string[];
    entryPath: string;
  }): Promise<AtlasPublishedArtifactManifest> {
    const { project, config, sourceDirectory, entryPath } = options;
    const identity = publicationIdentity({ args: this.args, project });
    const files = await payloadDescriptors({
      root: sourceDirectory,
      paths: options.files,
      entryPath,
    });
    const styles = files
      .filter(({ role }) => role === 'stylesheet')
      .map(({ path, digest }) => ({
        path,
        integrity: integrityFromDigest(digest as Sha256Digest),
      }));
    const base = {
      schemaVersion: '2' as const,
      id: config.id,
      name: config.name ?? config.id,
      packageName: project.packageName,
      ...identity,
      framework: config.framework,
      entryPath: normalizeArtifactPath(entryPath),
      ...(styles.length ? { styles } : {}),
      files,
    };
    if (isHostConfig(config)) {
      const manifest: AtlasHostArtifactManifest = {
        ...base,
        kind: 'host-artifact',
        exposes: { entry: './host' },
        requiredLoaderApiVersion: '^1.0.0',
      };
      assertPublishedArtifactManifest(manifest);

      return manifest;
    }
    const canonicalRemoteEntryUrl = `${CANONICAL_MANIFEST_ORIGIN}/${entryPath}`;
    const runtimeShape = createManifestFromConfig({
      config,
      version: '0.0.0',
      buildId: 'canonical',
      remoteEntryUrl: canonicalRemoteEntryUrl,
      createdAt: '1970-01-01T00:00:00.000Z',
      exportedWidgets: await discoverExportedWidgets({
        projectRoot: project.root,
        config,
        ownerRemoteEntryUrl: canonicalRemoteEntryUrl,
      }),
    });
    const manifest: AtlasAppArtifactManifest = {
      ...base,
      kind: 'app-artifact',
      exposes: runtimeShape.exposes,
      isolation: runtimeShape.isolation,
      requiredHostSdkVersion: runtimeShape.requiredHostSdkVersion,
      supportedHosts: runtimeShape.supportedHosts,
      placements: runtimeShape.placements,
      ...(runtimeShape.exportedWidgets?.length
        ? {
            exportedWidgets: runtimeShape.exportedWidgets.map(
              ({ remoteEntryUrl: _, ...widget }) => widget,
            ),
          }
        : {}),
      ...(runtimeShape.externalAppsDependencies?.length
        ? {
            externalAppsDependencies: runtimeShape.externalAppsDependencies,
          }
        : {}),
      ...(runtimeShape.metadata ? { metadata: runtimeShape.metadata } : {}),
    };
    assertPublishedArtifactManifest(manifest);

    return manifest;
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
