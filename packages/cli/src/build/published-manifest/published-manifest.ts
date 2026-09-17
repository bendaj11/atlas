import {
  assertPublishedArtifactManifest,
  createManifestFromConfig,
  type AtlasAppArtifactManifest,
  type AtlasAppConfig,
  type AtlasConfig,
  type AtlasHostArtifactManifest,
  type AtlasPublishedArtifactManifest,
} from '@atlas/schema';
import {
  convertDigestToIntegrity,
  isHostConfig,
  type CliArguments,
  type Sha256Digest,
} from '../../shared/index.js';
import type { AtlasProject } from '../../workspace/index.js';
import { discoverExportedWidgets } from '../exported-widgets/exported-widgets.js';
import {
  normalizeArtifactPath,
  describePayloadFiles,
} from '../payload/payload.js';
import { derivePublicationIdentity } from '../release-identity/release-identity.js';

const CANONICAL_MANIFEST_ORIGIN = 'https://atlas.invalid';

export async function buildPublishedManifest({
  args,
  project,
  config,
  sourceDirectory,
  files: paths,
  entryPath,
}: {
  args: CliArguments;
  project: AtlasProject;
  config: AtlasConfig;
  sourceDirectory: string;
  files: string[];
  entryPath: string;
}): Promise<AtlasPublishedArtifactManifest> {
  const files = await describePayloadFiles({
    root: sourceDirectory,
    paths,
    entryPath,
  });
  const styles = files
    .filter(({ role }) => role === 'stylesheet')
    .map(({ path, digest }) => ({
      path,
      integrity: convertDigestToIntegrity(digest as Sha256Digest),
    }));
  const base = {
    schemaVersion: '2' as const,
    id: config.id,
    name: config.name ?? config.id,
    packageName: project.packageName,
    ...derivePublicationIdentity({ args, project }),
    framework: config.framework,
    entryPath: normalizeArtifactPath(entryPath),
    ...(styles.length ? { styles } : {}),
    files,
  };
  const manifest = isHostConfig(config)
    ? buildHostArtifactManifest(base)
    : await buildAppArtifactManifest({ base, project, config, entryPath });
  assertPublishedArtifactManifest(manifest);

  return manifest;
}

type ArtifactManifestBase = Omit<
  AtlasHostArtifactManifest,
  'kind' | 'exposes' | 'requiredLoaderApiVersion'
>;

function buildHostArtifactManifest(
  base: ArtifactManifestBase,
): AtlasHostArtifactManifest {
  return {
    ...base,
    kind: 'host-artifact',
    exposes: { entry: './host' },
    requiredLoaderApiVersion: '^1.0.0',
  };
}

async function buildAppArtifactManifest({
  base,
  project,
  config,
  entryPath,
}: {
  base: ArtifactManifestBase;
  project: AtlasProject;
  config: AtlasAppConfig;
  entryPath: string;
}): Promise<AtlasAppArtifactManifest> {
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

  return {
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
      ? { externalAppsDependencies: runtimeShape.externalAppsDependencies }
      : {}),
    ...(runtimeShape.metadata ? { metadata: runtimeShape.metadata } : {}),
  };
}
