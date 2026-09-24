import type { AtlasManifest } from '../manifest/atlas-manifest.js';

export type AtlasRuntimeOverrideReason = 'local' | 'pr' | 'historical';

export interface AtlasRuntimeOverride {
  appId: string;
  manifest: AtlasManifest;
  reason: AtlasRuntimeOverrideReason;
}

export interface AtlasRuntimeOverrideDocument {
  schemaVersion: '1';
  hostId: string;
  overrides: AtlasRuntimeOverride[];
  generatedAt: string;
}
