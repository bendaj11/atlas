import { createHash } from 'node:crypto';
import type { ArtifactVersion } from '../../types/contracts';
import type { ManifestDescriptor } from './manifest-fetch/manifest-fetch';
import type {
  Registry,
  RegistryArtifact,
} from './artifact-registry/artifact-registry';

export interface PublishedArtifact {
  manifest: ArtifactVersion;
  path: string;
  bytes: Uint8Array;
  descriptor: ManifestDescriptor;
}

export function aPublishedArtifact(
  manifest: ArtifactVersion,
): PublishedArtifact {
  const preview = manifest.channel === 'pr';
  const collection = manifest.kind === 'host' ? 'hosts' : 'apps';
  const identity = preview
    ? `previews/${manifest.prNumber ?? 1}/${manifest.buildId}`
    : manifest.version;
  const path = `${collection}/${manifest.id}/${identity}/manifest.json`;
  const artifact = {
    schemaVersion: '2',
    kind: manifest.kind === 'host' ? 'host-artifact' : 'app-artifact',
    id: manifest.id,
    name: manifest.name,
    ...(preview
      ? {
          preview: {
            number: manifest.prNumber ?? 1,
            gitSha: manifest.gitSha ?? manifest.buildId,
            ...(manifest.gitBranch ? { gitBranch: manifest.gitBranch } : {}),
            ...(manifest.gitCommitTitle
              ? { gitCommitTitle: manifest.gitCommitTitle }
              : {}),
          },
        }
      : { release: { version: manifest.version } }),
    framework: manifest.framework,
    entryPath: 'remoteEntry.json',
    exposes: manifest.exposes ?? { entry: './entry' },
    files: [
      {
        path: 'remoteEntry.json',
        digest: `sha256:${'a'.repeat(64)}`,
        size: 1,
        mediaType: 'application/json',
        cacheControl: 'public, max-age=31536000, immutable',
        role: 'remote-entry',
      },
    ],
    ...(manifest.kind === 'host'
      ? { requiredLoaderApiVersion: '^1.0.0' }
      : {
          requiredHostSdkVersion: '^0.1.0',
          supportedHosts: manifest.supportedHosts ?? ['*'],
          placements: manifest.placements ?? [],
        }),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(artifact));

  return {
    manifest,
    path,
    bytes,
    descriptor: {
      path,
      digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      size: bytes.byteLength,
      mediaType: 'application/json',
    },
  };
}

export function aRegistryArtifact(
  manifest: ArtifactVersion,
  published: PublishedArtifact[] = [],
): RegistryArtifact {
  const releases: RegistryArtifact['releases'] = {};
  const previews: RegistryArtifact['previews'] = {};
  let latest: string | undefined;
  published.forEach((artifact) => {
    if (artifact.manifest.channel === 'pr')
      previews[String(artifact.manifest.prNumber ?? 1)] = artifact.descriptor;
    else {
      releases[artifact.manifest.version] = artifact.descriptor;
      latest = artifact.manifest.version;
    }
  });

  return {
    id: manifest.id,
    name: manifest.name,
    releases,
    previews,
    ...(latest ? { latest } : {}),
  };
}

export function aRegistry(overrides: Partial<Registry> = {}): Registry {
  return { schemaVersion: '2', apps: {}, hosts: {}, ...overrides };
}
