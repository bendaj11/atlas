import type {
  AtlasHostCatalog,
  AtlasHostDeploymentManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import { assertHostDeploymentManifest } from '@atlas/schema';
import { fetchBytes, fetchJson } from '../fetch-json/fetch-json.js';
import { loadHostModule } from '../host-loader/host-loader.js';
import { assertAtlasRuntimeConfig, environmentManifestUrl } from '../runtime-config/runtime-config.js';
import { installModuleShim } from '../module-shim/module-shim.js';
import { applyOverrides } from '../overrides/overrides.js';
import { loadPublishedArtifact } from '../published-artifact/published-artifact.js';
import { validateCatalog } from '../validation/validation.js';

const ARTIFACT_LOAD_CONCURRENCY = 6;
export const RUNTIME_SNAPSHOT_ELEMENT_ID = 'atlas-runtime-snapshot';

export interface AtlasLoaderDependencies {
  readonly document: Pick<
    Document,
    'createElement' | 'getElementById' | 'head'
  >;
  readonly fetchBytes: typeof fetchBytes;
  readonly fetchJson: typeof fetchJson;
  readonly installModuleShim: typeof installModuleShim;
  readonly loadHostModule: typeof loadHostModule;
  readonly loadPublishedArtifact: typeof loadPublishedArtifact;
  readonly applyOverrides: typeof applyOverrides;
  readonly validateCatalog: typeof validateCatalog;
}

export async function startAtlasLoader(
  dependencies: AtlasLoaderDependencies = defaultDependencies(),
): Promise<void> {
  await dependencies.installModuleShim();

  const runtime: unknown = await dependencies.fetchJson('/atlas.runtime.json');
  assertAtlasRuntimeConfig(runtime);
  const catalog = await loadInitialCatalog(runtime, dependencies);
  const effectiveCatalog = await dependencies.applyOverrides(runtime, catalog);

  dependencies.validateCatalog(runtime, effectiveCatalog);
  publishRuntimeSnapshot(dependencies.document, runtime, effectiveCatalog);

  const root = dependencies.document.getElementById('atlas-host-root');
  if (!root) throw new Error('Atlas host root is missing.');

  const module = await dependencies.loadHostModule(
    effectiveCatalog.host,
    runtime,
  );
  const entry = module.default?.mount ? module.default : module;
  if (typeof entry.mount !== 'function')
    throw new Error('Selected host client does not export mount(request).');

  root.replaceChildren();
  await entry.mount({
    container: root,
    runtimeConfig: runtime,
    catalog: effectiveCatalog,
  });
}

function publishRuntimeSnapshot(
  document: AtlasLoaderDependencies['document'],
  runtime: AtlasHostRuntimeConfig,
  catalog: AtlasHostCatalog,
): void {
  const existing = document.getElementById(RUNTIME_SNAPSHOT_ELEMENT_ID);
  const snapshot = JSON.stringify({ schemaVersion: '1', runtime, catalog });
  if (existing) {
    existing.textContent = snapshot;
    return;
  }
  const element = document.createElement('script');
  element.id = RUNTIME_SNAPSHOT_ELEMENT_ID;
  element.type = 'application/json';
  element.textContent = snapshot;
  document.head.append(element);
}

async function loadInitialCatalog(
  runtime: AtlasHostRuntimeConfig,
  dependencies: AtlasLoaderDependencies,
): Promise<AtlasHostCatalog> {
  return loadDeployment(runtime, dependencies);
}

function defaultDependencies(): AtlasLoaderDependencies {
  return {
    document,
    fetchBytes,
    fetchJson,
    installModuleShim,
    loadHostModule,
    loadPublishedArtifact,
    applyOverrides,
    validateCatalog,
  };
}

async function loadDeployment(
  runtime: AtlasHostRuntimeConfig,
  dependencies: AtlasLoaderDependencies,
): Promise<AtlasHostCatalog> {
  const deployment: unknown = JSON.parse(
    new TextDecoder().decode(
      await dependencies.fetchBytes(environmentManifestUrl(runtime), runtime),
    ),
  );
  try {
    assertHostDeploymentManifest(deployment);
  } catch {
    throw new Error('Active host manifest is invalid.');
  }
  if (
    deployment.hostId !== runtime.hostId ||
    deployment.environment !== runtime.environment
  ) {
    throw new Error('Active host manifest is invalid.');
  }

  const manifests = await mapWithConcurrency(
    deploymentReferences(deployment),
    (reference) => dependencies.loadPublishedArtifact(reference, runtime),
    ARTIFACT_LOAD_CONCURRENCY,
  );
  const host = manifests[0];
  if (!host || host.kind !== 'host') {
    throw new Error('Active host manifest does not select a host artifact.');
  }

  const appCount = deployment.apps.length;
  return {
    schemaVersion: '1',
    hostId: deployment.hostId,
    revision: deployment.deploymentRevision,
    generatedAt: '1970-01-01T00:00:00.000Z',
    host,
    apps: manifests.slice(1, 1 + appCount) as AtlasManifest[],
    ...(deployment.widgetProviders?.length
      ? { widgetProviders: manifests.slice(1 + appCount) as AtlasManifest[] }
      : {}),
  };
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  operation: (value: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  let nextIndex = 0;
  const results = new Array<R>(values.length);
  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value !== undefined) results[index] = await operation(value);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );
  return results;
}

function deploymentReferences(
  deployment: AtlasHostDeploymentManifest,
): AtlasHostDeploymentManifest['apps'] {
  return [
    deployment.host,
    ...deployment.apps,
    ...(deployment.widgetProviders ?? []),
  ];
}
