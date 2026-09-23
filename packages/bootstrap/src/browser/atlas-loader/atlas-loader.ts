import { HostMountFailedError } from '../../shared/errors/index.js';
import {
  ATLAS_RUNTIME_CONFIG_PATH,
  resolveAtlasHostRuntimeConfig,
} from '@atlas/schema';
import { fetchBytes, fetchJson } from '../fetch-json/index.js';
import { loadHostModule } from '../host-loader/index.js';
import type { HostEntry } from '../host-module.js';
import { installModuleShim } from '../module-shim/index.js';
import { applyOverrides } from '../overrides/index.js';
import { loadPublishedArtifact } from '../published-artifact/index.js';
import { validateCatalog } from '../validation/index.js';
import { HOST_ROOT_ELEMENT_ID } from './atlas-loader.constants.js';
import type { AtlasLoaderDependencies } from './atlas-loader.types.js';
import { publishRuntimeSnapshot } from './runtime-snapshot/runtime-snapshot.js';
import { loadStartupCatalog } from './startup-catalog/startup-catalog.js';

export async function startAtlasLoader(
  dependencies: AtlasLoaderDependencies = createBrowserAtlasLoaderDependencies(),
): Promise<void> {
  await dependencies.installModuleShim();

  const runtime = resolveAtlasHostRuntimeConfig(
    await dependencies.fetchJson({ url: ATLAS_RUNTIME_CONFIG_PATH }),
    dependencies.location?.href ?? globalThis.location?.href,
  );

  const startup = await loadStartupCatalog({ runtime, dependencies });

  const catalog = await dependencies.applyOverrides({
    runtime,
    catalog: startup.catalog,
    ...(startup.developmentSession === undefined
      ? {}
      : { developmentSession: startup.developmentSession }),
  });

  dependencies.validateCatalog({ runtime, catalog });

  publishRuntimeSnapshot({ document: dependencies.document, runtime, catalog });

  const root = dependencies.document.getElementById(HOST_ROOT_ELEMENT_ID);

  if (!root) {
    throw new HostMountFailedError(
      `Atlas bootstrap page has no element with id="${HOST_ROOT_ELEMENT_ID}".`,
    );
  }

  const module = await dependencies.loadHostModule({
    manifest: catalog.host,
    runtime,
  });
  const entry: HostEntry = module.default?.mount ? module.default : module;

  if (typeof entry.mount !== 'function') {
    throw new HostMountFailedError(
      `Selected host client "${catalog.host.id}" does not export mount(request).`,
    );
  }

  root.replaceChildren();

  await entry.mount({ container: root, runtimeConfig: runtime, catalog });
}

function createBrowserAtlasLoaderDependencies(): AtlasLoaderDependencies {
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
