import {
  assertAtlasRuntimeConfig,
  environmentManifestUrl,
} from '@atlas/bootstrap/runtime';
import { hydratePublishedArtifactManifest } from '@atlas/schema';
import type {
  AtlasExtensionManifest as Manifest,
  AtlasHostData as HostData,
  AtlasOverrideDocument as OverrideDocument,
} from '../../../types/contracts.js';
import type { Scope } from '../../../types/app.js';

interface Descriptor {
  path: string;
  digest: string;
  size: number;
  mediaType: 'application/json';
}

interface RegistryArtifact {
  id: string;
  name: string;
  releases: Record<string, Descriptor>;
  previews: Record<string, Descriptor>;
  latest?: string;
}

interface Registry {
  schemaVersion: '2';
  apps: Record<string, RegistryArtifact>;
  hosts: Record<string, RegistryArtifact>;
}

interface ManifestReference extends Descriptor {
  url: string;
}

interface HostDeployment {
  schemaVersion: 'v1';
  kind: 'host-deployment';
  hostId: string;
  environment: string;
  deploymentRevision: string;
  host: ManifestReference;
  apps: ManifestReference[];
  widgetProviders?: ManifestReference[];
}

const FETCH_TIMEOUT_MS = 5_000;
const LOOKUP_CONCURRENCY = 8;
const CANONICAL_BUILD_ID = 'canonical';
const manifestReferences = new Map<string, ManifestReference>();
const loadedManifests = new Map<string, Promise<Manifest>>();

export async function inspectAtlasHost(documentKey: string): Promise<HostData> {
  const config = await readAtlasConfig();
  const catalog = await readHostDeployment(
    environmentManifestUrl(config),
    config.hostId,
    config.environment,
    config.artifactRegistryUrl,
  );
  const registryRoot = config.artifactRegistryUrl.replace(/\/$/, '');
  const registry = registryRoot ? await readRegistry(registryRoot) : undefined;
  if (catalog.hostId !== config.hostId) {
    throw new Error(
      `Atlas deployment targets host ${catalog.hostId}, but runtime configuration targets ${config.hostId}.`,
    );
  }

  const selectedArtifacts = [
    catalog.host,
    ...catalog.apps,
    ...(catalog.widgetProviders ?? []),
  ];
  const versionResults = await mapWithConcurrency(
    selectedArtifacts,
    (manifest) => readManifestVersions(manifest, registry, registryRoot),
    LOOKUP_CONCURRENCY,
  );
  const external = { providers: [], versions: [], errors: [] };
  const versions = Object.fromEntries([
    ...versionResults.map(({ entry }) => entry),
    ...external.versions,
  ]);
  const stored = readStoredOverrideDocument(documentKey, config.hostId);
  const overrides =
    stored.overrides ?? createLocalOverrides(config, selectedArtifacts);
  const displayCatalog = {
    ...catalog,
    widgetProviders: uniqueManifests([
      ...(catalog.widgetProviders ?? []),
      ...external.providers,
    ]),
  };

  return {
    config,
    pageUrl: location.href,
    catalog: displayCatalog,
    versions,
    overrides,
    overrideScope: stored.overrideScope,
    visibleAppIds: readVisibleAppIds(),
    runtimeErrors: readRuntimeErrors(),
    versionErrors: [
      ...versionResults.flatMap(({ error }) => (error ? [error] : [])),
      ...external.errors,
    ],
  };
}

async function readAtlasConfig(): Promise<HostData['config']> {
  const response = await fetchWithTimeout('/atlas.runtime.json');
  if (!response.ok) {
    throw new Error(`Atlas runtime config returned ${response.status}.`);
  }
  const value: unknown = await response.json();
  assertAtlasRuntimeConfig(value);
  return value as HostData['config'];
}

