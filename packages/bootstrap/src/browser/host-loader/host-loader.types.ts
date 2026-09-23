import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import type { FetchOptions } from '../fetch-json/index.js';
import type { importModule } from '../module-shim/index.js';
import type {
  validateArtifactUrl,
  validateHostManifest,
} from '../validation/index.js';

export interface RemoteMetadata {
  buildNotificationsEndpoint?: string;
  exposes?: Array<{ key?: string; outFileName?: string }>;
  shared?: Array<{ packageName?: string; outFileName?: string }>;
}

export type HostLoaderDocument = Pick<Document, 'createElement' | 'head'>;

export type FetchRemoteMetadata = (
  options: FetchOptions,
) => Promise<RemoteMetadata>;

export interface HostLoaderDependencies {
  readonly document: HostLoaderDocument;
  readonly fetchJson: FetchRemoteMetadata;
  readonly importModule: typeof importModule;
  readonly validateArtifactUrl: typeof validateArtifactUrl;
  readonly validateHostManifest: typeof validateHostManifest;
  readonly createEventSource?: (url: URL) => Pick<EventSource, 'onmessage'>;
  readonly reloadPage: () => void;
}

export interface HostLoadContext {
  manifest: AtlasHostManifest;
  runtime: AtlasHostRuntimeConfig;
  dependencies: HostLoaderDependencies;
}

export interface LoadHostModuleOptions {
  manifest: AtlasHostManifest;
  runtime: AtlasHostRuntimeConfig;
  dependencies?: HostLoaderDependencies;
}
