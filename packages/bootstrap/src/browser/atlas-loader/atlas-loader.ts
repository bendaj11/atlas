import type {
  AtlasHostCatalog,
  AtlasHostDeploymentManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import { assertHostDeploymentManifest } from '@atlas/schema';
import { errorSummary } from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/bootstrap-error.js';
import { fetchBytes, fetchJson } from '../fetch-json/fetch-json.js';
import { loadHostModule } from '../host-loader/host-loader.js';
import {
  ATLAS_RUNTIME_CONFIG_PATH,
  environmentManifestUrl,
  resolveAtlasRuntimeConfig,
} from '../../shared/runtime-config/runtime-config.js';
import { installModuleShim } from '../module-shim/module-shim.js';
import { applyOverrides, type DevSession } from '../overrides/overrides.js';
import { loadPublishedArtifact } from '../published-artifact/published-artifact.js';
import { decodeJson } from '../../shared/decode-json.js';
import { validateCatalog } from '../validation/validation.js';

const ARTIFACT_LOAD_CONCURRENCY = 6;
export const RUNTIME_SNAPSHOT_ELEMENT_ID = 'atlas-runtime-snapshot';

export interface AtlasLoaderDependencies {
  readonly document: Pick<
    Document,
    'createElement' | 'getElementById' | 'head'
  >;
  readonly location?: Pick<Location, 'href'>;
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

  const runtime = resolveAtlasRuntimeConfig(
    await dependencies.fetchJson({ url: ATLAS_RUNTIME_CONFIG_PATH }),
    dependencies.location?.href ?? globalThis.location?.href,
  );
  const startup = await loadStartupCatalog({ runtime, dependencies });
  const effectiveCatalog = await dependencies.applyOverrides({
    runtime,
    catalog: startup.catalog,
    ...(startup.developmentSession === undefined
      ? {}
      : { developmentSession: startup.developmentSession }),
  });

  dependencies.validateCatalog({ runtime, catalog: effectiveCatalog });
  publishRuntimeSnapshot({
    document: dependencies.document,
    runtime,
    catalog: effectiveCatalog,
  });

  const root = dependencies.document.getElementById('atlas-host-root');
  if (!root)
    throw bootstrapError({
      code: 'HOST_MOUNT_FAILED',
      message: 'Atlas bootstrap page has no element with id="atlas-host-root".',
    });

  const module = await dependencies.loadHostModule({
    manifest: effectiveCatalog.host,
    runtime,
  });
  const entry = module.default?.mount ? module.default : module;
  if (typeof entry.mount !== 'function')
    throw bootstrapError({
      code: 'HOST_MOUNT_FAILED',
      message: `Selected host client "${effectiveCatalog.host.id}" does not export mount(request).`,
    });

  root.replaceChildren();
  await entry.mount({
    container: root,
    runtimeConfig: runtime,
    catalog: effectiveCatalog,
  });
}

function publishRuntimeSnapshot({
  document,
  runtime,
  catalog,
}: {
  document: AtlasLoaderDependencies['document'];
  runtime: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
}): void {
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

interface LoaderContext {
  runtime: AtlasHostRuntimeConfig;
  dependencies: AtlasLoaderDependencies;
}

async function loadStartupCatalog({
  runtime,
  dependencies,
}: LoaderContext): Promise<{
  catalog: AtlasHostCatalog;
  developmentSession?: DevSession;
}> {
  if (!runtime.developmentSessionUrl) {
    return { catalog: await loadDeployment({ runtime, dependencies }) };
  }
  const developmentSession = await dependencies.fetchJson<DevSession>({
    url: runtime.developmentSessionUrl,
    runtime,
  });
  if (!developmentSession.catalog) {
    throw bootstrapError({
      code: 'CATALOG_INVALID',
      message: `Atlas development session at "${runtime.developmentSessionUrl}" does not include a host catalog.`,
    });
  }
  return { catalog: developmentSession.catalog, developmentSession };
}

function defaultDependencies(): AtlasLoaderDependencies {
  return {
    document,
    location,
    fetchBytes,
    fetchJson,
    installModuleShim,
    loadHostModule,
    loadPublishedArtifact,
    applyOverrides,
    validateCatalog,
  };
}

async function loadDeployment({
  runtime,
  dependencies,
}: LoaderContext): Promise<AtlasHostCatalog> {
  const deployment = decodeJson(
    await dependencies.fetchBytes({
      url: environmentManifestUrl(runtime),
      runtime,
    }),
  );
  try {
    assertHostDeploymentManifest(deployment);
  } catch (cause) {
    throw bootstrapError({
      code: 'DEPLOYMENT_INVALID',
      message: `Atlas deployment manifest at "${environmentManifestUrl(runtime)}" is invalid: ${errorSummary(cause instanceof Error ? cause.message : String(cause))}`,
      cause,
    });
  }
  if (
    deployment.hostId !== runtime.hostId ||
    deployment.environment !== runtime.environment
  ) {
    throw bootstrapError({
      code: 'DEPLOYMENT_INVALID',
      message: `Atlas deployment manifest targets host "${deployment.hostId}" in environment "${deployment.environment}" but runtime selects host "${runtime.hostId}" in environment "${runtime.environment}".`,
    });
  }

  const manifests = await mapWithConcurrency({
    values: deploymentReferences(deployment),
    operation: (reference) =>
      dependencies.loadPublishedArtifact({ reference, runtime }),
    concurrency: ARTIFACT_LOAD_CONCURRENCY,
  });
  const host = manifests[0];
  if (!host || host.kind !== 'host') {
    throw bootstrapError({
      code: 'DEPLOYMENT_INVALID',
      message: `Atlas deployment manifest host reference "${deployment.host.path}" does not resolve to a host manifest.`,
    });
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

async function mapWithConcurrency<T, R>({
  values,
  operation,
  concurrency,
}: {
  values: readonly T[];
  operation: (value: T) => Promise<R>;
  concurrency: number;
}): Promise<R[]> {
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
