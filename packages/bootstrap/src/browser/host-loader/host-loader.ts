import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasStylesheet,
} from '@atlas/schema';
import { fetchJson } from '../fetch-json/fetch-json.js';
import { bootstrapError } from '../../shared/errors/bootstrap-error.js';
import { importModule } from '../module-shim/module-shim.js';
import type { HostModule } from '../host-module.js';
import {
  validateArtifactUrl,
  validateHostManifest,
} from '../validation/validation.js';

export interface RemoteMetadata {
  buildNotificationsEndpoint?: string;
  exposes?: Array<{ key?: string; outFileName?: string }>;
  shared?: Array<{ packageName?: string; outFileName?: string }>;
}

export interface HostLoaderDependencies {
  readonly document: Pick<Document, 'createElement' | 'head'>;
  readonly fetchJson: typeof fetchJson;
  readonly importModule: typeof importModule;
  readonly validateArtifactUrl: typeof validateArtifactUrl;
  readonly validateHostManifest: typeof validateHostManifest;
  readonly createEventSource?: (url: URL) => Pick<EventSource, 'onmessage'>;
  readonly reloadPage: () => void;
}

export interface LoadHostModuleOptions {
  manifest: AtlasHostManifest;
  runtime: AtlasHostRuntimeConfig;
  dependencies?: HostLoaderDependencies;
}

export async function loadHostModule({
  manifest,
  runtime,
  dependencies = defaultDependencies(),
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
  if (!expose?.outFileName)
    throw bootstrapError({
      code: 'HOST_REMOTE_INVALID',
      message: `Selected host remote entry "${manifest.remoteEntryUrl}" does not expose "${manifest.exposes.entry}".`,
    });

  watchHostBuildNotifications({ metadata, manifest, dependencies });
  installHostSharedDependencies({ metadata, manifest, dependencies });
  loadHostStyles({ manifest, runtime, dependencies });

  const moduleUrl = new URL(expose.outFileName, manifest.remoteEntryUrl);
  dependencies.validateArtifactUrl({ url: moduleUrl, manifest, runtime });

  return dependencies.importModule({ url: moduleUrl.href });
}

function defaultDependencies(): HostLoaderDependencies {
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

interface HostLoadContext {
  manifest: AtlasHostManifest;
  runtime: AtlasHostRuntimeConfig;
  dependencies: HostLoaderDependencies;
}

function loadHostStyles(context: HostLoadContext): void {
  context.manifest.styles?.forEach((stylesheet) =>
    appendHostStylesheet({ ...context, stylesheet }),
  );
}

function appendHostStylesheet({
  stylesheet,
  manifest,
  runtime,
  dependencies,
}: HostLoadContext & { stylesheet: AtlasStylesheet }): void {
  dependencies.validateArtifactUrl({
    url: new URL(stylesheet.href),
    manifest,
    runtime,
  });

  const element = dependencies.document.createElement('link');
  element.rel = 'stylesheet';
  element.href = stylesheet.href;
  if (stylesheet.integrity) {
    element.integrity = stylesheet.integrity;
    element.crossOrigin = 'anonymous';
  }
  dependencies.document.head.append(element);
}

function watchHostBuildNotifications({
  metadata,
  manifest,
  dependencies,
}: Pick<HostLoadContext, 'manifest' | 'dependencies'> & {
  metadata: RemoteMetadata;
}): void {
  if (!metadata.buildNotificationsEndpoint || !dependencies.createEventSource)
    return;

  const source = dependencies.createEventSource(
    new URL(metadata.buildNotificationsEndpoint, manifest.remoteEntryUrl),
  );
  source.onmessage = ({ data }) => {
    if (hasCompletedFederationBuild(data)) dependencies.reloadPage();
  };
}

function hasCompletedFederationBuild(data: string): boolean {
  try {
    return JSON.parse(data).type === 'federation-rebuild-complete';
  } catch {
    return false;
  }
}

function installHostSharedDependencies({
  metadata,
  manifest,
  dependencies,
}: Pick<HostLoadContext, 'manifest' | 'dependencies'> & {
  metadata: RemoteMetadata;
}): void {
  if (!metadata.shared?.length) return;
  const { remoteEntryUrl } = manifest;
  const { document } = dependencies;

  const imports: Record<string, string> = {};
  for (const shared of metadata.shared) {
    if (
      typeof shared.packageName !== 'string' ||
      typeof shared.outFileName !== 'string'
    ) {
      throw bootstrapError({
        code: 'HOST_REMOTE_INVALID',
        message: `Selected host remote entry "${remoteEntryUrl}" declares shared dependency ${JSON.stringify(shared)} without packageName and outFileName.`,
      });
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
