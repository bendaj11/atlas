import type { AtlasRuntimeOverrideDocument } from '@atlas/runtime';
import type {
  AtlasConfig,
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasStaticRegistry,
} from '@atlas/schema';
import type { AtlasBuildService } from '../build/service/build.service.js';
import type { AtlasPrompter } from '../cli/ui/ui.js';
import type { AtlasProject } from '../workspace/service/workspace.js';

export type DevPrompts = Pick<
  AtlasPrompter,
  'interactive' | 'input' | 'select'
>;

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
  promptedForHostUrl: boolean;
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
  catalog(hostId: string): AtlasHostCatalog | undefined;
  devSession(hostId?: string): AtlasDevSessionDocument | undefined;
  registry(): AtlasStaticRegistry;
  hasReadySession(): boolean;
}
