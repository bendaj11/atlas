import {
  placementTargetsHost,
  type AtlasAppArtifactManifest,
  type AtlasEnvironmentDeployment,
  type AtlasHostDeploymentManifest,
  type AtlasManifestDescriptor,
  type AtlasStaticRegistry,
} from '@atlas/schema';
import { canonicalJson } from '../../publication/index.js';
import { sha256Digest } from '../../shared/index.js';
import {
  environmentStatePath,
  hostManifestPath,
  publishedManifest,
  targetEnvironmentState,
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
}: {
  access: RegistryAccess;
  registry: AtlasStaticRegistry;
  environment: string;
  selected: ArtifactSelection;
}): Promise<DeploymentWrite> {
  const current = await targetEnvironmentState({ access, environment });
  const state = applySelection({ current, environment, selected });
  const manifests = await hostDeploymentManifests({
    access,
    registry,
    state,
    selected,
  });

  return { state, manifests };
}

export function deploymentPaths({
  environment,
  deployment,
}: {
  environment: string;
  deployment: DeploymentWrite;
}): string[] {
  return [
    environmentStatePath(environment),
    ...deployment.manifests.map(({ hostId }) =>
      hostManifestPath({ environment, hostId }),
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
    revision: revisionOf(content),
  };
}

async function hostDeploymentManifests({
  access,
  registry,
  state,
  selected,
}: {
  access: RegistryAccess;
  registry: AtlasStaticRegistry;
  state: AtlasEnvironmentDeployment;
  selected: ArtifactSelection;
}): Promise<AtlasHostDeploymentManifest[]> {
  const apps = await selectedApps({ access, registry, state });
  const hostIds =
    selected.kind === 'host'
      ? [selected.id]
      : Object.keys(state.hosts).filter((hostId) =>
          apps.some((app) => appTargetsHost({ app, hostId })),
        );

  return hostIds
    .sort()
    .map((hostId) => hostDeploymentManifest({ registry, state, apps, hostId }));
}

async function selectedApps({
  access,
  registry,
  state,
}: {
  access: RegistryAccess;
  registry: AtlasStaticRegistry;
  state: AtlasEnvironmentDeployment;
}): Promise<SelectedAppRelease[]> {
  return Promise.all(
    Object.entries(state.apps).map(async ([id, entry]) => {
      const descriptor = releaseDescriptor({
        registry,
        kind: 'app',
        id,
        version: entry.version,
      });
      const manifest = (await publishedManifest({
        access,
        descriptor,
      })) as AtlasAppArtifactManifest;

      return { id, descriptor, manifest };
    }),
  );
}

function hostDeploymentManifest({
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
    host: releaseDescriptor({
      registry,
      kind: 'host',
      id: hostId,
      version: host.version,
    }),
    apps: apps
      .filter((app) => appTargetsHost({ app, hostId }))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((app) => app.descriptor),
  };

  return {
    schemaVersion: 'v1' as const,
    kind: 'host-deployment' as const,
    ...content,
    deploymentRevision: revisionOf(content),
  };
}

function appTargetsHost({
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

function releaseDescriptor({
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

function revisionOf(value: unknown): `sha256:${string}` {
  return sha256Digest(canonicalJson(value));
}
