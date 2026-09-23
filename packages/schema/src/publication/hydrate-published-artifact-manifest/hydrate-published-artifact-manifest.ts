import type { AtlasHostManifest } from '../../host-manifest/atlas-host-manifest.js';
import type { AtlasManifest } from '../../manifest/atlas-manifest.js';
import type { AtlasAppArtifactManifest } from '../atlas-publication.js';
import { AtlasError } from '../../errors/atlas-error/atlas-error.js';
import { convertDigestToIntegrity } from '../../validation/digest-to-integrity.js';
import { assertPublishedArtifactManifest } from '../validate-published-artifact-manifest/validate-published-artifact-manifest.js';

const CANONICAL_RELEASE_VERSION = '0.0.0';
const CANONICAL_BUILD_ID = 'canonical';
const CANONICAL_CREATED_AT = '1970-01-01T00:00:00.000Z';

/** Converts a published artifact manifest into the runtime manifest hosts load. */
export function hydratePublishedArtifactManifest(
  value: unknown,
  manifestUrl: string,
): AtlasManifest | AtlasHostManifest {
  assertPublishedArtifactManifest(value);
  const root = new URL('.', manifestUrl).href;
  const entry = value.files.find(({ path }) => path === value.entryPath);

  if (!entry)
    throw new AtlasError(
      `Atlas manifest "${manifestUrl}" lists no payload file for its entryPath.`,
      {
        suggestedActions:
          'Republish the artifact so its files include the entryPath, then retry.',
        code: 'ATLAS_ARTIFACT_ENTRY_MISSING',
      },
    );

  const source = value.preview ?? value.source;
  const base = {
    schemaVersion: '1' as const,
    id: value.id,
    name: value.name,
    version: value.release?.version ?? CANONICAL_RELEASE_VERSION,
    buildId: value.preview?.gitSha ?? CANONICAL_BUILD_ID,
    channel: value.preview ? ('pr' as const) : ('production' as const),
    framework: value.framework,
    remoteEntryUrl: new URL(value.entryPath, root).href,
    exposes: value.exposes,
    integrity: convertDigestToIntegrity(entry.digest),
    createdAt: CANONICAL_CREATED_AT,
    ...(source?.gitSha ? { gitSha: source.gitSha } : {}),
    ...(source?.gitBranch ? { gitBranch: source.gitBranch } : {}),
    ...(source?.gitCommitTitle
      ? { gitCommitTitle: source.gitCommitTitle }
      : {}),
    ...(value.preview ? { prNumber: value.preview.number } : {}),
    ...(value.styles?.length
      ? {
          styles: value.styles.map(({ path, integrity }) => ({
            href: new URL(path, root).href,
            integrity,
          })),
        }
      : {}),
  };
  if (value.kind === 'host-artifact')
    return {
      ...base,
      kind: 'host',
      requiredLoaderApiVersion: value.requiredLoaderApiVersion,
    };

  return hydrateAppManifest({ artifact: value, root, base });
}

function hydrateAppManifest(input: {
  artifact: AtlasAppArtifactManifest;
  root: string;
  base: Omit<
    AtlasManifest,
    'kind' | 'requiredHostSdkVersion' | 'supportedHosts' | 'placements'
  >;
}): AtlasManifest {
  const { artifact } = input;
  const remoteEntryUrl = new URL(artifact.entryPath, input.root).href;

  return {
    ...input.base,
    kind: 'app',
    ...(artifact.isolation ? { isolation: artifact.isolation } : {}),
    requiredHostSdkVersion: artifact.requiredHostSdkVersion,
    supportedHosts: artifact.supportedHosts,
    placements: artifact.placements,
    ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
    ...(artifact.externalAppsDependencies?.length
      ? { externalAppsDependencies: artifact.externalAppsDependencies }
      : {}),
    ...(artifact.exportedWidgets?.length
      ? {
          exportedWidgets: artifact.exportedWidgets.map((widget) => ({
            ...widget,
            remoteEntryUrl,
          })),
        }
      : {}),
  };
}