async function readHostDeployment(
  url: string,
  hostId: string,
  environment: string,
  artifactRegistryUrl: string,
): Promise<HostData['catalog']> {
  const response = await fetchWithTimeout(url);
  if (!response.ok)
    throw new Error(`Atlas host manifest returned ${response.status}.`);
  const deployment = (await response.json()) as HostDeployment;
  if (
    deployment.schemaVersion !== 'v1' ||
    deployment.kind !== 'host-deployment' ||
    deployment.hostId !== hostId ||
    deployment.environment !== environment ||
    !deployment.host ||
    !Array.isArray(deployment.apps)
  ) {
    throw new Error('Atlas host manifest returned invalid data.');
  }
  const references = [
    deployment.host,
    ...deployment.apps,
    ...(deployment.widgetProviders ?? []),
  ];
  const manifests = await mapWithConcurrency(
    references,
    (descriptor) =>
      loadManifestReference(reference(artifactRegistryUrl, descriptor)),
    LOOKUP_CONCURRENCY,
  );
  const host = manifests[0];
  if (!host || host.kind !== 'host')
    throw new Error('Host selection is invalid.');
  const appCount = deployment.apps.length;
  return {
    schemaVersion: '1',
    hostId: deployment.hostId,
    revision: deployment.deploymentRevision,
    environment: deployment.environment,
    host,
    apps: manifests.slice(1, 1 + appCount),
    ...(deployment.widgetProviders?.length
      ? { widgetProviders: manifests.slice(1 + appCount) }
      : {}),
  };
}

async function readRegistry(root: string): Promise<Registry> {
  const response = await fetchWithTimeout(`${root}/registry.json`);
  if (!response.ok)
    throw new Error(`Atlas registry returned ${response.status}.`);
  const registry = (await response.json()) as Registry;
  if (
    registry.schemaVersion !== '2' ||
    typeof registry.apps !== 'object' ||
    typeof registry.hosts !== 'object'
  ) {
    throw new Error('Atlas registry returned invalid data.');
  }
  return registry;
}

async function readManifestVersions(
  manifest: Manifest,
  registry: Registry | undefined,
  root: string | undefined,
): Promise<{ entry: readonly [string, Manifest[]]; error?: string }> {
  if (!registry || !root) {
    return { entry: [manifestKey(manifest), [manifest]] };
  }
  try {
    const artifact =
      manifest.kind === 'host'
        ? registry.hosts[manifest.id]
        : registry.apps[manifest.id];
    if (!artifact)
      throw new Error(`Artifact ${manifest.id} is not registered.`);
    return {
      entry: [manifestKey(manifest), versionOptions(manifest, artifact, root)],
    };
  } catch (error) {
    return {
      entry: [manifestKey(manifest), [manifest]],
      error: messageFromError(error),
    };
  }
}

async function loadManifestReference(
  descriptor: ManifestReference,
): Promise<Manifest> {
  return loadCachedManifest(descriptor);
}

export async function loadArtifactVersion(
  artifactKey: string,
  versionKey: string,
): Promise<Manifest> {
  const descriptor = manifestReferences.get(`${artifactKey}:${versionKey}`);
  if (!descriptor) throw new Error('Selected artifact version is unavailable.');
  const manifest = await loadCachedManifest(descriptor);
  if (
    manifestKey(manifest) !== artifactKey ||
    versionKeyFor(manifest) !== versionKey
  )
    throw new Error(
      'Selected artifact manifest does not match its registry entry.',
    );
  return manifest;
}

function versionOptions(
  selectedManifest: Manifest,
  artifact: RegistryArtifact,
  root: string,
): Manifest[] {
  const artifactKey = manifestKey(selectedManifest);
  const releases = orderedReleases(artifact).map(([version, descriptor]) =>
    registerVersionOption({
      artifactKey,
      manifest: {
        ...selectedManifest,
        version,
        buildId: CANONICAL_BUILD_ID,
        channel: 'production',
      },
      descriptor: reference(root, descriptor),
    }),
  );
  const previews = orderedPreviews(artifact).map(
    ([previewNumber, descriptor]) => {
      const {
        gitSha: _gitSha,
        gitBranch: _gitBranch,
        gitCommitTitle: _gitCommitTitle,
        ...manifestWithoutSource
      } = selectedManifest;
      return registerVersionOption({
        artifactKey,
        manifest: {
          ...manifestWithoutSource,
          version: `preview-${previewNumber}`,
          buildId: CANONICAL_BUILD_ID,
          channel: 'pr',
          prNumber: Number(previewNumber),
        },
        descriptor: reference(root, descriptor),
      });
    },
  );
  return uniqueManifests([...releases, ...previews]);
}

function orderedReleases(
  artifact: RegistryArtifact,
): Array<[string, Descriptor]> {
  return Object.entries(artifact.releases).sort(([left], [right]) => {
    if (left === artifact.latest) return -1;
    if (right === artifact.latest) return 1;
    return right.localeCompare(left, undefined, { numeric: true });
  });
}

function orderedPreviews(
  artifact: RegistryArtifact,
): Array<[string, Descriptor]> {
  return Object.entries(artifact.previews).sort(
    ([left], [right]) => Number(right) - Number(left),
  );
}

