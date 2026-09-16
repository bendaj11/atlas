import type { ArtifactVersion } from '../../../types/artifact-version';
import type { HostData } from '../../../types/host-data';
import { getArtifactKey } from '../../artifact-versions/artifact-version-keys/artifact-version-keys';
import { versionKey } from '../../artifact-versions/artifact-version-keys/artifact-version-keys';
import { messageFromError } from '../../shared/errors/errors';
import { isRecord } from '../../shared/messages/messages';
import {
  fetchVerifiedManifest,
  fetchWithTimeout,
  type ManifestDescriptor,
  type ManifestReference,
  manifestReference,
} from '../manifest-fetch/manifest-fetch';

export interface RegistryArtifact {
  id: string;
  name: string;
  releases: Record<string, ManifestDescriptor>;
  previews: Record<string, ManifestDescriptor>;
  latest?: string;
}

export interface Registry {
  schemaVersion: '2';
  apps: Record<string, RegistryArtifact>;
  hosts: Record<string, RegistryArtifact>;
}

export interface ArtifactVersions {
  manifests: ArtifactVersion[];
  error?: string;
}

export interface ArtifactRegistry {
  readRegistry(root: string): Promise<Registry>;
  readVersions(
    deployed: ArtifactVersion,
    registry: Registry,
    root: string,
  ): Promise<ArtifactVersions>;
  loadManifest(reference: ManifestReference): Promise<ArtifactVersion>;
  loadVersion(
    artifactKey: string,
    versionKey: string,
  ): Promise<ArtifactVersion>;
}

const CANONICAL_BUILD_ID = 'canonical';

export function registryRootFor(
  config: HostData['config'],
): string | undefined {
  const root = config.artifactRegistryUrl.replace(/\/$/, '');
  if (config.environment !== 'development' || !config.developmentSessionUrl)
    return root || undefined;

  const controlRoot = (
    config.environmentRegistryUrl ??
    new URL(config.developmentSessionUrl).origin
  ).replace(/\/$/, '');

  return root === controlRoot ? undefined : root || undefined;
}

export function createArtifactRegistry(): ArtifactRegistry {
  const versionReferences = new Map<string, ManifestReference>();
  const loadedManifests = new Map<string, Promise<ArtifactVersion>>();

  function loadManifest(
    reference: ManifestReference,
  ): Promise<ArtifactVersion> {
    const cached = loadedManifests.get(reference.digest);
    if (cached) return cached;

    const manifest = fetchVerifiedManifest(reference);
    loadedManifests.set(reference.digest, manifest);

    return manifest;
  }

  function rememberVersion(
    artifactKey: string,
    manifest: ArtifactVersion,
    reference: ManifestReference,
  ): ArtifactVersion {
    versionReferences.set(`${artifactKey}:${versionKey(manifest)}`, reference);

    return manifest;
  }

  async function readVersions(
    deployed: ArtifactVersion,
    registry: Registry,
    root: string,
  ): Promise<ArtifactVersions> {
    const artifactKey = getArtifactKey(deployed);
    const artifact =
      deployed.kind === 'host'
        ? registry.hosts[deployed.id]
        : registry.apps[deployed.id];
    if (!artifact)
      throw new Error(`Artifact ${deployed.id} is not registered.`);

    const releases = orderedReleases(artifact).map(([version, descriptor]) =>
      rememberVersion(
        artifactKey,
        {
          ...deployed,
          version,
          buildId: CANONICAL_BUILD_ID,
          channel: 'production',
        },
        manifestReference(root, descriptor),
      ),
    );
    const previews: ArtifactVersion[] = [];
    const errors: string[] = [];
    for (const [previewNumber, descriptor] of orderedPreviews(artifact)) {
      const reference = manifestReference(root, descriptor);
      try {
        previews.push(
          rememberVersion(
            artifactKey,
            await loadManifest(reference),
            reference,
          ),
        );
      } catch (error) {
        errors.push(
          `Preview ${previewNumber} is unavailable: ${messageFromError(error)}`,
        );
      }
    }

    return {
      manifests: uniqueManifests([...releases, ...previews]),
      ...(errors.length ? { error: errors.join(' ') } : {}),
    };
  }

  async function loadVersion(
    artifactKey: string,
    selectedVersionKey: string,
  ): Promise<ArtifactVersion> {
    const reference = versionReferences.get(
      `${artifactKey}:${selectedVersionKey}`,
    );
    if (!reference)
      throw new Error('Selected artifact version is unavailable.');

    const manifest = await loadManifest(reference);
    if (
      getArtifactKey(manifest) !== artifactKey ||
      versionKey(manifest) !== selectedVersionKey
    )
      throw new Error(
        'Selected artifact manifest does not match its registry entry.',
      );

    return manifest;
  }

  return { readRegistry, readVersions, loadManifest, loadVersion };
}

async function readRegistry(root: string): Promise<Registry> {
  const response = await fetchWithTimeout(`${root}/registry.json`);
  if (!response.ok)
    throw new Error(`Atlas registry returned ${response.status}.`);

  const registry: unknown = await response.json();
  if (
    !isRecord(registry) ||
    registry.schemaVersion !== '2' ||
    !isRecord(registry.apps) ||
    !isRecord(registry.hosts)
  )
    throw new Error('Atlas registry returned invalid data.');

  return registry as unknown as Registry;
}

function orderedReleases(
  artifact: RegistryArtifact,
): Array<[string, ManifestDescriptor]> {
  return Object.entries(artifact.releases).sort(([left], [right]) => {
    if (left === artifact.latest) return -1;
    if (right === artifact.latest) return 1;

    return right.localeCompare(left, undefined, { numeric: true });
  });
}

function orderedPreviews(
  artifact: RegistryArtifact,
): Array<[string, ManifestDescriptor]> {
  return Object.entries(artifact.previews).sort(
    ([left], [right]) => Number(right) - Number(left),
  );
}

export function uniqueManifests(
  manifests: ArtifactVersion[],
): ArtifactVersion[] {
  return [
    ...new Map(
      manifests.map((manifest) => [
        `${manifest.kind}:${manifest.id}:${manifest.channel}:${manifest.version}`,
        manifest,
      ]),
    ).values(),
  ];
}
