import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { fetchJson } from '../fetch-json/fetch-json.js';
import { importModule } from '../module-shim/module-shim.js';
import type { HostModule, RemoteMetadata } from '../types.js';
import {
  validateArtifactUrl,
  validateHostManifest,
} from '../validation/validation.js';

export async function loadHostModule(
  manifest: AtlasHostManifest,
  runtime: AtlasHostRuntimeConfig,
): Promise<HostModule> {
  validateHostManifest(manifest, runtime);

  const metadata = await fetchJson<RemoteMetadata>(
    manifest.remoteEntryUrl,
    runtime,
    manifest.integrity,
  );

  const expose = metadata.exposes?.find(
    (candidate) => candidate.key === manifest.exposes.entry,
  );
  if (!expose?.outFileName)
    throw new Error(
      'Selected host remote does not expose ' + manifest.exposes.entry + '.',
    );

  watchHostBuildNotifications(metadata, manifest.remoteEntryUrl);
  installHostSharedDependencies(metadata, manifest.remoteEntryUrl);

  const moduleUrl = new URL(expose.outFileName, manifest.remoteEntryUrl);
  validateArtifactUrl(moduleUrl, manifest, runtime);

  return importModule(moduleUrl.href);
}

function watchHostBuildNotifications(
  metadata: RemoteMetadata,
  remoteEntryUrl: string,
): void {
  if (!metadata.buildNotificationsEndpoint || !globalThis.EventSource) return;

  const source = new EventSource(
    new URL(metadata.buildNotificationsEndpoint, remoteEntryUrl),
  );
  source.onmessage = ({ data }) => {
    if (hasCompletedFederationBuild(data)) globalThis.location.reload();
  };
}

function hasCompletedFederationBuild(data: string): boolean {
  try {
    return JSON.parse(data).type === 'federation-rebuild-complete';
  } catch {
    return false;
  }
}

function installHostSharedDependencies(
  metadata: RemoteMetadata,
  remoteEntryUrl: string,
): void {
  if (!metadata.shared?.length) return;

  const imports: Record<string, string> = {};
  for (const shared of metadata.shared) {
    if (
      typeof shared.packageName !== 'string' ||
      typeof shared.outFileName !== 'string'
    ) {
      throw new Error(
        'Selected host remote contains invalid shared dependency metadata.',
      );
    }
    imports[shared.packageName] = new URL(
      shared.outFileName,
      remoteEntryUrl,
    ).href;
  }

  const importMap = document.createElement('script');
  importMap.type = 'importmap-shim';
  importMap.textContent = JSON.stringify({ imports });
  document.head.append(importMap);
}