function registerVersionOption(options: {
  artifactKey: string;
  manifest: Manifest;
  descriptor: ManifestReference;
}): Manifest {
  manifestReferences.set(
    `${options.artifactKey}:${versionKeyFor(options.manifest)}`,
    options.descriptor,
  );
  return options.manifest;
}

function loadCachedManifest(descriptor: ManifestReference): Promise<Manifest> {
  const cached = loadedManifests.get(descriptor.digest);
  if (cached) return cached;
  const manifest = fetchManifestReference(descriptor);
  loadedManifests.set(descriptor.digest, manifest);
  return manifest;
}

async function fetchManifestReference(
  descriptor: ManifestReference,
): Promise<Manifest> {
  const response = await fetchWithTimeout(descriptor.url, 'force-cache');
  if (!response.ok)
    throw new Error(`${descriptor.url} returned ${response.status}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await assertDescriptor(descriptor, bytes);
  return hydratePublishedArtifactManifest(
    JSON.parse(new TextDecoder().decode(bytes)),
    descriptor.url,
  ) as Manifest;
}

function readStoredOverrideDocument(
  documentKey: string,
  hostId: string,
): {
  overrides: OverrideDocument | undefined;
  overrideScope: Scope | undefined;
} {
  const tabStored = sessionStorage.getItem(documentKey);
  const stored = tabStored ?? localStorage.getItem(documentKey);
  if (!stored) return { overrides: undefined, overrideScope: undefined };
  try {
    const overrides = JSON.parse(stored) as OverrideDocument;
    return {
      overrides:
        overrides.schemaVersion === '1' && overrides.hostId === hostId
          ? overrides
          : undefined,
      overrideScope: tabStored ? 'tab' : 'all',
    };
  } catch {
    return { overrides: undefined, overrideScope: tabStored ? 'tab' : 'all' };
  }
}

function createLocalOverrides(
  config: HostData['config'],
  manifests: Manifest[],
): OverrideDocument | undefined {
  const local = manifests.filter(({ channel }) => channel === 'local');
  if (!local.length) return undefined;
  const host = local.find(({ kind }) => kind === 'host');
  return {
    schemaVersion: '1',
    hostId: config.hostId,
    generatedAt: new Date().toISOString(),
    ...(host ? { hostOverride: host } : {}),
    overrides: local
      .filter(({ kind }) => kind === 'app')
      .map((manifest) => ({ appId: manifest.id, manifest, reason: 'local' })),
  };
}

function readRuntimeErrors(): HostData['runtimeErrors'] {
  return [
    ...document.querySelectorAll<HTMLElement>('[data-atlas-state="error"]'),
  ].map((element) => {
    const appId =
      element.getAttribute('data-atlas-app-id') ??
      element.getAttribute('data-atlas-app');
    const message = element.textContent?.trim() || 'Unknown app error';
    const artifactId = appId ? `app:${appId}` : undefined;
    return { ...(artifactId ? { artifactId } : {}), message };
  });
}

function readVisibleAppIds(): string[] {
  return [
    ...new Set(
      [...document.querySelectorAll<HTMLElement>('[data-atlas-app-id]')]
        .map((element) => element.getAttribute('data-atlas-app-id'))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

async function fetchWithTimeout(
  input: string | URL,
  cache: RequestCache = 'no-store',
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { cache, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function assertDescriptor(
  descriptor: Descriptor,
  bytes: Uint8Array,
): Promise<void> {
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
  );
  const digest = `sha256:${[...hash]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
  if (descriptor.size !== bytes.byteLength || descriptor.digest !== digest) {
    throw new Error(`${descriptor.path} failed descriptor verification.`);
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  operation: (value: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < values.length) {
      const index = next++;
      results[index] = await operation(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(values.length, concurrency) }, worker),
  );
  return results;
}

function reference(root: string, descriptor: Descriptor): ManifestReference {
  return { ...descriptor, url: new URL(descriptor.path, `${root}/`).href };
}

function manifestKey(manifest: Manifest): string {
  return `${manifest.kind}:${manifest.id}`;
}

function uniqueManifests(manifests: Manifest[]): Manifest[] {
  return [
    ...new Map(
      manifests.map((manifest) => [
        `${manifest.kind}:${manifest.id}:${manifest.channel}:${manifest.version}`,
        manifest,
      ]),
    ).values(),
  ];
}

function versionKeyFor(manifest: Manifest): string {
  return `${manifest.channel}:${manifest.version}:${manifest.buildId}`;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
