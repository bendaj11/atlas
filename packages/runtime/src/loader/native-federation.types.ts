import type { AtlasExportedWidgetManifest, AtlasManifest } from '@atlas/schema';
import type {
  AtlasAppEntry,
  AtlasExportedWidgetEntry,
} from '@atlas/sdk/lifecycle';
import type { AtlasRetryPolicy } from '../resilience/resilience.types.js';
import type { AtlasRemoteTrustPolicy } from './trust/trust-policy.types.js';

export type FederationRemotes = Record<string, string>;

export interface FederationInitOptions {
  deployUrl?: string;
}

export type InitFederation = (
  remotes: FederationRemotes,
  options?: FederationInitOptions,
) => Promise<unknown>;

export type LoadRemoteModule = (
  remoteName: string,
  exposedModule: string,
) => Promise<unknown>;

export interface AtlasFederationAdapter {
  initFederation: InitFederation;
  loadRemoteModule: LoadRemoteModule;
}

export type InitializeFederationRemotes = (
  manifests: AtlasManifest[],
) => Promise<void>;

export type ImportFederationRemote = (
  manifest: AtlasManifest,
) => Promise<AtlasAppEntry>;

export type ImportFederationWidget = (
  widget: AtlasExportedWidgetManifest,
  ownerManifest?: AtlasManifest,
) => Promise<AtlasExportedWidgetEntry>;

export interface AtlasNativeFederationImporters {
  initialize: InitializeFederationRemotes;
  importRemote: ImportFederationRemote;
  importWidget: ImportFederationWidget;
}

export interface NativeFederationImportersOptions {
  runtime: AtlasFederationAdapter;
  requestPolicy?: AtlasRetryPolicy;
  hostRemoteEntryUrl?: string;
}

export interface TrustedNativeFederationImportersOptions extends NativeFederationImportersOptions {
  manifests: AtlasManifest[];
  policy: AtlasRemoteTrustPolicy;
}

export type FederationRemote = Pick<AtlasManifest, 'id' | 'remoteEntryUrl'> &
  Partial<Pick<AtlasManifest, 'channel' | 'framework'>>;
