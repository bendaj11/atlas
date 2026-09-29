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
  PrefetchedHostRemoteEntry,
  PrefetchHostRemoteEntryOptions,
  RemoteMetadata,
} from './host-loader.types.js';
import { loadHostStyles } from './host-styles/host-styles.js';
import { installHostSharedDependencies } from './shared-dependencies/shared-dependencies.js';
import { validateIntegrity } from './validate-integrity/validate-integrity.js';

export function prefetchHostRemoteEntry({
  manifest,
  runtime,
  dependencies = createBrowserHostLoaderDependencies(),
}: PrefetchHostRemoteEntryOptions): PrefetchedHostRemoteEntry | undefined {
  try {
    dependencies.validateHostManifest({ manifest, runtime });

    const metadata = fetchRemoteEntry({ manifest, runtime, dependencies });

    metadata.catch(() => undefined);

    return { manifest, metadata };
  } catch {
    return undefined;
  }
}

export async function loadHostModule({
  manifest,
  runtime,
  prefetchedRemoteEntry,
  dependencies = createBrowserHostLoaderDependencies(),
}: LoadHostModuleOptions): Promise<HostModule> {
  dependencies.validateHostManifest({ manifest, runtime });

  const removals = [loadHostStyles({ manifest, runtime, dependencies })];
  const discard = () => {
    for (const remove of removals) remove();
  };

  try {
    return await importHostEntry({
      manifest,
      runtime,
      dependencies,
      onSharedDependenciesInstalled: (remove) => removals.push(remove),
      ...(prefetchedRemoteEntry ? { prefetchedRemoteEntry } : {}),
    });
  } catch (error) {
    discard();

    throw error;
  }
}

async function importHostEntry({
  manifest,
  runtime,
  dependencies,
  prefetchedRemoteEntry,
  onSharedDependenciesInstalled,
}: HostLoadContext & {
  prefetchedRemoteEntry?: PrefetchedHostRemoteEntry;
  onSharedDependenciesInstalled: (remove: () => void) => void;
}): Promise<HostModule> {
  const metadata = await readRemoteEntry({
    manifest,
    runtime,
    dependencies,
    ...(prefetchedRemoteEntry ? { prefetchedRemoteEntry } : {}),
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
  onSharedDependenciesInstalled(
    installHostSharedDependencies({ metadata, manifest, dependencies }),
  );

  const moduleUrl = new URL(expose.outFileName, manifest.remoteEntryUrl);

  dependencies.validateArtifactUrl({ url: moduleUrl, manifest, runtime });

  return dependencies.importModule({ url: moduleUrl.href });
}

async function readRemoteEntry({
  manifest,
  runtime,
  dependencies,
  prefetchedRemoteEntry,
}: HostLoadContext & {
  prefetchedRemoteEntry?: PrefetchedHostRemoteEntry;
}): Promise<RemoteMetadata> {
  if (
    prefetchedRemoteEntry &&
    prefetchedRemoteEntry.manifest.remoteEntryUrl === manifest.remoteEntryUrl &&
    prefetchedRemoteEntry.manifest.integrity === manifest.integrity
  ) {
    try {
      return await prefetchedRemoteEntry.metadata;
    } catch {
      return fetchRemoteEntry({ manifest, runtime, dependencies });
    }
  }

  return fetchRemoteEntry({ manifest, runtime, dependencies });
}

function fetchRemoteEntry({
  manifest,
  runtime,
  dependencies,
}: HostLoadContext): Promise<RemoteMetadata> {
  const { integrity } = manifest;

  return dependencies.fetchJson({
    url: manifest.remoteEntryUrl,
    runtime,
    ...(integrity === undefined
      ? {}
      : { verify: (bytes) => validateIntegrity(bytes, integrity) }),
  });
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
