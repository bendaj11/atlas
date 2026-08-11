import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasStylesheet,
} from '@atlas/schema';
import { fetchJson } from '../fetch-json/fetch-json.js';
import { importModule } from '../module-shim/module-shim.js';
import type { HostModule, RemoteMetadata } from '../types.js';
import {
  validateArtifactUrl,
  validateHostManifest,
} from '../validation/validation.js';

export interface HostLoaderDependencies {
  readonly document: Document;
  readonly fetchJson: typeof fetchJson;
  readonly importModule: typeof importModule;
  readonly validateArtifactUrl: typeof validateArtifactUrl;
  readonly validateHostManifest: typeof validateHostManifest;
}

export async function loadHostModule(
  manifest: AtlasHostManifest,
  runtime: AtlasHostRuntimeConfig,
  dependencies: HostLoaderDependencies = defaultDependencies(),
): Promise<HostModule> {
  dependencies.validateHostManifest(manifest, runtime);

  const metadata = await dependencies.fetchJson<RemoteMetadata>(
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
  installHostSharedDependencies(
    metadata,
    manifest.remoteEntryUrl,
    dependencies.document,
  );
  loadHostStyles(manifest, runtime, dependencies);

  const moduleUrl = new URL(expose.outFileName, manifest.remoteEntryUrl);
  dependencies.validateArtifactUrl(moduleUrl, manifest, runtime);

  return dependencies.importModule(moduleUrl.href);
}

function defaultDependencies(): HostLoaderDependencies {
  return {
    document,
    fetchJson,
    importModule,
    validateArtifactUrl,
    validateHostManifest,
  };
}

function loadHostStyles(
  manifest: AtlasHostManifest,
  runtime: AtlasHostRuntimeConfig,
  dependencies: HostLoaderDependencies,
): void {
  manifest.styles?.forEach((stylesheet) =>
    appendHostStylesheet({ stylesheet, manifest, runtime, dependencies }),
  );
}

function appendHostStylesheet(input: {
  readonly stylesheet: AtlasStylesheet;
  readonly manifest: AtlasHostManifest;
  readonly runtime: AtlasHostRuntimeConfig;
  readonly dependencies: HostLoaderDependencies;
}): void {
  const { stylesheet, manifest, runtime, dependencies } = input;
  dependencies.validateArtifactUrl(new URL(stylesheet.href), manifest, runtime);

  const element = dependencies.document.createElement('link');
  element.rel = 'stylesheet';
  element.href = stylesheet.href;
  if (stylesheet.integrity) {
    element.integrity = stylesheet.integrity;
    element.crossOrigin = 'anonymous';
  }
  dependencies.document.head.append(element);
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
  document: Document,
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
