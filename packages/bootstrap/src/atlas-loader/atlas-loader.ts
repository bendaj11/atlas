import type {
  AtlasHostCatalog,
  AtlasHostDeploymentManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import { assertHostDeploymentManifest } from '@atlas/schema';
import {
  assertAtlasBootstrapManifest,
  type AtlasBootstrapManifest,
} from '../bootstrap/bootstrap-manifest.js';
import { fetchBytes, fetchJson } from '../fetch-json/fetch-json.js';
import { loadHostModule } from '../host-loader/host-loader.js';
import {
  atlasDiscoveryRequest,
  resolveAtlasHostRuntime,
} from '../runtime-resolution/runtime-resolution.js';
import { installModuleShim } from '../module-shim/module-shim.js';
import { applyOverrides } from '../overrides/overrides.js';
import { loadPublishedArtifact } from '../published-artifact/published-artifact.js';
import { validateCatalog } from '../validation/validation.js';
import type { DevSession } from '../types.js';

const ARTIFACT_LOAD_CONCURRENCY = 6;

export interface AtlasLoaderDependencies {
  readonly document: Pick<Document, 'getElementById'>;
  readonly locationHref: string;
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

  const bootstrap: unknown = await dependencies.fetchJson(
    '/atlas.bootstrap.json',
  );
  assertAtlasBootstrapManifest(bootstrap);
  const runtime = await resolveRuntime(bootstrap, dependencies);
  const catalog = await loadInitialCatalog(runtime, dependencies);
  const effectiveCatalog = await dependencies.applyOverrides(runtime, catalog);

  dependencies.validateCatalog(runtime, effectiveCatalog);

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

async function loadInitialCatalog(
  runtime: AtlasHostRuntimeConfig,
  dependencies: AtlasLoaderDependencies,
): Promise<AtlasHostCatalog> {
  if (!runtime.developmentSessionUrl) {
    return loadDeployment(runtime, dependencies);
  }

  const session = await dependencies.fetchJson<DevSession>(
    runtime.developmentSessionUrl,
    runtime,
  );
  if (!session.catalog) {
    throw new Error('Atlas development session has no host catalog.');
  }
  return session.catalog;
}

function defaultDependencies(): AtlasLoaderDependencies {
  return {
    document,
    locationHref: location.href,
    fetchBytes,
    fetchJson,
    installModuleShim,
    loadHostModule,
    loadPublishedArtifact,
    applyOverrides,
    validateCatalog,
  };
}

async function resolveRuntime(
  bootstrap: AtlasBootstrapManifest,
  dependencies: AtlasLoaderDependencies,
): Promise<AtlasHostRuntimeConfig> {
  if (bootstrap.developmentRuntime) return bootstrap.developmentRuntime;
  const request = atlasDiscoveryRequest(bootstrap);
  if (!request) throw new Error('Atlas discovery request is unavailable.');
  const discovery: unknown = await dependencies.fetchJson(
    request.url,
    request.runtime,
  );
  return resolveAtlasHostRuntime(
    bootstrap,
    discovery,
    dependencies.locationHref,
  );
}

async function loadDeployment(
  runtime: AtlasHostRuntimeConfig,
  dependencies: AtlasLoaderDependencies,
): Promise<AtlasHostCatalog> {
  const deployment: unknown = JSON.parse(
    new TextDecoder().decode(
      await dependencies.fetchBytes(runtime.manifestUrl, runtime),
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
