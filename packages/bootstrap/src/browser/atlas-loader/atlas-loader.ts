import { HostMountFailedError } from '../../shared/errors/index.js';
import {
  ATLAS_RUNTIME_CONFIG_PATH,
  resolveAtlasHostRuntimeConfig,
  type AtlasHostCatalog,
  type AtlasHostRuntimeConfig,
} from '@atlas/schema';
import { requestDevelopmentSession } from '../development-session/index.js';
import { fetchBytes, fetchJson } from '../fetch-json/index.js';
import {
  loadHostModule,
  prefetchHostRemoteEntry,
  type PrefetchedHostRemoteEntry,
} from '../host-loader/index.js';
import type { HostEntry } from '../host-module.js';
import { installModuleShim } from '../module-shim/index.js';
import { applyOverrides } from '../overrides/index.js';
import { loadPublishedArtifact } from '../published-artifact/index.js';
import { validateCatalog } from '../validation/index.js';
import { HOST_ROOT_ELEMENT_ID } from './atlas-loader.constants.js';
import type { AtlasLoaderDependencies } from './atlas-loader.types.js';
import { preconnectArtifactRegistry } from './artifact-registry-preconnect/artifact-registry-preconnect.js';
import { preloadActiveRouteApp } from './route-app-preload/route-app-preload.js';
import { publishRuntimeSnapshot } from './runtime-snapshot/runtime-snapshot.js';
import { loadStartupCatalog } from './startup-catalog/startup-catalog.js';

export async function startAtlasLoader(
  dependencies: AtlasLoaderDependencies = createBrowserAtlasLoaderDependencies(),
): Promise<void> {
  const [, { runtime, catalog, hostRemoteEntry }] = await Promise.all([
    dependencies.installModuleShim(),
    resolveHostCatalog({ dependencies }),
  ]);

  const root = dependencies.document.getElementById(HOST_ROOT_ELEMENT_ID);

  if (!root) {
    throw new HostMountFailedError(
      `Atlas bootstrap page has no element with id="${HOST_ROOT_ELEMENT_ID}".`,
    );
  }

  const module = await dependencies.loadHostModule({
    manifest: catalog.host,
    runtime,
    ...(hostRemoteEntry ? { prefetchedRemoteEntry: hostRemoteEntry } : {}),
  });
  const entry: HostEntry = module.default?.mount ? module.default : module;

  if (typeof entry.mount !== 'function') {
    throw new HostMountFailedError(
      `Selected host client "${catalog.host.id}" does not export mount(request).`,
    );
  }

  const placeholder = Array.from(root.childNodes);

  await entry.mount({ container: root, runtimeConfig: runtime, catalog });

  for (const node of placeholder) if (node.parentNode === root) node.remove();
}

async function resolveHostCatalog({
  dependencies,
}: {
  dependencies: AtlasLoaderDependencies;
}): Promise<{
  runtime: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
  hostRemoteEntry?: PrefetchedHostRemoteEntry;
}> {
  const pageUrl = dependencies.location?.href ?? globalThis.location?.href;
  const runtime = resolveAtlasHostRuntimeConfig(
    await dependencies.fetchJson({ url: ATLAS_RUNTIME_CONFIG_PATH }),
    pageUrl,
  );

  if (pageUrl)
    preconnectArtifactRegistry({
      document: dependencies.document,
      runtime,
      pageUrl,
    });

  let hostRemoteEntry: PrefetchedHostRemoteEntry | undefined;
  const startup = await loadStartupCatalog({
    runtime,
    dependencies,
    onHostManifest: (manifest) => {
      hostRemoteEntry = dependencies.prefetchHostRemoteEntry({
        manifest,
        runtime,
      });
    },
  });

  const catalog = await dependencies.applyOverrides({
    runtime,
    catalog: startup.catalog,
    ...(startup.developmentSession === undefined
      ? {}
      : { developmentSession: startup.developmentSession }),
  });

  dependencies.validateCatalog({ runtime, catalog });

  if (pageUrl)
    preloadActiveRouteApp({
      document: dependencies.document,
      catalog,
      pageUrl,
    });

  publishRuntimeSnapshot({
    document: dependencies.document,
    runtime,
    catalog: startup.catalog,
  });

  return {
    runtime,
    catalog,
    ...(hostRemoteEntry ? { hostRemoteEntry } : {}),
  };
}

function createBrowserAtlasLoaderDependencies(): AtlasLoaderDependencies {
  return {
    document,
    location,
    fetchBytes,
    fetchJson,
    installModuleShim,
    loadHostModule,
    prefetchHostRemoteEntry,
    loadPublishedArtifact,
    requestDevelopmentSession,
    applyOverrides,
    validateCatalog,
    logError: (message, failure) => console.error(message, failure),
  };
}
