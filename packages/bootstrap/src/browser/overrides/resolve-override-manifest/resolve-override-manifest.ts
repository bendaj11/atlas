import type {
  AtlasHostManifest,
  AtlasManifest,
  AtlasManifestDescriptor,
  AtlasStaticRegistry,
} from '@atlas/schema';
import type { FetchOptions } from '../../fetch-json/index.js';
import type {
  OverridesContext,
  OverridesDependencies,
} from '../overrides.types.js';

export type FetchStaticRegistry = (
  options: FetchOptions,
) => Promise<AtlasStaticRegistry>;

export type ResolveOverrideManifestDependencies = Pick<
  OverridesDependencies,
  'loadPublishedArtifact'
> & { fetchJson: FetchStaticRegistry };

export interface ResolveOverrideManifestContext extends Pick<
  OverridesContext,
  'runtime'
> {
  dependencies: ResolveOverrideManifestDependencies;
}

type OverrideManifest = AtlasHostManifest | AtlasManifest;

export async function resolveOverrideManifest<
  TManifest extends OverrideManifest,
>({
  manifest,
  runtime,
  dependencies,
}: ResolveOverrideManifestContext & {
  manifest: TManifest;
}): Promise<TManifest | undefined> {
  if (manifest.channel === 'local') return manifest;

  const registryRoot = extractRegistryRootFromRemoteEntryUrl(manifest);

  if (!registryRoot) return manifest;

  const descriptor = await fetchRegistryDescriptor({
    manifest,
    registryRoot,
    runtime,
    dependencies,
  });

  if (!descriptor) return manifest;

  const loaded = await dependencies.loadPublishedArtifact({
    reference: createManifestReferenceFromDescriptor({
      registryRoot,
      descriptor,
    }),
    runtime,
  });

  return loaded.kind === manifest.kind ? (loaded as TManifest) : manifest;
}

async function fetchRegistryDescriptor({
  manifest,
  registryRoot,
  runtime,
  dependencies,
}: ResolveOverrideManifestContext & {
  manifest: OverrideManifest;
  registryRoot: string;
}): Promise<AtlasManifestDescriptor | undefined> {
  let registry: AtlasStaticRegistry;

  try {
    registry = await dependencies.fetchJson({
      url: `${registryRoot}/registry.json`,
      runtime,
    });
  } catch {
    return undefined;
  }

  const artifact =
    manifest.kind === 'host'
      ? registry.hosts[manifest.id]
      : registry.apps[manifest.id];

  return manifest.prNumber
    ? artifact?.previews[String(manifest.prNumber)]
    : artifact?.releases[manifest.version];
}

function extractRegistryRootFromRemoteEntryUrl(
  manifest: OverrideManifest,
): string | undefined {
  const collection = manifest.kind === 'host' ? 'hosts' : 'apps';
  const marker = `/${collection}/${manifest.id}/`;
  const url = new URL(manifest.remoteEntryUrl);
  const markerIndex = url.pathname.indexOf(marker);

  if (markerIndex < 0) return undefined;

  url.pathname = url.pathname.slice(0, markerIndex);
  url.search = '';
  url.hash = '';

  return url.href.replace(/\/$/, '');
}

function createManifestReferenceFromDescriptor({
  registryRoot,
  descriptor,
}: {
  registryRoot: string;
  descriptor: AtlasManifestDescriptor;
}): AtlasManifestDescriptor & { url: string } {
  return {
    ...descriptor,
    url: new URL(descriptor.path, `${registryRoot}/`).href,
  };
}
