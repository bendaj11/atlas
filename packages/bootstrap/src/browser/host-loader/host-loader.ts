import { HostRemoteInvalidError } from '../../shared/errors/index.js';
import { fetchJson } from '../fetch-json/index.js';
import type { HostModule } from '../host-module.js';
import { importModule } from '../module-shim/index.js';
import {
  validateArtifactUrl,
  validateHostManifest,
} from '../validation/index.js';
import { watchHostBuildNotifications } from './build-notifications/build-notifications.js';
import type {
  HostLoadContext,
  HostLoaderDependencies,
  LoadHostModuleOptions,
} from './host-loader.types.js';
import { loadHostStyles } from './host-styles/host-styles.js';
import { installHostSharedDependencies } from './shared-dependencies/shared-dependencies.js';
import { validateIntegrity } from './validate-integrity/validate-integrity.js';

export async function loadHostModule({
  manifest,
  runtime,
  dependencies = createBrowserHostLoaderDependencies(),
}: LoadHostModuleOptions): Promise<HostModule> {
  dependencies.validateHostManifest({ manifest, runtime });

  const removeHostStyles = loadHostStyles({ manifest, runtime, dependencies });

  try {
    return await importHostEntry({ manifest, runtime, dependencies });
  } catch (error) {
    removeHostStyles();

    throw error;
  }
}

async function importHostEntry({
  manifest,
  runtime,
  dependencies,
}: HostLoadContext): Promise<HostModule> {
  const { integrity } = manifest;
  const metadata = await dependencies.fetchJson({
    url: manifest.remoteEntryUrl,
    runtime,
    ...(integrity === undefined
      ? {}
      : { verify: (bytes) => validateIntegrity(bytes, integrity) }),
  });
  const expose = metadata.exposes?.find(
    (candidate) => candidate.key === manifest.exposes.entry,
  );

  if (!expose?.outFileName) {
    throw new HostRemoteInvalidError(
      `Selected host remote entry "${manifest.remoteEntryUrl}" does not expose "${manifest.exposes.entry}".`,
    );
  }

  watchHostBuildNotifications({ metadata, manifest, dependencies });
  installHostSharedDependencies({ metadata, manifest, dependencies });

  const moduleUrl = new URL(expose.outFileName, manifest.remoteEntryUrl);

  dependencies.validateArtifactUrl({ url: moduleUrl, manifest, runtime });

  return dependencies.importModule({ url: moduleUrl.href });
}

function createBrowserHostLoaderDependencies(): HostLoaderDependencies {
  return {
    document,
    fetchJson,
    importModule,
    validateArtifactUrl,
    validateHostManifest,
    ...(globalThis.EventSource
      ? { createEventSource: (url: URL) => new EventSource(url) }
      : {}),
    reloadPage: () => globalThis.location.reload(),
  };
}
