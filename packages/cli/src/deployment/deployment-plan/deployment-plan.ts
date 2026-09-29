import {
  placementTargetsHost,
  type AtlasAppArtifactManifest,
  type AtlasEnvironmentDeployment,
  type AtlasHostDeploymentManifest,
  type AtlasManifestDescriptor,
  type AtlasStaticRegistry,
} from '@atlas/schema';
import { stringifyCanonicalJson } from '../../publication/index.js';
import {
  computeSha256Digest,
  forEachConcurrently,
} from '../../shared/index.js';
import {
  buildEnvironmentStatePath,
  buildHostManifestPath,
  readPublishedManifest,
  readTargetEnvironmentState,
} from '../registry-access/registry-access.js';
import type {
  ArtifactKind,
  DeploymentWrite,
  RegistryAccess,
  ArtifactSelection,
} from '../types.js';

interface SelectedAppRelease {
  id: string;
  descriptor: AtlasManifestDescriptor;
  manifest: AtlasAppArtifactManifest;
}

export async function planDeployment({
  access,
  registry,
  environment,
  selected,
  concurrency,
}: {
  access: RegistryAccess;
  registry: AtlasStaticRegistry;
  environment: string;
  selected: ArtifactSelection;
  concurrency: number;
}): Promise<DeploymentWrite> {
  const current = await readTargetEnvironmentState({ access, environment });
  const state = applySelection({ current, environment, selected });
  const manifests = await buildHostDeploymentManifests({
    access,
    registry,
    state,
    selected,
    concurrency,
  });

  return { state, manifests };
}

export function listDeploymentPaths({
  environment,
  deployment,
}: {
  environment: string;
  deployment: DeploymentWrite;
}): string[] {
  return [
    buildEnvironmentStatePath(environment),
    ...deployment.manifests.map(({ hostId }) =>
      buildHostManifestPath({ environment, hostId }),
    ),
  ];
}

function applySelection({
  current,
  environment,
  selected,
}: {
  current: AtlasEnvironmentDeployment | undefined;
  environment: string;
  selected: ArtifactSelection;
}): AtlasEnvironmentDeployment {
  const content = {
    schemaVersion: 'v1' as const,
    environment,
    hosts: { ...(current?.hosts ?? {}) },
    apps: { ...(current?.apps ?? {}) },
  };
  content[selected.kind === 'app' ? 'apps' : 'hosts'][selected.id] = {
    version: selected.version,
  };

  return {
    ...content,
    updatedAt: new Date().toISOString(),
    revision: computeRevisionOf(content),
  };
}

async function buildHostDeploymentManifests({
  access,
  registry,
  state,
  selected,
  concurrency,
}: {
  access: RegistryAccess;
  registry: AtlasStaticRegistry;
  state: AtlasEnvironmentDeployment;
  selected: ArtifactSelection;
  concurrency: number;
}): Promise<AtlasHostDeploymentManifest[]> {
  const apps = await readSelectedAppReleases({
    access,
    registry,
    state,
    concurrency,
  });
  const hostIds =
    selected.kind === 'host'
      ? [selected.id]
      : Object.keys(state.hosts).filter((hostId) =>
          apps.some((app) => doesAppTargetHost({ app, hostId })),
        );

  return hostIds
    .sort()
    .map((hostId) =>
      buildHostDeploymentManifest({ registry, state, apps, hostId }),
    );
}

async function readSelectedAppReleases({
  access,
  registry,
  state,
  concurrency,
}: {
  access: RegistryAccess;
  registry: AtlasStaticRegistry;
  state: AtlasEnvironmentDeployment;
  concurrency: number;
}): Promise<SelectedAppRelease[]> {
  const releases = new Map<string, SelectedAppRelease>();

  await forEachConcurrently({
    items: Object.entries(state.apps),
    concurrency,
    operation: async ([id, entry]) => {
      const descriptor = findReleaseDescriptor({
        registry,
        kind: 'app',
        id,
        version: entry.version,
      });
      const manifest = await readPublishedManifest({ access, descriptor });

      if (manifest.kind !== 'app-artifact')
        throw new Error(
          `Atlas deployment state lists "${id}" as an app, but ${descriptor.path} is a host artifact.`,
        );

      releases.set(id, { id, descriptor, manifest });
    },
  });

  return Object.keys(state.apps).map((id) => releases.get(id)!);
}

function buildHostDeploymentManifest({
  registry,
  state,
  apps,
  hostId,
}: {
  registry: AtlasStaticRegistry;
  state: AtlasEnvironmentDeployment;
  apps: SelectedAppRelease[];
  hostId: string;
}): AtlasHostDeploymentManifest {
  const host = state.hosts[hostId];

  if (!host)
    throw new Error(
      `Atlas host "${hostId}" is not selected in environment "${state.environment}".`,
    );

  const content = {
    hostId,
    environment: state.environment,
    host: findReleaseDescriptor({
      registry,
      kind: 'host',
      id: hostId,
      version: host.version,
    }),
    apps: apps
      .filter((app) => doesAppTargetHost({ app, hostId }))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((app) => app.descriptor),
  };

  return {
    schemaVersion: 'v1' as const,
    kind: 'host-deployment' as const,
    ...content,
    deploymentRevision: computeRevisionOf(content),
  };
}

function doesAppTargetHost({
  app,
  hostId,
}: {
  app: SelectedAppRelease;
  hostId: string;
}): boolean {
  return app.manifest.placements.some((placement) =>
    placementTargetsHost(placement, hostId),
  );
}

function findReleaseDescriptor({
  registry,
  kind,
  id,
  version,
}: {
  registry: AtlasStaticRegistry;
  kind: ArtifactKind;
  id: string;
  version: string;
}): AtlasManifestDescriptor {
  const descriptor = (kind === 'app' ? registry.apps : registry.hosts)[id]
    ?.releases[version];
  if (!descriptor)
    throw new Error(
      `Atlas ${kind} "${id}" release "${version}" is missing from source artifact registry.`,
    );

  return descriptor;
}

function computeRevisionOf(value: unknown): `sha256:${string}` {
  return computeSha256Digest(stringifyCanonicalJson(value));
}
