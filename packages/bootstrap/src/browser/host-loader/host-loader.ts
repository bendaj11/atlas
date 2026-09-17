import { fetchJson } from '../fetch-json/index.js';
import type { HostModule } from '../host-module.js';
import { importModule } from '../module-shim/index.js';
import {
  validateArtifactUrl,
  validateHostManifest,
} from '../validation/index.js';
import { watchHostBuildNotifications } from './build-notifications/build-notifications.js';
import type {
  HostLoaderDependencies,
  LoadHostModuleOptions,
  RemoteMetadata,
} from './host-loader.types.js';
import { hostRemoteError } from './host-remote-error.js';
import { loadHostStyles } from './host-styles/host-styles.js';
import { installHostSharedDependencies } from './shared-dependencies/shared-dependencies.js';

export async function loadHostModule({
  manifest,
  runtime,
  dependencies = browserHostLoaderDependencies(),
}: LoadHostModuleOptions): Promise<HostModule> {
  dependencies.validateHostManifest({ manifest, runtime });

  const metadata = await dependencies.fetchJson<RemoteMetadata>({
    url: manifest.remoteEntryUrl,
    runtime,
    ...(manifest.integrity === undefined
      ? {}
      : { integrity: manifest.integrity }),
  });
  const expose = metadata.exposes?.find(
    (candidate) => candidate.key === manifest.exposes.entry,
  );

  if (!expose?.outFileName) {
    throw hostRemoteError(
      `Selected host remote entry "${manifest.remoteEntryUrl}" does not expose "${manifest.exposes.entry}".`,
    );
  }

  watchHostBuildNotifications({ metadata, manifest, dependencies });
  installHostSharedDependencies({ metadata, manifest, dependencies });
  loadHostStyles({ manifest, runtime, dependencies });

  const moduleUrl = new URL(expose.outFileName, manifest.remoteEntryUrl);

  dependencies.validateArtifactUrl({ url: moduleUrl, manifest, runtime });

  return dependencies.importModule({ url: moduleUrl.href });
}

function browserHostLoaderDependencies(): HostLoaderDependencies {
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
