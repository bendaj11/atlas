import type { AtlasRuntimeOverrideDocument } from '@atlas/runtime';
import type {
  AtlasConfig,
  AtlasHostConfig,
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
} from '@atlas/schema';
import type { AtlasBuildService } from '../build/service/build.service.js';
import type { AtlasPrompter } from '../cli/ui/ui.js';
import type { AtlasProject } from '../workspace/service/workspace.js';

export type DevPrompts = Pick<AtlasPrompter, 'interactive' | 'select'>;

export interface DevControlServer {
  port: number;
  markReady(): Promise<void>;
  reconcile(): Promise<void>;
  close(): Promise<void>;
}

export interface HostDevPorts {
  bootstrapPort: number;
  clientPort: number;
}

export interface DevTarget {
  hostId: string;
  hostUrl: string;
}

export interface HostDevTarget extends DevTarget {
  previewKind: 'deployed' | 'local';
}

export interface ResolveDevTargetOptions {
  config: AtlasConfig;
  prompts: DevPrompts;
  previewUrls: readonly string[];
}

export interface ResolveHostDevTargetOptions {
  config: AtlasHostConfig;
  localPreviewUrl: string;
  prompts: DevPrompts;
  previewUrls: readonly string[];
}

export type AtlasDevBuildService = Pick<
  AtlasBuildService,
  'loadConfig' | 'buildManifest'
> &
  Partial<Pick<AtlasBuildService, 'buildLocalHostManifest'>>;

export interface AtlasDevSessionDocument {
  schemaVersion: '1';
  hostId: string;
  catalog: AtlasHostCatalog;
  overrides: AtlasRuntimeOverrideDocument['overrides'];
  hostOverride?: AtlasHostManifest;
  overrideUrl: string;
  generatedAt: string;
}

export interface AtlasDevOverrideDocument extends AtlasRuntimeOverrideDocument {
  hostOverride?: AtlasHostManifest;
  previewUrl?: string;
}

export interface LocalBootstrapServerOptions {
  port: number;
  runtime: AtlasHostRuntimeConfig;
  html?: string;
  proxy?: LocalNativeProxy;
}

export interface LocalNativeProxy {
  origin: string;
  routes: Readonly<Record<string, unknown>>;
}

export interface AppDevelopmentOptions {
  project: AtlasProject;
  name: string;
  config: AtlasConfig;
  prompts: DevPrompts;
}

export interface DevSessionStore {
  register(document: AtlasDevOverrideDocument): void;
  unregister(appId: string, hostId?: string): void;
  unregisterHost(hostId: string): void;
  markReady(appId: string, hostId?: string): void;
  markHostReady(hostId: string): void;
  markDocumentReady(document: AtlasDevOverrideDocument): void;
  document(hostId?: string): AtlasDevOverrideDocument | undefined;
  catalog(
    hostId: string,
    productionCatalog?: AtlasHostCatalog,
  ): AtlasHostCatalog | undefined;
  devSession(
    hostId?: string,
    publishedCatalog?: AtlasHostCatalog,
  ): AtlasDevSessionDocument | undefined;
  hasReadySession(): boolean;
  previewAllowed(hostId: string | undefined, previewUrl: string): boolean;
}
