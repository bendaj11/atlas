import type {
  AtlasDevelopmentOfferIds,
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import type { requestDevelopmentSession } from '../development-session/index.js';
import type { fetchJson } from '../fetch-json/index.js';
import type { loadPublishedArtifact } from '../published-artifact/index.js';

export interface RuntimeAppOverride {
  appId?: string;
  manifest?: AtlasManifest;
}

export interface RuntimeOverrides {
  hostId?: string;
  /** @deprecated */
  host?: { manifest?: AtlasHostManifest };
  hostOverride?: AtlasHostManifest;
  /** @deprecated */
  apps?: RuntimeAppOverride[];
  overrides?: RuntimeAppOverride[];
}

export interface DevSession {
  schemaVersion?: string;
  hostId?: string;
  generatedAt?: string;
  catalog?: AtlasHostCatalog;
  hostOverride?: AtlasHostManifest;
  overrides?: RuntimeAppOverride[];
  offerIds?: AtlasDevelopmentOfferIds;
}

export interface OverridesDependencies {
  readonly sessionStorage: Pick<Storage, 'getItem'>;
  readonly localStorage: Pick<Storage, 'getItem'>;
  readonly fetchJson: typeof fetchJson;
  readonly requestDevelopmentSession: typeof requestDevelopmentSession;
  readonly loadPublishedArtifact: typeof loadPublishedArtifact;
}

export interface OverridesContext {
  runtime: AtlasHostRuntimeConfig;
  dependencies: OverridesDependencies;
}

export interface ApplyOverridesOptions {
  runtime: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
  developmentSession?: DevSession;
  dependencies?: OverridesDependencies;
}
